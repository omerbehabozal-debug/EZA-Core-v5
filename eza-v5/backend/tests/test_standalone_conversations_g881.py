# -*- coding: utf-8 -*-
"""Phase 8.8G-1 — durable standalone conversation backend foundation."""

from __future__ import annotations

import asyncio
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

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
    StandaloneConversationNotFoundError,
    append_standalone_message,
    delete_standalone_conversation,
    get_standalone_conversation_detail,
    list_standalone_conversations,
    patch_standalone_conversation,
    upsert_standalone_conversation,
)
from backend.core.schemas.standalone_conversations import (
    StandaloneConversationCreate,
    StandaloneConversationMessageCreate,
    StandaloneConversationPatch,
)

MIGRATION_PATH = (
    Path(__file__).resolve().parents[1]
    / "migrations"
    / "versions"
    / "add_standalone_conversations_g881_v1.py"
)

client = TestClient(app)


@compiles(PGUUID, "sqlite")
def _compile_uuid_sqlite(_type, _compiler, **_kw):
    return "CHAR(36)"


def _make_user(*, email: str | None = None):
    user_id = uuid.uuid4()
    return SimpleNamespace(
        id=user_id,
        email=email or f"{user_id.hex[:8]}@example.test",
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


async def _seed_user_id() -> uuid.UUID:
    return uuid.uuid4()


# ---------------------------------------------------------------------------
# Migration / schema contract
# ---------------------------------------------------------------------------


def test_migration_head_chain_and_tables():
    src = MIGRATION_PATH.read_text(encoding="utf-8")
    assert 'revision: str = "add_standalone_conversations_g881_v1"' in src
    assert 'down_revision: Union[str, None] = "add_user_public_avatar_revision_v1"' in src
    assert "standalone_conversations" in src
    assert "standalone_conversation_messages" in src
    assert "uq_standalone_conv_user_client" in src
    assert "uq_standalone_msg_conv_seq" in src
    assert "uq_standalone_msg_conv_client" in src
    assert "ix_standalone_conv_user_last_msg" in src
    assert "ix_standalone_conv_user_updated" in src


def test_dto_forbids_client_user_id():
    with pytest.raises(Exception):
        StandaloneConversationCreate(
            clientConversationId="chat-1",
            userId="evil",
        )  # type: ignore[call-arg]


# ---------------------------------------------------------------------------
# Service — conversation lifecycle
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_list_detail_and_message_flow(db_session):
    user_id = await _seed_user_id()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(
            clientConversationId="client-chat-1",
            title="İlk sohbet",
            conversationType="direct",
        ),
    )
    assert created.clientConversationId == "client-chat-1"
    assert created.messageCount == 0

    listed = (await list_standalone_conversations(db_session, user_id=user_id)).items
    assert len(listed) == 1
    assert listed[0].id == created.id

    conv_id = uuid.UUID(created.id)
    msg1 = await append_standalone_message(
        db_session,
        user_id=user_id,
        conversation_id=conv_id,
        body=StandaloneConversationMessageCreate(
            clientMessageId="m1",
            role="user",
            content="Merhaba",
        ),
    )
    msg2 = await append_standalone_message(
        db_session,
        user_id=user_id,
        conversation_id=conv_id,
        body=StandaloneConversationMessageCreate(
            clientMessageId="m2",
            role="assistant",
            content="Selam",
        ),
    )
    assert msg1.sequence == 1
    assert msg2.sequence == 2

    detail = await get_standalone_conversation_detail(
        db_session, user_id=user_id, conversation_id=conv_id
    )
    assert detail.messageCount == 2
    assert [m.sequence for m in detail.messages] == [1, 2]
    assert detail.preview == "Merhaba"
    assert detail.lastMessageAt is not None


@pytest.mark.asyncio
async def test_idempotent_conversation_create(db_session):
    user_id = await _seed_user_id()
    body = StandaloneConversationCreate(clientConversationId="dup-chat", title="A")
    first = await upsert_standalone_conversation(db_session, user_id=user_id, body=body)
    second = await upsert_standalone_conversation(db_session, user_id=user_id, body=body)
    assert first.id == second.id
    listed = (await list_standalone_conversations(db_session, user_id=user_id)).items
    assert len(listed) == 1


@pytest.mark.asyncio
async def test_idempotent_message_append(db_session):
    user_id = await _seed_user_id()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(clientConversationId="chat-dup-msg"),
    )
    conv_id = uuid.UUID(created.id)
    body = StandaloneConversationMessageCreate(
        clientMessageId="same-msg",
        role="user",
        content="Tek",
    )
    first = await append_standalone_message(
        db_session, user_id=user_id, conversation_id=conv_id, body=body
    )
    second = await append_standalone_message(
        db_session, user_id=user_id, conversation_id=conv_id, body=body
    )
    assert first.id == second.id
    assert first.sequence == 1
    detail = await get_standalone_conversation_detail(
        db_session, user_id=user_id, conversation_id=conv_id
    )
    assert detail.messageCount == 1


