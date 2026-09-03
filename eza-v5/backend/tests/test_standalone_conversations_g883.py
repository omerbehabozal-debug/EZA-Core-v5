# -*- coding: utf-8 -*-
"""Phase 8.8G-3 — legacy localStorage migration."""

from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from backend.core.schemas.standalone_conversations import (
    LegacyMigrationConversation,
    LegacyMigrationMessage,
    LegacyMigrationRequest,
    StandaloneConversationCreate,
    StandaloneConversationMessageCreate,
    StandaloneConversationPatch,
)
from backend.core.utils.dependencies import get_db
from backend.main import app
from backend.models.standalone_conversations import (
    StandaloneConversation,
    StandaloneConversationMessage,
    StandaloneYansiPreparation,
)
from backend.services.production_auth import create_access_token
from backend.services.standalone.conversations import (
    append_standalone_message,
    delete_standalone_conversation,
    get_standalone_conversation_detail,
    patch_standalone_conversation,
    upsert_standalone_conversation,
)
from backend.services.standalone.legacy_migration import (
    deterministic_legacy_message_id,
    migrate_legacy_conversations,
)


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


def _legacy_conv(
    client_id: str,
    *,
    title: str = "Eski sohbet",
    messages: list[tuple[str, str, int]] | None = None,
    tree_metadata=None,
    conversation_type: str | None = "direct",
):
    msgs = messages or [
        ("user", "Merhaba geçmiş", 0),
        ("assistant", "Merhaba, nasıl yardımcı olayım?", 1),
    ]
    return LegacyMigrationConversation(
        clientConversationId=client_id,
        title=title,
        titlePinned=False,
        conversationType=conversation_type,
        treeMetadata=tree_metadata,
        messages=[
            LegacyMigrationMessage(
                clientMessageId=f"{role}-{i}",
                role=role,  # type: ignore[arg-type]
                content=content,
                ordinal=i,
            )
            for role, content, i in msgs
        ],
    )


@pytest.mark.asyncio
async def test_local_only_imports_with_assistant(db_session):
    user_id = uuid.uuid4()
    req = LegacyMigrationRequest(conversations=[_legacy_conv("chat-legacy-1")])
    res = await migrate_legacy_conversations(db_session, user_id=user_id, request=req)
    assert res.results[0].status == "migrated"
    assert res.results[0].messageCount == 2

    detail = await get_standalone_conversation_detail(
        db_session,
        user_id=user_id,
        conversation_id=uuid.UUID(res.results[0].serverConversationId),
    )
    assert [m.role for m in detail.messages] == ["user", "assistant"]
    assert detail.messages[0].content == "Merhaba geçmiş"
    assert detail.title == "Eski sohbet"


@pytest.mark.asyncio
async def test_idempotent_double_migration(db_session):
    user_id = uuid.uuid4()
    req = LegacyMigrationRequest(conversations=[_legacy_conv("chat-idem")])
    first = await migrate_legacy_conversations(db_session, user_id=user_id, request=req)
    second = await migrate_legacy_conversations(db_session, user_id=user_id, request=req)
    assert first.results[0].status == "migrated"
    assert second.results[0].status == "already_server_authoritative"
    assert first.results[0].serverConversationId == second.results[0].serverConversationId

    rows = await db_session.execute(select(StandaloneConversationMessage))
    assert len(rows.scalars().all()) == 2


@pytest.mark.asyncio
async def test_existing_server_conversation_wins(db_session):
    user_id = uuid.uuid4()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(
            clientConversationId="chat-exists",
            title="Sunucu başlık",
            titlePinned=True,
        ),
    )
    await append_standalone_message(
        db_session,
        user_id=user_id,
        conversation_id=uuid.UUID(created.id),
        body=StandaloneConversationMessageCreate(
            clientMessageId="u1",
            role="user",
            content="Server message",
        ),
    )

    req = LegacyMigrationRequest(
        conversations=[
            _legacy_conv(
                "chat-exists",
                title="Local should not win",
                messages=[("user", "Local only", 0), ("assistant", "Local assistant", 1)],
            )
        ]
    )
    res = await migrate_legacy_conversations(db_session, user_id=user_id, request=req)
    assert res.results[0].status == "already_server_authoritative"

    detail = await get_standalone_conversation_detail(
        db_session, user_id=user_id, conversation_id=uuid.UUID(created.id)
    )
    assert detail.title == "Sunucu başlık"
    assert detail.titlePinned is True
    assert len(detail.messages) == 1
    assert detail.messages[0].content == "Server message"


