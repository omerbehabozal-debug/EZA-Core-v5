"""Phase 7G-4c.3A: Business-first cover selection + draft persistence transaction safety.

SQLite ``sample`` proves lock-order instrumentation and serialized eligibility semantics.
It is NOT overlapping-transaction evidence. Genuine PostgreSQL concurrency remains a
separate requirement (see skip markers / report section 9).
"""
from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import OperationalError

from backend.models.business_media_observations import BusinessMediaObservation as Observation
from backend.models.business_yansi import BusinessPublication
from backend.models.mirror_network import MirrorNetworkNode
from backend.models.standalone_conversations import StandaloneConversation
from backend.services.business_yansi import brand_asset_library as library
from backend.services.business_yansi import media_observations as observe
from backend.services.business_yansi import observation_rank as rank
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import studio_media as media
from backend.services.business_yansi.media_observations import content_sha_from_locator
from backend.services.business_yansi.publication import export_editorial_conversation, publish_draft
from backend.tests.test_business_video_cover_policy import _confirm, asset_dir, sample
from backend.tests.test_business_yansi import source

_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 24
_BACKEND = Path(__file__).resolve().parents[1]


def _digest(asset) -> str:
    found = content_sha_from_locator(asset.locator)
    assert found is not None
    return found


def _steps(knowledge, phrase="Zeytinyagi hasadi"):
    return [
        {"question": f"{phrase} nedir?", "answer": knowledge.content, "sources": [str(knowledge.id)]}
        for _ in range(8)
    ]


async def _image(sample, knowledge, title: str, payload: bytes):
    row = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "image", "title": title, "caption": "", "public_allowed": True},
        image_bytes=_PNG + payload,
    )
    return await _confirm(sample, knowledge, row)


def _ready_obs(sample, asset, *, summary="Zeytinyagi hasadi ozeti", tags=None):
    return Observation(
        id=uuid.uuid4(),
        business_id=sample.business.id,
        asset_id=asset.id,
        content_sha256=_digest(asset),
        analyzer_profile=observe.PROFILE,
        idempotency_key=uuid.uuid4().hex + uuid.uuid4().hex[:32],
        status="ready",
        attempts=1,
        max_attempts=3,
        origin="upload",
        created_by=sample.editor.id,
        summary=summary,
        tags=tags if tags is not None else ["zeytinyagi", "hasadi", "ozeti"],
        visible_text=None,
        provider_model="configured-vision",
        input_tokens=10,
        output_tokens=4,
    )


@pytest.fixture(autouse=True)
def _flags_default_off(monkeypatch):
    monkeypatch.delenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", raising=False)
    monkeypatch.delenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", raising=False)
    monkeypatch.delenv("BILIGN_BUSINESS_OBSERVATION_PROFILE", raising=False)


def test_module_source_uses_single_protected_pass_and_business_before_draft():
    service_text = (_BACKEND / "services/business_yansi/service.py").read_text(encoding="utf-8")
    library_text = (_BACKEND / "services/business_yansi/brand_asset_library.py").read_text(encoding="utf-8")
    create = service_text.split("async def create_draft", 1)[1].split("async def ", 1)[0]
    revise = service_text.split("async def revise_draft", 1)[1].split("async def ", 1)[0]
    assert create.index("async with business_media_lock") < create.index("await bind_media_plan")
    assert create.index("async with business_media_lock") < create.index("Draft(")
    assert revise.index("async with business_media_lock") < revise.index("draft_decision")
    assert revise.index("draft_decision") < revise.index("await bind_media_plan")
    archive = library_text.split("async def archive_asset", 1)[1].split("async def ", 1)[0]
    links = library_text.split("async def set_links", 1)[1].split("async def ", 1)[0]
    assert archive.index("business_media_lock") < archive.index("_asset_decision")
    assert links.index("business_media_lock") < links.index("_asset_decision")


async def test_create_draft_acquires_business_lock_before_bind(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    await _image(sample, knowledge, "Zeytinyagi hasadi", b"tx-create-lock")
    order: list[str] = []
    real_lock = media.business_media_lock
    real_bind = media.bind_media_plan

    @asynccontextmanager
    async def lock_spy(db, business_id):
        order.append("business_lock")
        async with real_lock(db, business_id) as row:
            yield row

    async def bind_spy(*args, **kwargs):
        order.append("bind")
        return await real_bind(*args, **kwargs)

    import backend.services.business_yansi.studio_media as studio_mod

    monkeypatch.setattr(studio_mod, "business_media_lock", lock_spy)
    monkeypatch.setattr(studio_mod, "bind_media_plan", bind_spy)

    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge),
    )
    assert order == ["business_lock", "bind"]
    assert draft.media_plan["coverMode"] == "automatic"
    assert draft.media_plan["coverAssetId"]