@pytest.mark.asyncio
async def test_list_order_last_message_at(db_session):
    user_id = await _seed_user_id()
    older = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(clientConversationId="older"),
    )
    newer = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(clientConversationId="newer"),
    )
    await append_standalone_message(
        db_session,
        user_id=user_id,
        conversation_id=uuid.UUID(older.id),
        body=StandaloneConversationMessageCreate(
            clientMessageId="o1", role="user", content="eski"
        ),
    )
    await append_standalone_message(
        db_session,
        user_id=user_id,
        conversation_id=uuid.UUID(newer.id),
        body=StandaloneConversationMessageCreate(
            clientMessageId="n1", role="user", content="yeni"
        ),
    )
    listed = (await list_standalone_conversations(db_session, user_id=user_id)).items
    assert listed[0].clientConversationId == "newer"
    assert listed[1].clientConversationId == "older"


@pytest.mark.asyncio
async def test_title_patch_archive_restore_and_delete(db_session):
    user_id = await _seed_user_id()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(clientConversationId="lifecycle"),
    )
    conv_id = uuid.UUID(created.id)

    patched = await patch_standalone_conversation(
        db_session,
        user_id=user_id,
        conversation_id=conv_id,
        body=StandaloneConversationPatch(title="Yeni başlık", titlePinned=True),
    )
    assert patched.title == "Yeni başlık"
    assert patched.titlePinned is True

    archived = await patch_standalone_conversation(
        db_session,
        user_id=user_id,
        conversation_id=conv_id,
        body=StandaloneConversationPatch(archived=True),
    )
    assert archived.archived is True
    assert (await list_standalone_conversations(db_session, user_id=user_id)).items == []

    with pytest.raises(StandaloneConversationNotFoundError):
        await get_standalone_conversation_detail(
            db_session, user_id=user_id, conversation_id=conv_id
        )

    restored = await patch_standalone_conversation(
        db_session,
        user_id=user_id,
        conversation_id=conv_id,
        body=StandaloneConversationPatch(archived=False),
    )
    assert restored.archived is False
    listed = (await list_standalone_conversations(db_session, user_id=user_id)).items
    assert len(listed) == 1
    detail = await get_standalone_conversation_detail(
        db_session, user_id=user_id, conversation_id=conv_id
    )
    assert detail.id == created.id

    await delete_standalone_conversation(
        db_session, user_id=user_id, conversation_id=conv_id
    )
    with pytest.raises(StandaloneConversationNotFoundError):
        await patch_standalone_conversation(
            db_session,
            user_id=user_id,
            conversation_id=conv_id,
            body=StandaloneConversationPatch(archived=False),
        )


@pytest.mark.asyncio
async def test_continuation_lineage_fields_persisted_without_proof(db_session):
    user_id = await _seed_user_id()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(
            clientConversationId="cont-1",
            conversationType="continuation",
            sourceYansiSlug="Published-Yansi",
            parentClientConversationId="parent-client-id",
            treeMetadata={"sourceType": "mirror", "branchTitle": "Yerel kafeler"},
        ),
    )
    assert created.conversationType == "continuation"
    assert created.sourceYansiSlug == "published-yansi"
    assert "userId" not in created.model_dump()
    assert "email" not in created.model_dump()


@pytest.mark.asyncio
async def test_cross_user_isolation_service_layer(db_session):
    user_a = await _seed_user_id()
    user_b = await _seed_user_id()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_a,
        body=StandaloneConversationCreate(clientConversationId="owned-by-a"),
    )
    conv_id = uuid.UUID(created.id)

    with pytest.raises(StandaloneConversationNotFoundError):
        await get_standalone_conversation_detail(
            db_session, user_id=user_b, conversation_id=conv_id
        )
    with pytest.raises(StandaloneConversationNotFoundError):
        await append_standalone_message(
            db_session,
            user_id=user_b,
            conversation_id=conv_id,
            body=StandaloneConversationMessageCreate(
                clientMessageId="x", role="user", content="hack"
            ),
        )
    with pytest.raises(StandaloneConversationNotFoundError):
        await patch_standalone_conversation(
            db_session,
            user_id=user_b,
            conversation_id=conv_id,
            body=StandaloneConversationPatch(title="hack"),
        )
    with pytest.raises(StandaloneConversationNotFoundError):
        await delete_standalone_conversation(
            db_session, user_id=user_b, conversation_id=conv_id
        )


