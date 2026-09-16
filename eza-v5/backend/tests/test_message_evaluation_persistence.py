# -*- coding: utf-8 -*-
"""Durable per-message EZA evaluation persistence (metadata JSON, no migration)."""

from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from backend.core.schemas.standalone_conversations import (
    StandaloneConversationCreate,
    StandaloneConversationMessageCreate,
)
from backend.models.standalone_conversations import (
    StandaloneConversation,
    StandaloneConversationMessage,
    StandaloneYansiPreparation,
)
from backend.services.standalone.conversations import (
    append_standalone_message,
    get_standalone_conversation_detail,
    update_standalone_message_evaluation,
    upsert_standalone_conversation,
)
from backend.services.standalone.generation_persistence import (
    GenerationPersistenceContext,
    persist_assistant_turn_after_generation,
    persist_user_turn_before_generation,
    update_user_turn_evaluation,
)
from backend.services.standalone.message_evaluation import (
    build_assistant_evaluation_metadata,
    build_user_evaluation_metadata,
    evaluation_fields_from_metadata,
    sanitize_behavioral_snapshot,
)


@compiles(PGUUID, "sqlite")
def _compile_uuid_sqlite(_type, _compiler, **_kw):
    return "CHAR(36)"


def _behavioral(*, interaction_id: str = "turn-1", eza_final: float = 88.0) -> dict:
    return {
        "schema_version": 1,
        "interaction_id": interaction_id,
        "mode": "standalone",
        "vector": {
            "input_risk": 0.1,
            "output_risk": 0.12,
            "input_health": 0.9,
            "output_health": 0.88,
            "alignment_score": 80.0,
            "eza_final": eza_final,
            "intent": "explore",
            "alignment_verdict": "aligned",
            "redirect": False,
            "redirect_reason": None,
            "redirect_benign": False,
            "policy_violation_count": 0,
        },
        "asymmetry": {
            "health_gap": 0.02,
            "risk_delta_output_minus_input": 0.02,
            "index": 0.02,
        },
        "extra_should_drop": {"secret": True},
    }


@pytest.fixture
async def db_engine():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.execute(text("PRAGMA foreign_keys=OFF"))
        await conn.run_sync(StandaloneConversation.__table__.create)
        await conn.run_sync(StandaloneConversationMessage.__table__.create)
        await conn.run_sync(StandaloneYansiPreparation.__table__.create)
    yield engine
    await engine.dispose()


@pytest.fixture
async def db_session(db_engine):
    Session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session


@pytest.mark.asyncio
async def test_user_score_updates_exact_message_identity(db_session):
    user_id = uuid.uuid4()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(clientConversationId="chat-eval-a"),
    )
    conv_id = uuid.UUID(created.id)
    ctx = GenerationPersistenceContext(
        user_id=user_id,
        conversation_id=conv_id,
        client_user_message_id="user-exact-1",
        client_assistant_message_id="asst-1",
    )
    first = await persist_user_turn_before_generation(
        db_session, ctx, content="Merhaba"
    )
    assert first.userScore is None

    updated = await update_user_turn_evaluation(db_session, ctx, user_score=91.5)
    assert updated is not None
    assert updated.id == first.id
    assert updated.clientMessageId == "user-exact-1"
    assert updated.userScore == 91.5
    assert updated.assistantScore is None

    # Wrong client id must not attach
    wrong = await update_standalone_message_evaluation(
        db_session,
        user_id=user_id,
        conversation_id=conv_id,
        client_message_id="user-other",
        evaluation=build_user_evaluation_metadata(user_score=10),
    )
    assert wrong is None

    detail = await get_standalone_conversation_detail(
        db_session, user_id=user_id, conversation_id=conv_id
    )
    assert detail is not None
    assert len(detail.messages) == 1
    assert detail.messages[0].userScore == 91.5


@pytest.mark.asyncio
async def test_assistant_evaluation_persisted_and_exposed_on_detail(db_session):
    user_id = uuid.uuid4()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(clientConversationId="chat-eval-b"),
    )
    conv_id = uuid.UUID(created.id)
    ctx = GenerationPersistenceContext(
        user_id=user_id,
        conversation_id=conv_id,
        client_user_message_id="user-b",
        client_assistant_message_id="asst-b",
    )
    await persist_user_turn_before_generation(db_session, ctx, content="Soru")
    await update_user_turn_evaluation(db_session, ctx, user_score=80)

    snap = _behavioral(interaction_id="asst-b", eza_final=84)
    asst = await persist_assistant_turn_after_generation(
        db_session,
        ctx,
        content="Cevap",
        assistant_score=84,
        behavioral=snap,
        safety="Safe",
    )
    assert asst is not None
    assert asst.assistantScore == 84
    assert asst.safety == "Safe"
    assert asst.behavioral is not None
    assert asst.behavioral["vector"]["eza_final"] == 84
    assert "extra_should_drop" not in asst.behavioral

    detail = await get_standalone_conversation_detail(
        db_session, user_id=user_id, conversation_id=conv_id
    )
    assert detail is not None
    user_msg, asst_msg = detail.messages
    assert user_msg.userScore == 80
    assert asst_msg.assistantScore == 84
    assert asst_msg.behavioral["interaction_id"] == "asst-b"
    # Arbitrary metadata must not leak as a blob — only eval fields
    dumped = asst_msg.model_dump()
    assert "metadata" not in dumped