async def test_revise_draft_business_lock_before_draft_for_update(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    await _image(sample, knowledge, "Zeytinyagi hasadi", b"tx-revise-lock")
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge),
    )
    order: list[str] = []
    real_lock = media.business_media_lock
    real_draft_decision = svc.draft_decision

    @asynccontextmanager
    async def lock_spy(db, business_id):
        order.append("business_lock")
        async with real_lock(db, business_id) as row:
            yield row

    async def decision_spy(db, business_id, draft_id, *, lock=False):
        if lock:
            order.append("draft_for_update")
        return await real_draft_decision(db, business_id, draft_id, lock=lock)

    import backend.services.business_yansi.studio_media as studio_mod

    monkeypatch.setattr(studio_mod, "business_media_lock", lock_spy)
    monkeypatch.setattr(svc, "draft_decision", decision_spy)

    before = draft.revision
    revised = await svc.revise_draft(
        sample.db, sample.business.id, sample.editor.id, draft.id, before,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge),
    )
    assert order[:2] == ["business_lock", "draft_for_update"]
    assert revised.revision == before + 1


async def test_set_links_and_archive_acquire_business_lock_first(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    asset = await _image(sample, knowledge, "Zeytinyagi hasadi", b"tx-link-archive")
    order: list[str] = []
    real_lock = media.business_media_lock

    @asynccontextmanager
    async def lock_spy(db, business_id):
        order.append("business_lock")
        async with real_lock(db, business_id) as row:
            yield row

    import backend.services.business_yansi.studio_media as studio_mod

    monkeypatch.setattr(studio_mod, "business_media_lock", lock_spy)

    await library.set_links(
        sample.db, sample.business.id, sample.editor.id, asset.id, [], asset.revision,
    )
    assert order == ["business_lock"]
    order.clear()
    await sample.db.refresh(asset)
    await library.archive_asset(
        sample.db, sample.business.id, sample.editor.id, asset.id, asset.revision,
    )
    assert order == ["business_lock"]
    assert asset.status == "archived"


async def test_link_revocation_before_create_excludes_cover(sample, asset_dir):
    """Serialized eligibility: revoked links leave the pool before selection.

    SQLite same-session sequencing — not overlapping PostgreSQL transactions.
    """
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    keep = await _image(sample, knowledge, "Zeytinyagi hasadi", b"tx-keep")
    drop = await _image(sample, knowledge, "Atolye", b"tx-drop")
    await library.set_links(
        sample.db, sample.business.id, sample.editor.id, drop.id, [], drop.revision,
    )
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge),
    )
    assert draft.media_plan["coverAssetId"] == str(keep.id)
    assert draft.media_plan["coverAssetId"] != str(drop.id)


async def test_archive_before_create_excludes_cover(sample, asset_dir):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    keep = await _image(sample, knowledge, "Zeytinyagi hasadi", b"tx-arch-keep")
    drop = await _image(sample, knowledge, "Atolye", b"tx-arch-drop")
    await library.archive_asset(
        sample.db, sample.business.id, sample.editor.id, drop.id, drop.revision,
    )
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge),
    )
    assert draft.media_plan["coverAssetId"] == str(keep.id)
    assert draft.media_plan["coverAssetId"] != str(drop.id)


async def test_explicit_cover_precedence_under_business_lock(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    matching = await _image(sample, knowledge, "Zeytinyagi hasadi", b"tx-exp-match")
    lamp = await _image(sample, knowledge, "Lamba isigi", b"tx-exp-lamp")
    sample.db.add(_ready_obs(sample, matching))
    await sample.db.commit()
    spy = AsyncMock(side_effect=AssertionError("explicit must skip adapter"))
    monkeypatch.setattr(
        "backend.services.business_yansi.cover_ranking_adapter.build_cover_ranking_inputs",
        spy,
    )
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge), cover_asset_id=lamp.id,
    )
    assert draft.media_plan["coverMode"] == "explicit"
    assert draft.media_plan["coverAssetId"] == str(lamp.id)
    assert spy.await_count == 0


async def test_flag_off_lexical_parity_under_lock(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    weak = await _image(sample, knowledge, "Atolye", b"tx-lex-weak")
    strong = await _image(sample, knowledge, "Zeytinyagi hasadi", b"tx-lex-strong")
    sample.db.add(_ready_obs(sample, weak, summary="Zeytinyagi hasadi ozeti kayit"))
    await sample.db.commit()
    steps = _steps(knowledge)
    legacy = media.select_cover("Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [weak, strong], steps)
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
    )
    assert draft.media_plan["coverAssetId"] == legacy == str(strong.id)


async def test_flag_on_assisted_ranking_under_lock(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    lexical = await _image(sample, knowledge, "Zeytinyagi", b"tx-rank-lex")
    studio = await _image(sample, knowledge, "Atolye", b"tx-rank-obs")
    sample.db.add(_ready_obs(sample, studio))
    await sample.db.commit()
    steps = _steps(knowledge)
    assert media.select_cover("Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [lexical, studio], steps) == str(lexical.id)
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
    )
    assert draft.media_plan["coverAssetId"] == str(studio.id)


async def test_revision_conflict_under_business_then_draft_lock(sample, asset_dir):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    await _image(sample, knowledge, "Zeytinyagi hasadi", b"tx-rev-conflict")
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge),
    )
    with pytest.raises(HTTPException) as raised:
        await svc.revise_draft(
            sample.db, sample.business.id, sample.editor.id, draft.id, draft.revision - 1,
            "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge),
        )
    assert raised.value.status_code == 409