@pytest.mark.asyncio
async def test_concurrent_message_appends_assign_distinct_sequences(db_session):
    user_id = await _seed_user_id()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(clientConversationId="concurrent"),
    )
    conv_id = uuid.UUID(created.id)

    async def _append(client_message_id: str):
        Session = async_sessionmaker(
            db_session.bind, class_=AsyncSession, expire_on_commit=False
        )
        async with Session() as session:
            return await append_standalone_message(
                session,
                user_id=user_id,
                conversation_id=conv_id,
                body=StandaloneConversationMessageCreate(
                    clientMessageId=client_message_id,
                    role="user",
                    content=client_message_id,
                ),
            )

    results = await asyncio.gather(
        _append("c1"),
        _append("c2"),
        _append("c3"),
        _append("c4"),
    )
    sequences = sorted(r.sequence for r in results)
    assert sequences == [1, 2, 3, 4]


# ---------------------------------------------------------------------------
# HTTP — auth + cross-user + DTO privacy
# ---------------------------------------------------------------------------


@pytest.fixture
def authenticated_api_client(db_engine):
    """Sync TestClient with sqlite-backed get_db override and JWT auth."""
    Session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    user = _make_user(email=f"{uuid.uuid4().hex[:8]}@g881.test")

    async def _override_db():
        async with Session() as session:
            yield session

    headers = _auth_header(user)

    app.dependency_overrides[get_db] = _override_db
    try:
        yield TestClient(app), user, headers
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_http_unauthenticated_returns_401():
    res = client.get("/api/standalone/conversations")
    assert res.status_code == 401


def test_http_create_list_get_append_patch_delete(authenticated_api_client):
    api_client, _user, headers = authenticated_api_client
    client_id = f"http-chat-{uuid.uuid4().hex[:8]}"

    created = api_client.post(
        "/api/standalone/conversations",
        json={"clientConversationId": client_id, "title": "HTTP"},
        headers=headers,
    )
    assert created.status_code == 201
    conv = created.json()
    assert conv["clientConversationId"] == client_id
    assert "userId" not in conv
    assert "email" not in conv

    dup = api_client.post(
        "/api/standalone/conversations",
        json={"clientConversationId": client_id, "title": "HTTP"},
        headers=headers,
    )
    assert dup.status_code == 201
    assert dup.json()["id"] == conv["id"]

    listed = api_client.get("/api/standalone/conversations", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()["items"]) == 1

    conv_id = conv["id"]
    msg = api_client.post(
        f"/api/standalone/conversations/{conv_id}/messages",
        json={"clientMessageId": "hm1", "role": "user", "content": "selam"},
        headers=headers,
    )
    assert msg.status_code == 201
    assert msg.json()["sequence"] == 1

    detail = api_client.get(f"/api/standalone/conversations/{conv_id}", headers=headers)
    assert detail.status_code == 200
    assert len(detail.json()["messages"]) == 1

    patched = api_client.patch(
        f"/api/standalone/conversations/{conv_id}",
        json={"title": "Güncel"},
        headers=headers,
    )
    assert patched.status_code == 200
    assert patched.json()["title"] == "Güncel"

    deleted = api_client.delete(f"/api/standalone/conversations/{conv_id}", headers=headers)
    assert deleted.status_code == 204
    missing = api_client.get(f"/api/standalone/conversations/{conv_id}", headers=headers)
    assert missing.status_code == 404


def test_http_cross_user_get_patch_delete_append_return_404(authenticated_api_client):
    api_client, owner, owner_headers = authenticated_api_client
    intruder = _make_user(email="g881-intruder@example.test")
    intruder_headers = _auth_header(intruder)

    created = api_client.post(
        "/api/standalone/conversations",
        json={"clientConversationId": f"owned-{uuid.uuid4().hex[:6]}"},
        headers=owner_headers,
    )
    assert created.status_code == 201
    conv_id = created.json()["id"]

    assert (
        api_client.get(f"/api/standalone/conversations/{conv_id}", headers=intruder_headers).status_code
        == 404
    )
    assert (
        api_client.patch(
            f"/api/standalone/conversations/{conv_id}",
            json={"title": "x"},
            headers=intruder_headers,
        ).status_code
        == 404
    )
    assert (
        api_client.delete(f"/api/standalone/conversations/{conv_id}", headers=intruder_headers).status_code
        == 404
    )
    assert (
        api_client.post(
            f"/api/standalone/conversations/{conv_id}/messages",
            json={"clientMessageId": "z", "role": "user", "content": "x"},
            headers=intruder_headers,
        ).status_code
        == 404
    )
    # Owner still has access
    assert api_client.get(f"/api/standalone/conversations/{conv_id}", headers=owner_headers).status_code == 200


@patch("backend.main.assert_can_send_message", new_callable=AsyncMock)
def test_regression_standalone_stream_endpoint_unchanged(mock_guard):
    mock_guard.return_value = SimpleNamespace(tier="guest")
    from backend.security.rate_limit import rate_limit_standalone

    app.dependency_overrides[rate_limit_standalone] = lambda: None
    try:
        res = client.post(
            "/api/standalone/stream",
            json={"query": "merhaba"},
            headers={"X-Guest-Token": "guest-token-abcdefghijklmnop"},
        )
        assert res.status_code == 200
    finally:
        app.dependency_overrides.pop(rate_limit_standalone, None)
