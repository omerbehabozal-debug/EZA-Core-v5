# -*- coding: utf-8 -*-
"""Phase 8.8G-2 — authenticated generation persistence integration."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.exc import IntegrityError

from backend.core.schemas.pipeline import StandaloneRequest
from backend.core.schemas.standalone_conversations import (
    StandaloneConversationCreate,
    StandaloneConversationMessageCreate,
)
from backend.core.utils.dependencies import get_db
from backend.main import app
from backend.models.institution import Institution  # noqa: F401
from backend.models.role import Role  # noqa: F401
from backend.models.user import LegacyUser  # noqa: F401
from backend.models.standalone_conversations import (
    StandaloneConversation,
    StandaloneConversationMessage,
    StandaloneYansiPreparation,
)
from backend.services.production_auth import create_access_token
from backend.services.standalone.conversations import (
    append_standalone_message,
    upsert_standalone_conversation,
)
from backend.services.standalone.generation_persistence import (
    persist_assistant_turn_after_generation,
    persist_user_turn_before_generation,
    try_resolve_generation_persistence,
)

client = TestClient(app)


@compiles(PGUUID, "sqlite")
def _compile_uuid_sqlite(_type, _compiler, **_kw):
    return "CHAR(36)"


def _make_user():
    user_id = uuid.uuid4()
    return SimpleNamespace(
        id=user_id,
        email=f"{user_id.hex[:8]}@example.test",
        password_hash="hash",
        role="user",
        is_active=True,
        mirror_plan="free",
    )


def _auth_header(user) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user)}"}


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


def test_generation_persistence_schema_fields():
    req = StandaloneRequest(
        query="merhaba",
        serverConversationId=str(uuid.uuid4()),
        clientUserMessageId="user-1",
        clientAssistantMessageId="eza-1",
    )
    assert req.clientUserMessageId == "user-1"
    assert req.clientAssistantMessageId == "eza-1"


def test_try_resolve_generation_persistence_requires_all_fields():
    user = _make_user()
    token = create_access_token(user)
    creds = MagicMock()
    creds.credentials = token

    partial = StandaloneRequest(query="hi", serverConversationId=str(uuid.uuid4()))
    assert try_resolve_generation_persistence(partial, creds) is None

    full = StandaloneRequest(
        query="hi",
        serverConversationId=str(user.id),
        clientUserMessageId="user-1",
        clientAssistantMessageId="eza-1",
    )
    ctx = try_resolve_generation_persistence(full, creds)
    assert ctx is not None
    assert ctx.client_user_message_id == "user-1"


@pytest.mark.asyncio
async def test_generation_persist_user_and_assistant_once(db_session):
    user_id = uuid.uuid4()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(clientConversationId="chat-a", title="A"),
    )
    conv_id = uuid.UUID(created.id)
    from backend.services.standalone.generation_persistence import GenerationPersistenceContext

    ctx = GenerationPersistenceContext(
        user_id=user_id,
        conversation_id=conv_id,
        client_user_message_id="user-1",
        client_assistant_message_id="eza-1",
    )

    user_msg = await persist_user_turn_before_generation(
        db_session, ctx, content="Bilgisayardan yazıyorum."
    )
    assert user_msg.role == "user"
    assert user_msg.sequence == 1

    assistant_msg = await persist_assistant_turn_after_generation(
        db_session, ctx, content="Merhaba, nasıl yardımcı olabilirim?"
    )
    assert assistant_msg is not None
    assert assistant_msg.role == "assistant"
    assert assistant_msg.sequence == 2

    dup = await persist_assistant_turn_after_generation(
        db_session, ctx, content="Merhaba, nasıl yardımcı olabilirim?"
    )
    assert dup is not None
    assert dup.id == assistant_msg.id


@pytest.mark.asyncio
async def test_append_integrity_error_returns_existing_not_raw(db_session, monkeypatch):
    user_id = uuid.uuid4()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(clientConversationId="chat-b"),
    )
    conv_id = uuid.UUID(created.id)

    first = await append_standalone_message(
        db_session,
        user_id=user_id,
        conversation_id=conv_id,
        body=StandaloneConversationMessageCreate(
            clientMessageId="msg-1",
            role="user",
            content="hello",
        ),
    )

    async def boom_once(*args, **kwargs):
        raise IntegrityError("insert", {}, Exception("dup"))

    from backend.services.standalone import conversations as conv_mod

    original = conv_mod._append_standalone_message_once
    calls = {"n": 0}

    async def flaky_once(db, **kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            raise IntegrityError("insert", {}, Exception("dup"))
        return await original(db, **kwargs)

    monkeypatch.setattr(conv_mod, "_append_standalone_message_once", flaky_once)

    second = await append_standalone_message(
        db_session,
        user_id=user_id,
        conversation_id=conv_id,
        body=StandaloneConversationMessageCreate(
            clientMessageId="msg-1",
            role="user",
            content="hello",
        ),
    )
    assert second.clientMessageId == first.clientMessageId


@pytest.fixture
def authenticated_api_client(db_engine):
    Session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    user = _make_user()

    async def _override_db():
        async with Session() as session:
            yield session

    headers = _auth_header(user)
    app.dependency_overrides[get_db] = _override_db
    try:
        yield TestClient(app), user, headers
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_http_standalone_persists_turns_when_authenticated(authenticated_api_client):
    api_client, _user, headers = authenticated_api_client

    created = api_client.post(
        "/api/standalone/conversations",
        json={"clientConversationId": "chat-http", "title": "HTTP"},
        headers=headers,
    )
    assert created.status_code == 201
    conv_id = created.json()["id"]

    with patch("backend.main.run_full_pipeline", new_callable=AsyncMock) as mock_pipeline, patch(
        "backend.main.assert_can_send_message", new_callable=AsyncMock
    ), patch(
        "backend.main.record_own_continuation_started_best_effort", new_callable=AsyncMock
    ):
        mock_pipeline.return_value = SimpleNamespace(
            ok=True,
            mode="standalone",
            data={
                "assistant_answer": "Sunucu yanıtı",
                "user_score": 80,
                "assistant_score": 75,
            },
        )

        res = api_client.post(
            "/api/standalone",
            json={
                "query": "Bilgisayardan yazıyorum.",
                "serverConversationId": conv_id,
                "clientUserMessageId": "user-http-1",
                "clientAssistantMessageId": "eza-http-1",
            },
            headers=headers,
        )
    assert res.status_code == 200
    body = res.json()
    assert body["data"]["conversationPersistence"]["assistantSequence"] == 2


@pytest.mark.asyncio
async def test_two_device_sequence_authority(db_session):
    """Device A + B simulation — server sequence wins."""
    user_id = uuid.uuid4()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(clientConversationId="chat-device"),
    )
    conv_id = uuid.UUID(created.id)

    await append_standalone_message(
        db_session,
        user_id=user_id,
        conversation_id=conv_id,
        body=StandaloneConversationMessageCreate(
            clientMessageId="user-a",
            role="user",
            content="Bilgisayardan yazıyorum.",
        ),
    )
    await append_standalone_message(
        db_session,
        user_id=user_id,
        conversation_id=conv_id,
        body=StandaloneConversationMessageCreate(
            clientMessageId="eza-a",
            role="assistant",
            content="Yanıt A",
        ),
    )
    await append_standalone_message(
        db_session,
        user_id=user_id,
        conversation_id=conv_id,
        body=StandaloneConversationMessageCreate(
            clientMessageId="user-b",
            role="user",
            content="Telefondan devam ediyorum.",
        ),
    )
    await append_standalone_message(
        db_session,
        user_id=user_id,
        conversation_id=conv_id,
        body=StandaloneConversationMessageCreate(
            clientMessageId="eza-b",
            role="assistant",
            content="Yanıt B",
        ),
    )

    from backend.services.standalone.conversations import get_standalone_conversation_detail

    detail = await get_standalone_conversation_detail(
        db_session, user_id=user_id, conversation_id=conv_id
    )
    texts = [m.content for m in detail.messages]
    assert texts == [
        "Bilgisayardan yazıyorum.",
        "Yanıt A",
        "Telefondan devam ediyorum.",
        "Yanıt B",
    ]
    assert [m.sequence for m in detail.messages] == [1, 2, 3, 4]