async def test_approval_and_publication_immutability(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    cover = await _image(sample, knowledge, "Zeytinyagi hasadi", b"tx-seal")
    steps = _steps(knowledge)
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
    )
    held = draft.media_plan["coverAssetId"]
    assert held == str(cover.id)
    draft = await svc.transition_draft(
        sample.db, sample.business.id, sample.editor.id, draft.id, "review", draft.revision,
    )
    draft = await svc.transition_draft(
        sample.db, sample.business.id, sample.owner.id, draft.id, "approved", draft.revision,
    )
    sealed = draft.media_plan["seal"]
    assert sealed == media.media_seal(draft.media_plan)
    rival = await _image(sample, knowledge, "Atolye", b"tx-seal-rival")
    sample.db.add(_ready_obs(sample, rival))
    await sample.db.commit()
    await sample.db.refresh(draft)
    assert draft.media_plan["seal"] == sealed
    assert draft.media_plan["coverAssetId"] == held

    await export_editorial_conversation(sample.db, sample.business.id, sample.editor.id, draft.id)
    await sample.db.refresh(draft)
    conversation = await sample.db.get(StandaloneConversation, draft.conversation_id)
    node = MirrorNetworkNode(
        slug="tx-seal-pub",
        user_id=draft.created_by,
        conversation_id=conversation.client_conversation_id,
        visibility="private",
        safety_status="open",
        card_title="Zeytinyagi",
        card_date="2026-11-03",
        scene_image_url=None,
        public_payload={},
        private_payload={},
        journey_version=1,
    )
    sample.db.add(node)
    await sample.db.commit()
    monkeypatch.setattr(
        "backend.services.mirror_network.frozen_journey_artifact.get_frozen_journey_artifact",
        AsyncMock(return_value={"frozen": True}),
    )
    monkeypatch.setattr(
        "backend.services.mirror_network.frozen_journey_artifact.to_public_frozen_journey_artifact",
        lambda _internal: {
            "steps": [{"publicQuestion": step["question"], "publicAnswer": step["answer"]} for step in steps]
        },
    )
    await publish_draft(
        sample.db, sample.business.id, sample.owner.id, draft.id, node.slug, draft.revision,
    )
    publication = await sample.db.get(BusinessPublication, (node.slug, node.journey_version))
    assert publication is not None
    assert publication.media_plan["coverAssetId"] == held
    assert publication.media_plan["seal"] == sealed


async def test_no_provider_or_observation_generation_on_create(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    asset = await _image(sample, knowledge, "Zeytinyagi hasadi", b"tx-no-gen")
    sample.db.add(_ready_obs(sample, asset))
    await sample.db.commit()
    vision = AsyncMock()
    ensure = AsyncMock()
    monkeypatch.setattr("backend.services.business_yansi.image_observe.call_vision", vision, raising=False)
    monkeypatch.setattr("backend.services.business_yansi.media_observations.ensure_observation", ensure, raising=False)
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge),
    )
    assert draft.media_plan["coverAssetId"] == str(asset.id)
    assert vision.await_count == 0 and ensure.await_count == 0
    assert observe.enabled() is False
    assert rank.ranking_enabled() is True  # env set above for this test only


async def test_database_error_from_bind_propagates_through_create(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    await _image(sample, knowledge, "Zeytinyagi hasadi", b"tx-db-err")

    async def boom(*args, **kwargs):
        raise OperationalError("SELECT", {}, Exception("simulated_tx_db_failure"))

    import backend.services.business_yansi.studio_media as studio_mod

    monkeypatch.setattr(studio_mod, "bind_media_plan", boom)
    with pytest.raises(OperationalError, match="simulated_tx_db_failure"):
        await svc.create_draft(
            sample.db, sample.business.id, sample.editor.id,
            "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge),
        )


@pytest.mark.skip(reason="BLOCKED: overlapping PostgreSQL transactions not configured for 7G-4c.3A")
async def test_postgres_overlapping_link_revoke_vs_create_requires_disposable_url():
    """Placeholder: genuine FOR UPDATE overlap needs disposable PG URL + two sessions."""
    assert False, "must not run without overlapping PostgreSQL evidence"
