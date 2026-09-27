# -*- coding: utf-8 -*-
"""
Real PostgreSQL concurrency proof for bind_durable_canonical_scene (b21e0d5).

Opt-in only. Fail-closed unless the target is proven non-production.
Never prints DATABASE_URL, credentials, or host values.
"""

from __future__ import annotations

import asyncio
import os
import uuid
from types import SimpleNamespace
from urllib.parse import urlparse

import pytest
from sqlalchemy import delete, text
from sqlalchemy.exc import IntegrityError, OperationalError, ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.config import get_settings, is_production_settings
from backend.models.api_key import APIKey  # noqa: F401 — mapper init
from backend.models.application import Application  # noqa: F401 — mapper init
from backend.models.institution import Institution  # noqa: F401 — mapper init
from backend.models.production import User
from backend.models.role import Role  # noqa: F401 — mapper init
from backend.models.standalone_conversations import StandaloneConversation
from backend.models.user import LegacyUser  # noqa: F401 — mapper init
from backend.services.mirror.durable_journey_generation_proof import (
    PROOF_NAMESPACE,
    bind_durable_canonical_scene,
    build_server_generation_proof,
    load_durable_journey_generation_proof,
    persist_durable_journey_generation_proof,
)

MARKER = "pgconc-b21e0d5"
OPT_IN_ENV = "EZA_DURABLE_PG_CONCURRENCY"
SAFE_HOSTS = frozenset({"localhost", "127.0.0.1", "postgres"})
PROD_LABELS = frozenset({"prod", "production"})
DEDICATED_URL_ENV = "EZA_MIGRATION_TEST_DATABASE_URL"
RACE_TIMEOUT_SEC = 20.0


def _env_label() -> str:
    settings = get_settings()
    eza = (settings.EZA_ENV or "").strip().lower()
    env = (settings.ENV or "").strip().lower()
    return eza or env or "unresolved"


def _normalize_async_url(raw: str) -> str:
    url = (raw or "").strip()
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url[len("postgresql://") :]
    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url[len("postgres://") :]
    return url


def _hostname_from_url(url: str) -> str:
    normalized = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    normalized = normalized.replace("postgres://", "postgresql://", 1)
    return (urlparse(normalized).hostname or "").strip().lower()


def _safe_error(exc: BaseException) -> str:
    text = str(exc)
    if "://" in text or "@" in text:
        return type(exc).__name__
    return f"{type(exc).__name__}"


def _require_non_production_target() -> SimpleNamespace:
    if (os.environ.get(OPT_IN_ENV) or "").strip() != "1":
        pytest.skip(f"{OPT_IN_ENV}=1 is required for real PostgreSQL concurrency")

    settings = get_settings()
    env = (settings.ENV or "").strip().lower()
    eza = (settings.EZA_ENV or "").strip().lower()
    if env in PROD_LABELS or eza in PROD_LABELS or is_production_settings(settings):
        pytest.fail("refused: production ENV/EZA_ENV — no rows written")

    dedicated = (os.environ.get(DEDICATED_URL_ENV) or "").strip()
    raw = dedicated or (settings.DATABASE_URL or "").strip()
    if not raw:
        pytest.skip("no non-production database URL configured — no rows written")

    url = _normalize_async_url(raw)
    if not url.startswith("postgresql"):
        pytest.fail("refused: database dialect is not PostgreSQL — no rows written")

    host = _hostname_from_url(url)
    if host not in SAFE_HOSTS:
        pytest.fail("refused: database host is not on the safe allowlist — no rows written")

    return SimpleNamespace(
        url=url,
        environment_label=_env_label(),
        dialect="postgresql",
        host_allowlisted=True,
        url_source="migration_test" if dedicated else "settings",
    )


def _lineage(*, generation_id: str, user_id: uuid.UUID, client_conversation_id: str, journey_id: str):
    return {
        "generationId": generation_id,
        "userId": str(user_id),
        "sourceConversationId": client_conversation_id,
        "journeyId": journey_id,
        "journeyVersion": 1,
        "windowIndex": 0,
        "windowStart": 0,
        "windowEnd": 7,
        "windowHash": f"{MARKER}-window",
        "scopedInputHash": f"{MARKER}-scope",
        "selectedStepsHash": f"{MARKER}-steps",
        "sourceBlockHash": f"{MARKER}-block",
        "interpretationHash": f"{MARKER}-interp",
        "mappedPromptHash": f"{MARKER}-prompt",
    }


def _scene_url(asset_id: str) -> str:
    return f"https://api.test.eza.ai/api/public/mirror-scene-assets/{asset_id}.png"