@pytest.mark.asyncio
async def test_tombstoned_not_resurrected(db_session):
    user_id = uuid.uuid4()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(clientConversationId="chat-dead"),
    )
    await delete_standalone_conversation(
        db_session, user_id=user_id, conversation_id=uuid.UUID(created.id)
    )

    req = LegacyMigrationRequest(conversations=[_legacy_conv("chat-dead")])
    res = await migrate_legacy_conversations(db_session, user_id=user_id, request=req)
    assert res.results[0].status == "tombstoned"

    active = await db_session.execute(
        select(StandaloneConversation).where(
            StandaloneConversation.user_id == user_id,
            StandaloneConversation.client_conversation_id == "chat-dead",
            StandaloneConversation.deleted_at.is_(None),
        )
    )
    assert active.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_public_assistant_still_rejected_http(authenticated_api_client):
    api_client, _user, headers = authenticated_api_client
    created = api_client.post(
        "/api/standalone/conversations",
        json={"clientConversationId": "chat-live", "title": "T"},
        headers=headers,
    )
    conv_id = created.json()["id"]
    rejected = api_client.post(
        f"/api/standalone/conversations/{conv_id}/messages",
        json={
            "clientMessageId": "a1",
            "role": "assistant",
            "content": "Nope",
        },
        headers=headers,
    )
    assert rejected.status_code == 422
    assert rejected.json()["detail"] == "assistant_append_not_allowed"


def test_migration_http_accepts_historical_assistant(authenticated_api_client):
    api_client, _user, headers = authenticated_api_client
    res = api_client.post(
        "/api/standalone/conversations/migrate-legacy",
        json={
            "conversations": [
                {
                    "clientConversationId": "chat-http-mig",
                    "title": "Migrated",
                    "conversationType": "direct",
                    "messages": [
                        {
                            "clientMessageId": "u1",
                            "role": "user",
                            "content": "Hi",
                            "ordinal": 0,
                        },
                        {
                            "clientMessageId": "a1",
                            "role": "assistant",
                            "content": "Hello",
                            "ordinal": 1,
                        },
                    ],
                }
            ]
        },
        headers=headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["results"][0]["status"] == "migrated"
    assert body["results"][0]["messageCount"] == 2


@pytest.mark.asyncio
async def test_cross_user_isolation(db_session):
    owner = uuid.uuid4()
    intruder = uuid.uuid4()
    await migrate_legacy_conversations(
        db_session,
        user_id=owner,
        request=LegacyMigrationRequest(conversations=[_legacy_conv("chat-owned")]),
    )
    # Intruder migrating same client id creates their OWN conversation (different user scope)
    res = await migrate_legacy_conversations(
        db_session,
        user_id=intruder,
        request=LegacyMigrationRequest(conversations=[_legacy_conv("chat-owned")]),
    )
    assert res.results[0].status == "migrated"
    rows = await db_session.execute(select(StandaloneConversation))
    assert len(rows.scalars().all()) == 2


@pytest.mark.asyncio
async def test_secret_metadata_rejected(db_session):
    user_id = uuid.uuid4()
    req = LegacyMigrationRequest(
        conversations=[
            _legacy_conv(
                "chat-secret",
                tree_metadata={"lineageProofToken": "secret-proof-value"},
            )
        ]
    )
    res = await migrate_legacy_conversations(db_session, user_id=user_id, request=req)
    assert res.results[0].status == "rejected_invalid"
    assert "forbidden" in (res.results[0].reason or "")


@pytest.mark.asyncio
async def test_message_order_and_deterministic_ids(db_session):
    user_id = uuid.uuid4()
    messages = [
        LegacyMigrationMessage(role="user", content="A", ordinal=0),
        LegacyMigrationMessage(role="assistant", content="B", ordinal=1),
        LegacyMigrationMessage(role="user", content="C", ordinal=2),
    ]
    # Shuffle payload order — ordinals define order
    shuffled = [messages[2], messages[0], messages[1]]
    conv = LegacyMigrationConversation(
        clientConversationId="chat-order",
        title="Order",
        messages=shuffled,
    )
    res = await migrate_legacy_conversations(
        db_session,
        user_id=user_id,
        request=LegacyMigrationRequest(conversations=[conv]),
    )
    assert res.results[0].status == "migrated"
    detail = await get_standalone_conversation_detail(
        db_session,
        user_id=user_id,
        conversation_id=uuid.UUID(res.results[0].serverConversationId),
    )
    assert [m.content for m in detail.messages] == ["A", "B", "C"]
    assert [m.sequence for m in detail.messages] == [1, 2, 3]

    expected_id = deterministic_legacy_message_id("chat-order", 0, "user", "A")
    assert detail.messages[0].clientMessageId == expected_id


@pytest.mark.asyncio
async def test_deterministic_ids_stable_across_retries_concept(db_session):
    a = deterministic_legacy_message_id("chat-x", 1, "assistant", "Hello")
    b = deterministic_legacy_message_id("chat-x", 1, "assistant", "Hello")
    c = deterministic_legacy_message_id("chat-x", 1, "assistant", "Hello!")
    assert a == b
    assert a != c


@pytest.mark.asyncio
async def test_unknown_type_rejected(db_session):
    user_id = uuid.uuid4()
    res = await migrate_legacy_conversations(
        db_session,
        user_id=user_id,
        request=LegacyMigrationRequest(
            conversations=[_legacy_conv("chat-bad-type", conversation_type="wizard")]
        ),
    )
    assert res.results[0].status == "rejected_invalid"
    assert res.results[0].reason == "unknown_conversation_type"


@pytest.mark.asyncio
async def test_existing_title_not_overwritten(db_session):
    user_id = uuid.uuid4()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(
            clientConversationId="chat-title",
            title="Pinned server",
            titlePinned=True,
        ),
    )
    await patch_standalone_conversation(
        db_session,
        user_id=user_id,
        conversation_id=uuid.UUID(created.id),
        body=StandaloneConversationPatch(title="Pinned server", titlePinned=True),
    )
    res = await migrate_legacy_conversations(
        db_session,
        user_id=user_id,
        request=LegacyMigrationRequest(
            conversations=[_legacy_conv("chat-title", title="Local title")]
        ),
    )
    assert res.results[0].status == "already_server_authoritative"
    detail = await get_standalone_conversation_detail(
        db_session, user_id=user_id, conversation_id=uuid.UUID(created.id)
    )
    assert detail.title == "Pinned server"


