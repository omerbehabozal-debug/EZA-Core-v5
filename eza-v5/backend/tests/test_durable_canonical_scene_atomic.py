# -*- coding: utf-8 -*-
"""
Atomic durable canonical scene bind + authenticated READY requires durable proof.

Concurrency here is SIMULATED: the fake session models PostgreSQL row locking
(one holder at a time, released on commit/rollback) and commit visibility.
Real SELECT ... FOR UPDATE behaviour across Railway replicas still requires a
production-like PostgreSQL verification; the emitted SQL is asserted instead.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.dialects import postgresql

from backend.main import app
from backend.models.standalone_conversations import StandaloneConversation
from backend.services.mirror.durable_journey_generation_proof import (
    PROOF_NAMESPACE,
    DurableProofUnavailable,
    _load_owned_conversation_by_client_id,
    assert_durable_scene_proof_matches,
    bind_durable_canonical_scene,
    build_server_generation_proof,
)
from backend.services.mirror.journey_generation_record import (
    clear_journey_generation_records_for_tests,
    get_journey_generation_record,
    upsert_journey_generation_record,
)
from backend.services.mirror.mirror_image_provider import MockMirrorImageProvider
from backend.services.production_auth import create_access_token

client = TestClient(app)

USER_ID = uuid.UUID("11111111-2222-4333-8444-555555555555")
CONV = "client-conv-atomic-1"
GEN = "gen-atomic-a"
ASSET_A = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
ASSET_B = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff"
ASSET_OWN = "cccccccc-dddd-4eee-8fff-aaaaaaaaaaaa"
URL_A = f"https://api.test.eza.ai/api/public/mirror-scene-assets/{ASSET_A}.png"
URL_B = f"https://api.test.eza.ai/api/public/mirror-scene-assets/{ASSET_B}.png"
URL_OWN = f"https://api.test.eza.ai/api/public/mirror-scene-assets/{ASSET_OWN}.png"


def _journey_fields(**overrides):
    row = {
        "generationId": GEN,
        "userId": str(USER_ID),
        "sourceConversationId": CONV,
        "journeyId": "journey-atomic",
        "journeyVersion": 1,
        "windowIndex": 0,
        "windowStart": 0,
        "windowEnd": 7,
        "windowHash": "win-a",
        "scopedInputHash": "scope-a",
        "selectedStepsHash": "steps-a",
        "sourceBlockHash": "block-a",
        "interpretationHash": "interp-a",
        "mappedPromptHash": "prompt-a",
    }
    row.update(overrides)
    return row


@pytest.fixture(autouse=True)
def _clear_memory():
    clear_journey_generation_records_for_tests()
    yield
    clear_journey_generation_records_for_tests()


# --------------------------------------------------------------------------
# Simulated PostgreSQL row lock + commit visibility
# --------------------------------------------------------------------------


class FakeRowStore:
    """One conversation row with committed state and an exclusive row lock."""

    def __init__(self, committed_tree: dict | None):
        self.committed = {"tree_metadata": committed_tree}
        self.lock = asyncio.Lock()
        self.lock_waits = 0


class FakeConv:
    def __init__(self, store: FakeRowStore):
        self._store = store
        self.user_id = USER_ID
        self.client_conversation_id = CONV
        self.deleted_at = None
        self.updated_at = None
        tree = store.committed["tree_metadata"]
        self.tree_metadata = dict(tree) if isinstance(tree, dict) else tree


class FakeSession:
    """
    Models the parts of AsyncSession this code path depends on:
    FOR UPDATE takes the row lock, refresh re-reads in-transaction state,
    commit publishes and releases the lock, rollback discards and releases.
    """

    def __init__(self, store: FakeRowStore, pre_flush_delay: float = 0.0):
        self.store = store
        self.conv: FakeConv | None = None
        self.holds_lock = False
        self.pending: dict | None = None
        self.pre_flush_delay = pre_flush_delay

    async def execute(self, stmt):
        for_update = getattr(stmt, "_for_update_arg", None) is not None
        if for_update and not self.holds_lock:
            if self.store.lock.locked():
                self.store.lock_waits += 1
            await self.store.lock.acquire()
            self.holds_lock = True
        if self.conv is None or for_update:
            # Re-read committed state when (re)acquiring authority.
            if self.pending is None:
                self.conv = FakeConv(self.store)
        result = MagicMock()
        result.scalar_one_or_none.return_value = self.conv
        return result

    async def flush(self):
        if self.pre_flush_delay:
            # Hold the row lock across a suspension point so the other worker
            # must actually wait instead of running to completion first.
            await asyncio.sleep(self.pre_flush_delay)
        if self.conv is not None:
            self.pending = self.conv.tree_metadata

    async def refresh(self, conv):
        # In-transaction read-back: pending flush is visible to this session.
        conv.tree_metadata = self.pending if self.pending is not None else (
            self.store.committed["tree_metadata"]
        )

    async def commit(self):
        if self.pending is not None:
            self.store.committed["tree_metadata"] = self.pending
            self.pending = None
        self._release()

    async def rollback(self):
        self.pending = None
        self.conv = None
        self._release()

    def _release(self):
        if self.holds_lock:
            self.store.lock.release()
            self.holds_lock = False


async def _worker_bind(
    store: FakeRowStore,
    asset: str,
    url: str,
    delay: float,
    hold: float = 0.0,
):
    session = FakeSession(store, pre_flush_delay=hold)
    await asyncio.sleep(delay)
    try:
        outcome, canonical = await bind_durable_canonical_scene(
            session,
            user_id=USER_ID,
            client_conversation_id=CONV,
            generation_id=GEN,
            scene_asset_id=asset,
            scene_image_url=url,
            seed=_journey_fields(),
        )
        await session.commit()
        return outcome, canonical
    except Exception:
        await session.rollback()
        raise


def test_row_lock_sql_uses_select_for_update():
    """The read→decide→write path must emit FOR UPDATE, not a plain SELECT."""
    captured = {}

    class CapturingSession:
        async def execute(self, stmt):
            captured["stmt"] = stmt
            result = MagicMock()
            result.scalar_one_or_none.return_value = None
            return result

    async def run():
        await _load_owned_conversation_by_client_id(
            CapturingSession(),
            user_id=USER_ID,
            client_conversation_id=CONV,
            for_update=True,
        )

    asyncio.new_event_loop().run_until_complete(run())

    # The ORM statement carries the row-lock directive ...
    assert captured["stmt"]._for_update_arg is not None
    # ... and the PostgreSQL dialect renders it as FOR UPDATE on this table.
    locked_sql = str(
        StandaloneConversation.__table__.select()
        .with_for_update()
        .compile(dialect=postgresql.dialect())
    )
    assert "FOR UPDATE" in locked_sql.upper()
    assert "standalone_conversations" in locked_sql

    plain_sql = str(
        StandaloneConversation.__table__.select().compile(dialect=postgresql.dialect())
    )
    assert "FOR UPDATE" not in plain_sql.upper()


@pytest.mark.asyncio
async def test_concurrent_workers_produce_exactly_one_canonical_scene():
    """
    A and B both start from 'scene unbound' and run concurrently.
    The row lock must serialize them so the second one observes the first
    committed bind and does not overwrite it.
    """
    store = FakeRowStore({PROOF_NAMESPACE: {GEN: build_server_generation_proof(_journey_fields())}})

    result_a, result_b = await asyncio.gather(
        _worker_bind(store, ASSET_A, URL_A, 0.0, hold=0.05),
        _worker_bind(store, ASSET_B, URL_B, 0.01),
    )

    outcomes = {result_a[0], result_b[0]}
    assert outcomes == {"bound", "conflict"}
    assert store.lock_waits >= 1, "second worker must have waited on the row lock"

    final = store.committed["tree_metadata"][PROOF_NAMESPACE][GEN]
    assert final["sceneAssetId"] == ASSET_A
    assert final["sceneImageUrl"] == URL_A

    loser = result_a if result_a[0] == "conflict" else result_b
    assert loser[1]["sceneAssetId"] == ASSET_A
    assert loser[1]["sceneImageUrl"] == URL_A


@pytest.mark.asyncio
async def test_same_asset_rebind_is_idempotent_and_different_asset_conflicts():
    store = FakeRowStore({PROOF_NAMESPACE: {GEN: build_server_generation_proof(_journey_fields())}})
    first = await _worker_bind(store, ASSET_A, URL_A, 0.0)
    assert first[0] == "bound"

    again = await _worker_bind(store, ASSET_A, URL_A, 0.0)
    assert again[0] == "idempotent"
    assert again[1]["sceneImageUrl"] == URL_A

    later = await _worker_bind(store, ASSET_B, URL_B, 0.0)
    assert later[0] == "conflict"
    assert later[1]["sceneAssetId"] == ASSET_A
    assert store.committed["tree_metadata"][PROOF_NAMESPACE][GEN]["sceneAssetId"] == ASSET_A


@pytest.mark.asyncio
async def test_bind_without_proof_or_conversation_is_not_silently_ok():
    empty = FakeRowStore({})
    outcome, canonical = await bind_durable_canonical_scene(
        FakeSession(empty),
        user_id=USER_ID,
        client_conversation_id=CONV,
        generation_id=GEN,
        scene_asset_id=ASSET_A,
        scene_image_url=URL_A,
        seed=None,
    )
    assert outcome == "no_proof"
    assert canonical is None

    class NoRowSession(FakeSession):
        async def execute(self, stmt):
            result = MagicMock()
            result.scalar_one_or_none.return_value = None
            return result

    outcome2, canonical2 = await bind_durable_canonical_scene(
        NoRowSession(empty),
        user_id=USER_ID,
        client_conversation_id=CONV,
        generation_id=GEN,
        scene_asset_id=ASSET_A,
        scene_image_url=URL_A,
        seed=_journey_fields(),
    )
    assert outcome2 == "no_conversation"
    assert canonical2 is None


@pytest.mark.asyncio
async def test_lost_write_is_detected_by_read_back():
    """If the flush did not actually store the proof, bind must fail closed."""
    store = FakeRowStore({PROOF_NAMESPACE: {GEN: build_server_generation_proof(_journey_fields())}})

    class LosingSession(FakeSession):
        async def flush(self):
            self.pending = {}  # write silently lost

    with pytest.raises(DurableProofUnavailable) as exc:
        await bind_durable_canonical_scene(
            LosingSession(store),
            user_id=USER_ID,
            client_conversation_id=CONV,
            generation_id=GEN,
            scene_asset_id=ASSET_A,
            scene_image_url=URL_A,
            seed=_journey_fields(),
        )
    assert exc.value.reason == "proof_missing_after_write"


def test_proof_verification_rejects_every_identity_mismatch():
    proof = build_server_generation_proof(
        _journey_fields(sceneAssetId=ASSET_A, sceneImageUrl=URL_A)
    )
    ok = assert_durable_scene_proof_matches(
        proof,
        generation_id=GEN,
        user_id=USER_ID,
        source_conversation_id=CONV,
        journey_id="journey-atomic",
        journey_version=1,
        scene_asset_id=ASSET_A,
        scene_image_url=URL_A,
    )
    assert ok["generationId"] == GEN

    cases = {
        "proof_missing": dict(proof=None),
        "generation_mismatch": dict(generation_id="gen-other"),
        "owner_mismatch": dict(user_id=uuid.UUID("99999999-9999-4999-8999-999999999999")),
        "conversation_mismatch": dict(source_conversation_id="other-conv"),
        "journey_mismatch": dict(journey_id="journey-other"),
        "journey_version_mismatch": dict(journey_version=2),
        "scene_asset_mismatch": dict(scene_asset_id=ASSET_B),
        "scene_url_mismatch": dict(scene_image_url=URL_B),
    }
    base = dict(
        proof=proof,
        generation_id=GEN,
        user_id=USER_ID,
        source_conversation_id=CONV,
        journey_id="journey-atomic",
        journey_version=1,
        scene_asset_id=ASSET_A,
        scene_image_url=URL_A,
    )
    for expected_reason, override in cases.items():
        args = {**base, **override}
        proof_arg = args.pop("proof")
        with pytest.raises(DurableProofUnavailable) as exc:
            assert_durable_scene_proof_matches(proof_arg, **args)
        assert exc.value.reason == expected_reason

    incomplete = dict(proof)
    incomplete.pop("selectedStepsHash")
    with pytest.raises(DurableProofUnavailable) as exc_missing:
        assert_durable_scene_proof_matches(
            incomplete,
            generation_id=GEN,
            user_id=USER_ID,
            source_conversation_id=CONV,
            journey_id="journey-atomic",
            journey_version=1,
            scene_asset_id=ASSET_A,
            scene_image_url=URL_A,
        )
    assert exc_missing.value.reason == "missing_selectedStepsHash"


# --------------------------------------------------------------------------
# Endpoint contract: authenticated Journey READY requires durable proof
# --------------------------------------------------------------------------

DURABLE = "backend.services.mirror.durable_journey_generation_proof"

SCENE_BODY = {
    "prompt": "premium soft 3D illustration, wellness garden, no text",
    "negativePrompt": "text, letters, logo",
    "seedHint": "mirror-visual-atomic",
    "stylePreset": "eza_mirror_professional_v1",
    "qualityHints": ["9:16 vertical safe composition"],
    "cardDate": "2026-05-21",
    "conversationId": CONV,
    "generationRequestId": GEN,
    "generationPipeline": "LEGACY_V3",
}


def _make_plus_user():
    return SimpleNamespace(
        id=USER_ID,
        email="plus@test.eza.ai",
        password_hash="hash",
        role="user",
        is_active=True,
        mirror_plan="plus",
    )


@contextmanager
def _patch_production_user(user):
    with (
        patch(
            "backend.auth.mirror_entitlement.get_production_user_by_id",
            new_callable=AsyncMock,
            return_value=user,
        ),
        patch(
            "backend.core.account.subject.get_production_user_by_id",
            new_callable=AsyncMock,
            return_value=user,
        ),
    ):
        yield


@pytest.fixture(autouse=True)
def _mock_visual_quota_consume():
    with patch(
        "backend.routers.standalone_mirror.consume_usage_event_atomic",
        new_callable=AsyncMock,
    ) as mock_consume:
        from backend.core.account.usage_service import UsageConsumeResult

        mock_consume.return_value = UsageConsumeResult(event=SimpleNamespace(), created=True)
        yield


def _post_scene(user, provider_url: str = URL_OWN):
    """Provider returns a real Mirror asset URL so the canonical bind path runs."""
    from backend.services.mirror.types import MirrorImageResult

    provider = MockMirrorImageProvider()
    provider.generate_scene = AsyncMock(
        return_value=MirrorImageResult(
            scene_image_url=provider_url,
            provider="openai",
            cached=False,
            generated_at="2026-09-27T00:00:00Z",
        )
    )
    with _patch_production_user(user), patch(
        "backend.services.mirror.mirror_image_service.get_mirror_image_provider",
        return_value=provider,
    ):
        return client.post(
            "/api/standalone/mirror/generate-scene",
            json=SCENE_BODY,
            headers={"Authorization": f"Bearer {create_access_token(user)}"},
        )


def _seed_live_journey_record():
    upsert_journey_generation_record(GEN, _journey_fields())


class _StagedProofStore:
    """
    Durable proof whose value only appears after the canonical bind ran.

    Without this, a pre-seeded durable scene would satisfy the cached-scene
    short circuit and the request would never reach the bind path under test.
    """

    def __init__(self, *, after=None, outcome="bound", bound_proof=None):
        self.after = after
        self.outcome = outcome
        self.bound_proof = bound_proof
        self.bound = False

    async def load(self, db, **kwargs):
        return self.after if self.bound else None

    async def bind(self, db, **kwargs):
        self.bound = True
        return self.outcome, self.bound_proof


def _error_body(res):
    """5xx bodies are genericized by the app; 4xx keep domain detail."""
    return res.json()


def test_generate_scene_fails_when_durable_bind_raises():
    """TEST 2 — provider succeeded but the durable bind could not be written."""
    _seed_live_journey_record()
    with patch(
        f"{DURABLE}.load_durable_journey_generation_proof",
        new_callable=AsyncMock,
        return_value=None,
    ), patch(
        f"{DURABLE}.bind_durable_canonical_scene",
        new_callable=AsyncMock,
        side_effect=RuntimeError("write failed"),
    ):
        res = _post_scene(_make_plus_user())
    assert res.status_code == 503
    body = _error_body(res)
    assert "sceneImageUrl" not in body
    # Provider spend happened and the process-local cache may hold the image,
    # but the request failed, so the client never reaches READY for it.
    assert "no table" not in json.dumps(body)


def test_generate_scene_fails_when_no_durable_proof_can_hold_the_scene():
    _seed_live_journey_record()
    staged = _StagedProofStore(outcome="no_conversation", bound_proof=None)
    with patch(
        f"{DURABLE}.load_durable_journey_generation_proof",
        new=AsyncMock(side_effect=staged.load),
    ), patch(
        f"{DURABLE}.bind_durable_canonical_scene",
        new=AsyncMock(side_effect=staged.bind),
    ):
        res = _post_scene(_make_plus_user())
    assert res.status_code == 503
    assert "sceneImageUrl" not in _error_body(res)


def test_generate_scene_fails_when_read_back_proof_is_missing():
    """TEST 3 — the write looked fine but verification cannot read it back."""
    _seed_live_journey_record()
    bound = build_server_generation_proof(
        _journey_fields(sceneAssetId=ASSET_OWN, sceneImageUrl=URL_OWN)
    )
    staged = _StagedProofStore(after=None, outcome="bound", bound_proof=bound)
    with patch(
        f"{DURABLE}.load_durable_journey_generation_proof",
        new=AsyncMock(side_effect=staged.load),
    ), patch(
        f"{DURABLE}.bind_durable_canonical_scene",
        new=AsyncMock(side_effect=staged.bind),
    ):
        res = _post_scene(_make_plus_user())
    assert res.status_code == 503
    assert "sceneImageUrl" not in _error_body(res)


def test_generate_scene_fails_when_read_back_scene_identity_differs():
    """TEST 4 — durable proof describes another scene than the one returned."""
    _seed_live_journey_record()
    bound = build_server_generation_proof(
        _journey_fields(sceneAssetId=ASSET_OWN, sceneImageUrl=URL_OWN)
    )
    other = build_server_generation_proof(
        _journey_fields(sceneAssetId=ASSET_B, sceneImageUrl=URL_B)
    )
    staged = _StagedProofStore(after=other, outcome="bound", bound_proof=bound)
    with patch(
        f"{DURABLE}.bind_durable_canonical_scene",
        new=AsyncMock(side_effect=staged.bind),
    ), patch(
        f"{DURABLE}.load_durable_journey_generation_proof",
        new=AsyncMock(side_effect=staged.load),
    ):
        res = _post_scene(_make_plus_user())
    assert res.status_code == 503
    body = _error_body(res)
    assert "sceneImageUrl" not in body
    assert URL_B not in json.dumps(body)


def test_generate_scene_returns_canonical_scene_of_the_winning_worker():
    """
    TEST 4b / PART I — this worker generated its own image but another worker
    already bound the canonical scene. The canonical scene must be returned.
    """
    _seed_live_journey_record()
    canonical = build_server_generation_proof(
        _journey_fields(sceneAssetId=ASSET_A, sceneImageUrl=URL_A)
    )
    staged = _StagedProofStore(
        after=canonical, outcome="conflict", bound_proof=canonical
    )
    with patch(
        f"{DURABLE}.bind_durable_canonical_scene",
        new=AsyncMock(side_effect=staged.bind),
    ), patch(
        f"{DURABLE}.load_durable_journey_generation_proof",
        new=AsyncMock(side_effect=staged.load),
    ):
        res = _post_scene(_make_plus_user())
    assert res.status_code == 200
    assert res.json()["sceneImageUrl"] == URL_A
    assert res.json()["sceneImageUrl"] != URL_OWN
    # Live cache was pointed at the canonical scene, not this worker's image.
    assert get_journey_generation_record(GEN)["sceneAssetId"] == ASSET_A


class _NoDb:
    """Stand-in session: every durable call on this path is patched out."""


async def _settle_reason(*, load, bind) -> HTTPException:
    """Call the settle helper with patched durable IO and return its 503."""
    from backend.routers import standalone_mirror as router_mod

    with patch(
        f"{DURABLE}.load_durable_journey_generation_proof",
        new=AsyncMock(side_effect=load),
    ), patch(
        f"{DURABLE}.bind_durable_canonical_scene",
        new=AsyncMock(side_effect=bind),
    ):
        with pytest.raises(HTTPException) as err:
            await router_mod._settle_durable_canonical_scene(
                _NoDb(),
                user_id=USER_ID,
                generation_id=GEN,
                client_conversation_id=CONV,
                asset_id=ASSET_OWN,
                persisted_url=URL_OWN,
            )
    assert err.value.status_code == 503
    assert err.value.detail["code"] == "journey_generation_proof_unavailable"
    leaked = json.dumps(err.value.detail)
    assert "select failed" not in leaked
    assert "update failed" not in leaked
    assert "relation" not in leaked
    return err.value


async def _never_called(db, **kwargs):
    raise AssertionError("must not be reached")


async def _load_none(db, **kwargs):
    return None


async def test_settle_reason_when_durable_read_fails():
    """
    The 503 body is genericized for clients, so the precise reason is asserted
    on the settle helper instead of on the HTTP response.
    """
    _seed_live_journey_record()

    async def _load(db, **kwargs):
        raise RuntimeError("select failed")

    exc = await _settle_reason(load=_load, bind=_never_called)
    assert exc.detail["reason"] == "proof_read_failed"


async def test_settle_reason_when_durable_write_fails():
    _seed_live_journey_record()

    async def _bind(db, **kwargs):
        raise RuntimeError("update failed")

    exc = await _settle_reason(load=_load_none, bind=_bind)
    assert exc.detail["reason"] == "proof_write_failed"


@pytest.mark.parametrize("outcome", ["no_conversation", "no_proof"])
async def test_settle_reason_when_no_row_can_hold_the_scene(outcome):
    _seed_live_journey_record()

    async def _bind(db, **kwargs):
        return outcome, None

    exc = await _settle_reason(load=_load_none, bind=_bind)
    assert exc.detail["reason"] == outcome


async def test_settle_reason_when_read_back_is_missing():
    _seed_live_journey_record()
    bound = build_server_generation_proof(
        _journey_fields(sceneAssetId=ASSET_OWN, sceneImageUrl=URL_OWN)
    )

    async def _bind(db, **kwargs):
        return "bound", bound

    exc = await _settle_reason(load=_load_none, bind=_bind)
    assert exc.detail["reason"] == "proof_missing"


async def test_settle_reason_when_read_back_identity_differs():
    _seed_live_journey_record()
    bound = build_server_generation_proof(
        _journey_fields(sceneAssetId=ASSET_OWN, sceneImageUrl=URL_OWN)
    )
    other = build_server_generation_proof(
        _journey_fields(sceneAssetId=ASSET_B, sceneImageUrl=URL_B)
    )
    staged = _StagedProofStore(after=other, outcome="bound", bound_proof=bound)
    exc = await _settle_reason(load=staged.load, bind=staged.bind)
    assert exc.detail["reason"] == "scene_asset_mismatch"


def test_generate_scene_succeeds_when_durable_proof_is_sealed():
    """TEST 5 — durable proof present and matching: client may seal READY."""
    _seed_live_journey_record()

    async def _fake_bind(db, **kwargs):
        return (
            "bound",
            build_server_generation_proof(
                _journey_fields(
                    sceneAssetId=kwargs["scene_asset_id"],
                    sceneImageUrl=kwargs["scene_image_url"],
                )
            ),
        )

    state: dict = {}

    async def _fake_load(db, **kwargs):
        return state.get("proof")

    async def _bind_and_record(db, **kwargs):
        outcome, proof = await _fake_bind(db, **kwargs)
        state["proof"] = proof
        return outcome, proof

    with patch(
        f"{DURABLE}.bind_durable_canonical_scene",
        new=AsyncMock(side_effect=_bind_and_record),
    ), patch(
        f"{DURABLE}.load_durable_journey_generation_proof",
        new=AsyncMock(side_effect=_fake_load),
    ):
        res = _post_scene(_make_plus_user())
    assert res.status_code == 200
    body = res.json()
    assert body["sceneImageUrl"] == URL_OWN
    assert state["proof"]["sceneImageUrl"] == body["sceneImageUrl"]
    assert state["proof"]["sceneAssetId"] == ASSET_OWN


def _prepare_app(*, authenticated: bool):
    """Prepare endpoint wired for an authenticated Journey (or a guest)."""
    from fastapi import FastAPI
    from backend.auth.mirror_entitlement import require_mirror_scene_actor
    from backend.core.utils.dependencies import get_db
    from backend.routers import standalone_mirror as sm
    from backend.security.rate_limit import rate_limit_standalone
    from backend.core.schemas.mirror_prepare_director import (
        MirrorPrepareDirectorDraftResponse,
    )

    async def _fake_prepare(**kwargs):
        return MirrorPrepareDirectorDraftResponse(
            directorEnabled=True,
            usedDirector=True,
            directorMode="FULL",
            directorExecuted=True,
            directorAffectedOutput=True,
            applyTitle=True,
            applyPrompt=True,
            contentHash="hash-prepare-atomic",
            interpretationSource="d2_llm",
        )

    class _Subject:
        is_authenticated = authenticated
        guest_fingerprint = None if authenticated else "guest-atomic-fp-1234"

    async def _resolve(*_a, **_k):
        return _Subject()

    class _Actor:
        user = SimpleNamespace(id=USER_ID) if authenticated else None

    app_obj = FastAPI()
    app_obj.include_router(sm.router)
    app_obj.dependency_overrides[require_mirror_scene_actor] = lambda: _Actor()
    app_obj.dependency_overrides[get_db] = lambda: AsyncMock()
    app_obj.dependency_overrides[rate_limit_standalone] = lambda: None
    return app_obj, sm, _fake_prepare, _resolve


def _prepare_payload():
    from backend.tests.test_mirror_journey_scoped_d2_live_prepare import (
        _bmw_steps,
        _messages_from_steps,
        _scope_payload,
    )

    steps = _bmw_steps()
    return {
        "conversationId": "conv-live-scoped",
        "generationRequestId": "req-atomic-prepare-01",
        "messages": [m.model_dump() for m in _messages_from_steps(steps)],
        "journeySemanticScope": _scope_payload(steps),
    }


@pytest.mark.parametrize(
    "persist_kwargs",
    [
        {"side_effect": RuntimeError("insert failed")},
        {"return_value": None},
    ],
    ids=["persist_raises", "no_owned_conversation_row"],
)
def test_prepare_fails_closed_when_durable_proof_cannot_be_stored(
    monkeypatch, persist_kwargs
):
    """TEST 1 — authenticated Journey prepare must not return normal success."""
    app_obj, sm, fake_prepare, resolve = _prepare_app(authenticated=True)
    monkeypatch.setattr(sm, "prepare_mirror_director_draft", fake_prepare)
    monkeypatch.setattr(sm, "resolve_account_subject", resolve)

    with patch(
        f"{DURABLE}.persist_durable_journey_generation_proof",
        new_callable=AsyncMock,
        **persist_kwargs,
    ), patch(
        "backend.services.mirror_network.repository."
        "get_mirror_network_node_by_slug_for_user",
        new_callable=AsyncMock,
        return_value=None,
    ):
        res = TestClient(app_obj).post(
            "/api/standalone/mirror/prepare-director-draft",
            json=_prepare_payload(),
        )
    assert res.status_code == 503, res.text
    assert "insert failed" not in res.text
    assert "directorEnabled" not in res.text


def test_prepare_for_guest_still_succeeds_without_durable_proof(monkeypatch):
    """PART H — guest prepare has no durable proof requirement."""
    app_obj, sm, fake_prepare, resolve = _prepare_app(authenticated=False)
    monkeypatch.setattr(sm, "prepare_mirror_director_draft", fake_prepare)
    monkeypatch.setattr(sm, "resolve_account_subject", resolve)

    with patch(
        f"{DURABLE}.persist_durable_journey_generation_proof",
        new_callable=AsyncMock,
        side_effect=AssertionError("guest prepare must not require proof"),
    ):
        res = TestClient(app_obj).post(
            "/api/standalone/mirror/prepare-director-draft",
            headers={"X-Guest-Token": "guest-token-abcdefghijklmnop"},
            json=_prepare_payload(),
        )
    assert res.status_code == 200, res.text
    assert res.json()["directorEnabled"] is True


async def test_publish_uses_durable_scene_and_never_the_other_workers_image():
    """
    PART Q — durable proof holds IMAGE A; this worker's memory cache holds
    IMAGE B. Publication must resolve A, and must never accept B.
    """
    from backend.services.mirror.durable_journey_generation_proof import (
        GenerationProofConflict,
        resolve_generation_record_for_publish,
    )

    durable_a = build_server_generation_proof(
        _journey_fields(sceneAssetId=ASSET_A, sceneImageUrl=URL_A)
    )
    upsert_journey_generation_record(
        GEN, _journey_fields(sceneAssetId=ASSET_B, sceneImageUrl=URL_B)
    )

    with patch(
        f"{DURABLE}.load_durable_journey_generation_proof",
        new_callable=AsyncMock,
        return_value=durable_a,
    ):
        with pytest.raises(GenerationProofConflict) as err:
            await resolve_generation_record_for_publish(
                _NoDb(),
                user_id=USER_ID,
                generation_id=GEN,
                client_conversation_id=CONV,
            )
    assert err.value.field == "sceneAssetId"

    # Same durable proof, memory agreeing on A: durable stays the authority.
    upsert_journey_generation_record(
        GEN, _journey_fields(sceneAssetId=ASSET_A, sceneImageUrl=URL_A)
    )
    with patch(
        f"{DURABLE}.load_durable_journey_generation_proof",
        new_callable=AsyncMock,
        return_value=durable_a,
    ):
        resolved, source = await resolve_generation_record_for_publish(
            _NoDb(),
            user_id=USER_ID,
            generation_id=GEN,
            client_conversation_id=CONV,
        )
    assert source == "durable"
    assert resolved["sceneAssetId"] == ASSET_A
    assert resolved["sceneImageUrl"] == URL_A


def test_non_journey_scene_still_tolerates_missing_proof_store():
    """
    Non-Journey scene (no Journey lineage in the server record) must not start
    requiring publication proof: a proof-store error stays tolerated.
    """
    assert get_journey_generation_record(GEN) is None
    with patch(
        f"{DURABLE}.load_durable_journey_generation_proof",
        new_callable=AsyncMock,
        return_value=None,
    ), patch(
        f"{DURABLE}.persist_durable_journey_generation_proof",
        new_callable=AsyncMock,
        side_effect=RuntimeError("no table"),
    ), patch(
        f"{DURABLE}.bind_durable_canonical_scene",
        new_callable=AsyncMock,
        side_effect=AssertionError("non-Journey must not take the strict path"),
    ):
        res = _post_scene(_make_plus_user())
    assert res.status_code == 200
    assert res.json()["sceneImageUrl"] == URL_OWN
