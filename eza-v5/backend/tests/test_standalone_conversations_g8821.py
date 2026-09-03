# -*- coding: utf-8 -*-
"""Phase 8.8G-2.1 — authenticated sync safety remediation."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from backend.core.schemas.standalone_conversations import (
    StandaloneConversationCreate,
    StandaloneConversationMessageCreate,
)
from backend.core.utils.dependencies import get_db
from backend.main import app
from backend.models.standalone_conversations import (
    StandaloneConversation,
    StandaloneConversationMessage,
)
from backend.services.production_auth import create_access_token
from backend.services.standalone.conversations import (
    upsert_standalone_conversation,
)
from backend.services.standalone.generation_persistence import (
    GenerationPersistenceContext,
    build_completion_persistence_status,
    persist_assistant_turn_after_generation,
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
    yield engine
    await engine.dispose()


@pytest.fixture
async def db_session(db_engine):
    Session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session


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


def test_public_append_user_role_allowed(authenticated_api_client):
    api_client, _user, headers = authenticated_api_client
    created = api_client.post(
        "/api/standalone/conversations",
        json={"clientConversationId": "chat-user-append", "title": "T"},
        headers=headers,
    )
    assert created.status_code == 201
    conv_id = created.json()["id"]

    res = api_client.post(
        f"/api/standalone/conversations/{conv_id}/messages",
        json={
            "clientMessageId": "user-public-1",
            "role": "user",
            "content": "Merhaba",
        },
        headers=headers,
    )
    assert res.status_code == 201
    assert res.json()["role"] == "user"


def test_public_append_assistant_role_rejected(authenticated_api_client):
    api_client, _user, headers = authenticated_api_client
    created = api_client.post(
        "/api/standalone/conversations",
        json={"clientConversationId": "chat-assistant-reject", "title": "T"},
        headers=headers,
    )
    assert created.status_code == 201
    conv_id = created.json()["id"]

    res = api_client.post(
        f"/api/standalone/conversations/{conv_id}/messages",
        json={
            "clientMessageId": "assistant-public-1",
            "role": "assistant",
            "content": "Injected assistant text",
        },
        headers=headers,
    )
    assert res.status_code == 422
    assert res.json()["detail"] == "assistant_append_not_allowed"


@pytest.mark.asyncio
async def test_internal_generation_assistant_persistence_still_allowed(db_session):
    user_id = uuid.uuid4()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(clientConversationId="chat-internal"),
    )
    conv_id = uuid.UUID(created.id)
    ctx = GenerationPersistenceContext(
        user_id=user_id,
        conversation_id=conv_id,
        client_user_message_id="user-int-1",
        client_assistant_message_id="eza-int-1",
    )

    assistant = await persist_assistant_turn_after_generation(
        db_session, ctx, content="Server-generated reply"
    )
    assert assistant is not None
    assert assistant.role == "assistant"


def test_non_stream_persistence_status_on_assistant_failure(authenticated_api_client):
    api_client, _user, headers = authenticated_api_client
    created = api_client.post(
        "/api/standalone/conversations",
        json={"clientConversationId": "chat-persist-fail", "title": "T"},
        headers=headers,
    )
    conv_id = created.json()["id"]

    with patch("backend.main.run_full_pipeline", new_callable=AsyncMock) as mock_pipeline, patch(
        "backend.main.assert_can_send_message", new_callable=AsyncMock
    ), patch(
        "backend.main.record_own_continuation_started_best_effort", new_callable=AsyncMock
    ), patch(
        "backend.main.persist_assistant_turn_after_generation", new_callable=AsyncMock
    ) as mock_assistant:
        mock_pipeline.return_value = SimpleNamespace(
            ok=True,
            mode="standalone",
            data={"assistant_answer": "Answer", "user_score": 80},
        )
        mock_assistant.side_effect = RuntimeError("db write failed")

        res = api_client.post(
            "/api/standalone",
            json={
                "query": "Test",
                "serverConversationId": conv_id,
                "clientUserMessageId": "user-fail-1",
                "clientAssistantMessageId": "eza-fail-1",
            },
            headers=headers,
        )

    assert res.status_code == 200
    persistence = res.json()["data"]["persistence"]
    assert persistence["conversationPersisted"] is True
    assert persistence["assistantPersisted"] is False


def test_build_completion_persistence_status_shape():
    status = build_completion_persistence_status(
        user_persisted=True,
        assistant_persisted=False,
    )
    assert status == {
        "conversationPersisted": True,
        "assistantPersisted": False,
    }
