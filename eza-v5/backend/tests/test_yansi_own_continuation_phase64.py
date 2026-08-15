# -*- coding: utf-8 -*-
"""Phase 6.4 — ownContinuationStarted at first live question."""

from __future__ import annotations

import inspect
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.models.institution import Institution  # noqa: F401
from backend.models.role import Role  # noqa: F401
from backend.models.user import LegacyUser  # noqa: F401

from backend.models.yansi_own_continuation_event import YansiOwnContinuationEvent
from backend.services.mirror_network.continuation_proof import actor_hash_for_guest_token
from backend.services.mirror_network.yansi_own_continuation import (
    count_own_continuation_started,
    record_own_continuation_started_best_effort,
)


def _proof(*, slug="yansi-a", session_id="sess-a", token="guest-token"):
    return SimpleNamespace(
        source_mirror_slug=slug,
        session_id=session_id,
        actor_hash=actor_hash_for_guest_token(token),
        user_id=None,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        consumed_at=None,
    )


@pytest.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(YansiOwnContinuationEvent.__table__.create)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session
    await engine.dispose()


async def _record(db, *, proof, history=None, guest="guest-token", token=None):
    proof_id = uuid.uuid4()
    with (
        patch(
            "backend.services.mirror_network.yansi_own_continuation.get_continuation_proof_by_id",
            new=AsyncMock(return_value=proof),
        ),
        patch(
            "backend.services.mirror_network.yansi_own_continuation.get_mirror_network_node_by_slug",
            new=AsyncMock(return_value=SimpleNamespace(journey_version=1)),
        ),
    ):
        await record_own_continuation_started_best_effort(
            db,
            lineage_proof_token=token or str(proof_id),
            history=history,
            guest_token=guest,
            credentials=None,
        )


@pytest.mark.asyncio
async def test_first_live_question_records_once(db):
    proof = _proof()
    await _record(db, proof=proof, history=None)
    await _record(db, proof=proof, history=None)
    assert await count_own_continuation_started(db, origin_slug="yansi-a") == 1


@pytest.mark.asyncio
async def test_second_user_turn_does_not_record(db):
    proof = _proof(session_id="sess-b")
    history = [SimpleNamespace(role="user", content="already asked")]
    await _record(db, proof=proof, history=history)
    assert await count_own_continuation_started(db, origin_slug="yansi-a") == 0


@pytest.mark.asyncio
async def test_forged_origin_never_uses_client_slug(db):
    proof = _proof(slug="yansi-a")
    await _record(db, proof=proof)
    assert await count_own_continuation_started(db, origin_slug="yansi-b") == 0
    assert await count_own_continuation_started(db, origin_slug="yansi-a") == 1


@pytest.mark.asyncio
async def test_actor_mismatch_skips(db):
    proof = _proof(token="real-guest")
    await _record(db, proof=proof, guest="other-guest")
    assert await count_own_continuation_started(db, origin_slug="yansi-a") == 0


@pytest.mark.asyncio
async def test_measurement_failure_does_not_raise(db):
    await record_own_continuation_started_best_effort(
        db,
        lineage_proof_token="not-a-uuid",
        history=None,
        guest_token="x",
        credentials=None,
    )
    assert await count_own_continuation_started(db, origin_slug="yansi-a") == 0


@pytest.mark.asyncio
async def test_privacy_columns_absent():
    cols = {c.name.lower() for c in YansiOwnContinuationEvent.__table__.columns}
    for needle in (
        "query",
        "public_question",
        "public_answer",
        "eza",
        "relationship_map",
        "ip",
        "user_agent",
        "lineage_proof_token",
        "proof_id",
        "guest_token",
        "message",
        "prompt",
    ):
        assert needle not in cols


def test_sohbet_page_and_session_do_not_instrument_continuation():
    from backend.services.mirror_network import sohbet_session as sohbet_mod
    from backend.routers import mirror_network as router_mod

    assert "record_own_continuation_started" not in inspect.getsource(sohbet_mod)
    assert "record_own_continuation_started" not in inspect.getsource(router_mod)
    import backend.main as main_mod

    src = inspect.getsource(main_mod)
    assert "record_own_continuation_started_best_effort" in src