@pytest.mark.asyncio
async def test_no_score_bleed_across_turns_and_conversations(db_session):
    user_id = uuid.uuid4()
    a = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(clientConversationId="iso-a"),
    )
    b = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(clientConversationId="iso-b"),
    )
    ctx_a1 = GenerationPersistenceContext(
        user_id=user_id,
        conversation_id=uuid.UUID(a.id),
        client_user_message_id="u1",
        client_assistant_message_id="a1",
    )
    ctx_a2 = GenerationPersistenceContext(
        user_id=user_id,
        conversation_id=uuid.UUID(a.id),
        client_user_message_id="u2",
        client_assistant_message_id="a2",
    )
    ctx_b1 = GenerationPersistenceContext(
        user_id=user_id,
        conversation_id=uuid.UUID(b.id),
        client_user_message_id="u1",  # same client id, different conversation
        client_assistant_message_id="a1",
    )

    await persist_user_turn_before_generation(db_session, ctx_a1, content="A1")
    await update_user_turn_evaluation(db_session, ctx_a1, user_score=70)
    await persist_assistant_turn_after_generation(
        db_session, ctx_a1, content="RA1", assistant_score=71, behavioral=_behavioral(eza_final=71)
    )

    await persist_user_turn_before_generation(db_session, ctx_a2, content="A2")
    await update_user_turn_evaluation(db_session, ctx_a2, user_score=90)
    await persist_assistant_turn_after_generation(
        db_session, ctx_a2, content="RA2", assistant_score=91, behavioral=_behavioral(eza_final=91)
    )

    await persist_user_turn_before_generation(db_session, ctx_b1, content="B1")
    await update_user_turn_evaluation(db_session, ctx_b1, user_score=55)
    await persist_assistant_turn_after_generation(
        db_session, ctx_b1, content="RB1", assistant_score=56, behavioral=_behavioral(eza_final=56)
    )

    detail_a = await get_standalone_conversation_detail(
        db_session, user_id=user_id, conversation_id=uuid.UUID(a.id)
    )
    detail_b = await get_standalone_conversation_detail(
        db_session, user_id=user_id, conversation_id=uuid.UUID(b.id)
    )
    assert [m.assistantScore for m in detail_a.messages if m.role == "assistant"] == [71, 91]
    assert [m.userScore for m in detail_a.messages if m.role == "user"] == [70, 90]
    assert detail_b.messages[0].userScore == 55
    assert detail_b.messages[1].assistantScore == 56


@pytest.mark.asyncio
async def test_retry_idempotent_no_duplicate_and_metadata_applied(db_session):
    user_id = uuid.uuid4()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(clientConversationId="retry-chat"),
    )
    ctx = GenerationPersistenceContext(
        user_id=user_id,
        conversation_id=uuid.UUID(created.id),
        client_user_message_id="u-retry",
        client_assistant_message_id="a-retry",
    )
    u1 = await persist_user_turn_before_generation(db_session, ctx, content="hi")
    u2 = await persist_user_turn_before_generation(db_session, ctx, content="hi")
    assert u1.id == u2.id

    a1 = await persist_assistant_turn_after_generation(
        db_session, ctx, content="yo", assistant_score=66
    )
    a2 = await persist_assistant_turn_after_generation(
        db_session,
        ctx,
        content="yo",
        assistant_score=66,
        behavioral=_behavioral(eza_final=66),
        safety="Warning",
    )
    assert a1 is not None and a2 is not None
    assert a1.id == a2.id
    assert a2.assistantScore == 66
    assert a2.safety == "Warning"
    assert a2.behavioral is not None

    detail = await get_standalone_conversation_detail(
        db_session, user_id=user_id, conversation_id=uuid.UUID(created.id)
    )
    assert len(detail.messages) == 2


@pytest.mark.asyncio
async def test_old_message_without_metadata_has_no_scores(db_session):
    user_id = uuid.uuid4()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(clientConversationId="legacy"),
    )
    await append_standalone_message(
        db_session,
        user_id=user_id,
        conversation_id=uuid.UUID(created.id),
        body=StandaloneConversationMessageCreate(
            clientMessageId="old-u",
            role="user",
            content="eski",
        ),
    )
    await append_standalone_message(
        db_session,
        user_id=user_id,
        conversation_id=uuid.UUID(created.id),
        body=StandaloneConversationMessageCreate(
            clientMessageId="old-a",
            role="assistant",
            content="eski cevap",
        ),
    )
    detail = await get_standalone_conversation_detail(
        db_session, user_id=user_id, conversation_id=uuid.UUID(created.id)
    )
    assert all(m.userScore is None for m in detail.messages)
    assert all(m.assistantScore is None for m in detail.messages)
    assert all(m.behavioral is None for m in detail.messages)


def test_malformed_metadata_sanitized_or_empty():
    assert evaluation_fields_from_metadata(None) == {}
    assert evaluation_fields_from_metadata({"userScore": "nope"}) == {}
    assert evaluation_fields_from_metadata({"userScore": float("nan")}) == {}
    assert evaluation_fields_from_metadata({"assistantScore": 150}).get("assistantScore") == 100.0
    assert sanitize_behavioral_snapshot({"vector": 1}) is None
    assert build_assistant_evaluation_metadata(safety="Nope") is None
    meta = build_assistant_evaluation_metadata(
        assistant_score=88, behavioral=_behavioral(), safety="Safe"
    )
    assert meta is not None
    assert set(meta.keys()) <= {"assistantScore", "behavioral", "safety"}