def test_oversized_batch_rejected_http(authenticated_api_client):
    api_client, _user, headers = authenticated_api_client
    conversations = [
        {
            "clientConversationId": f"chat-{i}",
            "messages": [
                {"role": "user", "content": "x", "ordinal": 0},
            ],
        }
        for i in range(31)
    ]
    res = api_client.post(
        "/api/standalone/conversations/migrate-legacy",
        json={"conversations": conversations},
        headers=headers,
    )
    assert res.status_code == 422

@pytest.mark.asyncio
async def test_duplicate_explicit_client_message_id_rejected(db_session):
    user_id = uuid.uuid4()
    conv = LegacyMigrationConversation(
        clientConversationId='chat-dup-id',
        title='Dup',
        messages=[
            LegacyMigrationMessage(
                clientMessageId='same-id',
                role='user',
                content='A',
                ordinal=0,
            ),
            LegacyMigrationMessage(
                clientMessageId='same-id',
                role='assistant',
                content='B',
                ordinal=1,
            ),
        ],
    )
    res = await migrate_legacy_conversations(
        db_session,
        user_id=user_id,
        request=LegacyMigrationRequest(conversations=[conv]),
    )
    assert res.results[0].status == 'rejected_invalid'
    assert res.results[0].reason == 'duplicate_client_message_id'
    rows = await db_session.execute(select(StandaloneConversation))
    assert rows.scalars().all() == []
    msgs = await db_session.execute(select(StandaloneConversationMessage))
    assert msgs.scalars().all() == []


@pytest.mark.asyncio
async def test_duplicate_same_content_explicit_id_rejected(db_session):
    user_id = uuid.uuid4()
    conv = LegacyMigrationConversation(
        clientConversationId='chat-dup-same',
        title='DupSame',
        messages=[
            LegacyMigrationMessage(
                clientMessageId='same-id',
                role='user',
                content='A',
                ordinal=0,
            ),
            LegacyMigrationMessage(
                clientMessageId='same-id',
                role='user',
                content='A',
                ordinal=1,
            ),
        ],
    )
    res = await migrate_legacy_conversations(
        db_session,
        user_id=user_id,
        request=LegacyMigrationRequest(conversations=[conv]),
    )
    assert res.results[0].status == 'rejected_invalid'
    assert res.results[0].reason == 'duplicate_client_message_id'