def _assert_same_candidate(asset_id: str, image_url: str, a_asset: str, a_url: str, b_asset: str, b_url: str) -> str:
    asset = (asset_id or "").strip().lower()
    url = (image_url or "").strip()
    if asset == a_asset and url == a_url:
        return "A"
    if asset == b_asset and url == b_url:
        return "B"
    raise AssertionError("canonical scene is mixed or unknown (A-id/B-url forbidden)")


async def _backend_pid(session: AsyncSession) -> int:
    result = await session.execute(text("SELECT pg_backend_pid()"))
    return int(result.scalar_one())


async def _cleanup(
    factory: async_sessionmaker[AsyncSession],
    *,
    user_id: uuid.UUID,
    conversation_pk: uuid.UUID,
) -> bool:
    try:
        async with factory() as session:
            await session.execute(
                delete(StandaloneConversation).where(StandaloneConversation.id == conversation_pk)
            )
            await session.execute(delete(User).where(User.id == user_id))
            await session.commit()
        return True
    except Exception:
        return False


@pytest.mark.asyncio
async def test_postgres_two_sessions_first_writer_wins_canonical_scene():
    target = _require_non_production_target()
    print(
        f"SAFE_TARGET environment_label={target.environment_label} "
        f"dialect={target.dialect} host_allowlisted={target.host_allowlisted} "
        f"url_source={target.url_source}"
    )

    run_id = uuid.uuid4().hex
    user_id = uuid.uuid4()
    conversation_pk = uuid.uuid4()
    client_conversation_id = f"{MARKER}-{run_id}"[:64]
    generation_id = f"gen-{MARKER}-{run_id}"
    journey_id = f"journey-{MARKER}-{run_id[:8]}"
    email = f"{MARKER}+{run_id}@example.invalid"

    asset_a = str(uuid.uuid4())
    asset_b = str(uuid.uuid4())
    url_a = _scene_url(asset_a)
    url_b = _scene_url(asset_b)
    lineage = _lineage(
        generation_id=generation_id,
        user_id=user_id,
        client_conversation_id=client_conversation_id,
        journey_id=journey_id,
    )
    # Production seed contract: hashes present, no scene yet.
    seed = {k: v for k, v in lineage.items()}
    assert "sceneAssetId" not in seed
    assert "sceneImageUrl" not in seed
    built = build_server_generation_proof(seed)
    assert built.get("generationId") == generation_id
    assert not built.get("sceneAssetId")
    assert built.get("authoredBy") == "server"

    engine = create_async_engine(target.url, pool_size=4, max_overflow=0, pool_pre_ping=True)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    cleanup_ok = False
    wrote_rows = False

    try:
        async with factory() as setup:
            try:
                setup.add(
                    User(
                        id=user_id,
                        email=email,
                        role="user",
                        is_active=True,
                        is_internal_test_user=True,
                        mirror_plan="free",
                    )
                )
                setup.add(
                    StandaloneConversation(
                        id=conversation_pk,
                        user_id=user_id,
                        client_conversation_id=client_conversation_id,
                        conversation_type="mirror",
                        title=MARKER,
                    )
                )
                await setup.commit()
                wrote_rows = True
            except (OperationalError, ProgrammingError, IntegrityError) as exc:
                await setup.rollback()
                pytest.fail(f"schema/auth unavailable ({_safe_error(exc)}) — no further writes")

            proof = await persist_durable_journey_generation_proof(
                setup,
                user_id=user_id,
                client_conversation_id=client_conversation_id,
                fields=seed,
                commit=True,
            )
            assert proof is not None
            assert not (proof.get("sceneAssetId") or "").strip()
            assert proof.get("generationId") == generation_id
            assert proof.get("windowHash") == lineage["windowHash"]

        async with factory() as session_a, factory() as session_b:
            pid_a = await _backend_pid(session_a)
            pid_b = await _backend_pid(session_b)
            assert pid_a != pid_b, "contenders must use distinct PostgreSQL backends"

            barrier = asyncio.Barrier(2)

            async def contend(session: AsyncSession, asset: str, image_url: str):
                await barrier.wait()
                outcome, record = await bind_durable_canonical_scene(
                    session,
                    user_id=user_id,
                    client_conversation_id=client_conversation_id,
                    generation_id=generation_id,
                    scene_asset_id=asset,
                    scene_image_url=image_url,
                    seed=seed,
                )
                await session.commit()
                return outcome, record

            try:
                result_a, result_b = await asyncio.wait_for(
                    asyncio.gather(
                        contend(session_a, asset_a, url_a),
                        contend(session_b, asset_b, url_b),
                    ),
                    timeout=RACE_TIMEOUT_SEC,
                )
            except asyncio.TimeoutError:
                pytest.fail("lock/deadlock regression: bind race exceeded timeout")

        outcome_a, record_a = result_a
        outcome_b, record_b = result_b
        assert record_a is not None and record_b is not None

        outcomes = {outcome_a, outcome_b}
        assert "bound" in outcomes
        assert "conflict" in outcomes
        assert "bound" != outcome_a or "bound" != outcome_b

        winner_from_bind = record_a if outcome_a == "bound" else record_b
        loser_from_bind = record_b if outcome_a == "bound" else record_a
        loser_outcome = outcome_b if outcome_a == "bound" else outcome_a
        assert loser_outcome == "conflict"
        winner_label = _assert_same_candidate(
            str(winner_from_bind.get("sceneAssetId") or ""),
            str(winner_from_bind.get("sceneImageUrl") or ""),
            asset_a,
            url_a,
            asset_b,
            url_b,
        )
        # DATABASE LOCK PROVEN: loser proof is the winner, not the loser's candidate.
        # ENDPOINT ADOPTION is covered by existing unit tests, not this module.
        assert (loser_from_bind.get("sceneAssetId") or "").strip().lower() == (
            winner_from_bind.get("sceneAssetId") or ""
        ).strip().lower()
        assert (loser_from_bind.get("sceneImageUrl") or "").strip() == (
            winner_from_bind.get("sceneImageUrl") or ""
        ).strip()

        async def read_dto(session: AsyncSession) -> dict:
            row = await load_durable_journey_generation_proof(
                session,
                user_id=user_id,
                generation_id=generation_id,
                client_conversation_id=client_conversation_id,
            )
            assert row is not None
            return row

        async def read_raw_proof(session: AsyncSession) -> dict:
            conv = await session.get(StandaloneConversation, conversation_pk)
            assert conv is not None
            tree = conv.tree_metadata
            assert isinstance(tree, dict)
            proof_map = tree.get(PROOF_NAMESPACE)
            assert isinstance(proof_map, dict)
            assert list(proof_map.keys()) == [generation_id]
            raw = proof_map.get(generation_id)
            assert isinstance(raw, dict)
            return raw

        async with factory() as session_c:
            first = await read_dto(session_c)
            second = await read_dto(session_c)
            raw = await read_raw_proof(session_c)

        read_label = _assert_same_candidate(
            str(first.get("sceneAssetId") or ""),
            str(first.get("sceneImageUrl") or ""),
            asset_a,
            url_a,
            asset_b,
            url_b,
        )
        assert read_label == winner_label
        assert (second.get("sceneAssetId") or "").strip().lower() == (
            first.get("sceneAssetId") or ""
        ).strip().lower()
        assert (second.get("sceneImageUrl") or "").strip() == (first.get("sceneImageUrl") or "").strip()

        # DTO fields proof_as_generation_record actually exposes.
        assert first.get("generationId") == generation_id
        assert first.get("sourceConversationId") == client_conversation_id
        assert (first.get("journeyId") or "").lower() == journey_id.lower()
        assert str(first.get("journeyVersion")) == "1"
        assert first.get("windowHash") == lineage["windowHash"]
        assert first.get("selectedStepsHash") == lineage["selectedStepsHash"]
        assert first.get("interpretationHash") == lineage["interpretationHash"]
        assert first.get("mappedPromptHash") == lineage["mappedPromptHash"]

        raw_label = _assert_same_candidate(
            str(raw.get("sceneAssetId") or ""),
            str(raw.get("sceneImageUrl") or ""),
            asset_a,
            url_a,
            asset_b,
            url_b,
        )
        assert raw_label == winner_label
        assert raw.get("generationId") == generation_id
        assert (raw.get("userId") or "") == str(user_id)
        assert raw.get("sourceConversationId") == client_conversation_id
        assert (raw.get("journeyId") or "").lower() == journey_id.lower()
        assert str(raw.get("journeyVersion")) == "1"
        assert raw.get("windowHash") == lineage["windowHash"]
        assert raw.get("selectedStepsHash") == lineage["selectedStepsHash"]
        assert raw.get("interpretationHash") == lineage["interpretationHash"]
        assert raw.get("mappedPromptHash") == lineage["mappedPromptHash"]
        assert raw.get("authoredBy") == "server"

        print(
            f"RACE outcome_a={outcome_a} outcome_b={outcome_b} "
            f"winner={winner_label} pid_a={pid_a} pid_b={pid_b}"
        )
        # Distinct-session pids captured for the report via assert above.
        assert pid_a != pid_b
        # Silence lints on winner/loser records used above.
        assert winner_from_bind.get("generationId") == generation_id
        assert loser_from_bind.get("generationId") == generation_id
    finally:
        if wrote_rows:
            cleanup_ok = await _cleanup(
                factory, user_id=user_id, conversation_pk=conversation_pk
            )
        await engine.dispose()
        if wrote_rows:
            assert cleanup_ok, "synthetic rows must be deleted after the run"