@pytest.mark.asyncio
async def test_server_wins_before_local_duplicate_invalid(db_session):
    user_id = uuid.uuid4()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(
            clientConversationId='chat-server-first',
            title='Server OK',
        ),
    )
    await append_standalone_message(
        db_session,
        user_id=user_id,
        conversation_id=uuid.UUID(created.id),
        body=StandaloneConversationMessageCreate(
            clientMessageId='srv-u1',
            role='user',
            content='Server only',
        ),
    )
    conv = LegacyMigrationConversation(
        clientConversationId='chat-server-first',
        title='Local bad',
        messages=[
            LegacyMigrationMessage(
                clientMessageId='dup',
                role='user',
                content='A',
                ordinal=0,
            ),
            LegacyMigrationMessage(
                clientMessageId='dup',
                role='assistant',
                content='B',
                ordinal=1,
            ),
        ],
    )
    res = await migrate_legacy_conversations(
        db_session,
        user_id=user_id,
        request=LegacyMigrationRequest(conversations=[conv]),
    )
    assert res.results[0].status == 'already_server_authoritative'
    detail = await get_standalone_conversation_detail(
        db_session, user_id=user_id, conversation_id=uuid.UUID(created.id)
    )
    assert detail.title == 'Server OK'
    assert len(detail.messages) == 1


@pytest.mark.asyncio
async def test_tombstone_wins_over_local_duplicate_invalid(db_session):
    user_id = uuid.uuid4()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(clientConversationId='chat-tomb-dup'),
    )
    await delete_standalone_conversation(
        db_session, user_id=user_id, conversation_id=uuid.UUID(created.id)
    )
    conv = LegacyMigrationConversation(
        clientConversationId='chat-tomb-dup',
        messages=[
            LegacyMigrationMessage(
                clientMessageId='x',
                role='user',
                content='A',
                ordinal=0,
            ),
            LegacyMigrationMessage(
                clientMessageId='x',
                role='assistant',
                content='B',
                ordinal=1,
            ),
        ],
    )
    res = await migrate_legacy_conversations(
        db_session,
        user_id=user_id,
        request=LegacyMigrationRequest(conversations=[conv]),
    )
    assert res.results[0].status == 'tombstoned'


@pytest.mark.asyncio
async def test_all_whitespace_messages_empty_transcript(db_session):
    user_id = uuid.uuid4()
    conv = LegacyMigrationConversation(
        clientConversationId='chat-ws',
        title='Whitespace',
        messages=[
            LegacyMigrationMessage(role='user', content='   ', ordinal=0),
            LegacyMigrationMessage(role='assistant', content='\n\t', ordinal=1),
        ],
    )
    res = await migrate_legacy_conversations(
        db_session,
        user_id=user_id,
        request=LegacyMigrationRequest(conversations=[conv]),
    )
    assert res.results[0].status == 'empty_transcript'
    rows = await db_session.execute(select(StandaloneConversation))
    assert rows.scalars().all() == []


@pytest.mark.asyncio
async def test_mixed_empty_preserves_original_ordinal_in_ids(db_session):
    user_id = uuid.uuid4()
    conv = LegacyMigrationConversation(
        clientConversationId='chat-mixed-empty',
        title='Mixed',
        messages=[
            LegacyMigrationMessage(role='user', content='Hello', ordinal=0),
            LegacyMigrationMessage(role='assistant', content='   ', ordinal=1),
            LegacyMigrationMessage(role='user', content='Question', ordinal=2),
        ],
    )
    res = await migrate_legacy_conversations(
        db_session,
        user_id=user_id,
        request=LegacyMigrationRequest(conversations=[conv]),
    )
    assert res.results[0].status == 'migrated'
    detail = await get_standalone_conversation_detail(
        db_session,
        user_id=user_id,
        conversation_id=uuid.UUID(res.results[0].serverConversationId),
    )
    assert [m.content for m in detail.messages] == ['Hello', 'Question']
    assert [m.sequence for m in detail.messages] == [1, 2]
    assert detail.messages[0].clientMessageId == deterministic_legacy_message_id(
        'chat-mixed-empty', 0, 'user', 'Hello'
    )
    assert detail.messages[1].clientMessageId == deterministic_legacy_message_id(
        'chat-mixed-empty', 2, 'user', 'Question'
    )
