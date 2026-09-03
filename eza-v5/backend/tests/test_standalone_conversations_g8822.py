# -*- coding: utf-8 -*-
"""Phase 8.8G-2.2 — title CAS + ownership for initializeTitleOnly."""

from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from backend.core.schemas.standalone_conversations import (
    StandaloneConversationCreate,
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
    DEFAULT_UNINITIALIZED_TITLE,
    StandaloneConversationNotFoundError,
    patch_standalone_conversation,
    upsert_standalone_conversation,
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
        yield TestClient(app), user, headers, Session
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_initialize_title_succeeds_on_default_unpinned(db_session):
    user_id = uuid.uuid4()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(
            clientConversationId="chat-auto",
            title=DEFAULT_UNINITIALIZED_TITLE,
        ),
    )
    conv_id = uuid.UUID(created.id)

    updated = await patch_standalone_conversation(
        db_session,
        user_id=user_id,
        conversation_id=conv_id,
        body=StandaloneConversationPatch(
            title="Kyoto akşamları",
            initializeTitleOnly=True,
        ),
    )
    assert updated.title == "Kyoto akşamları"
    assert updated.titlePinned is False


@pytest.mark.asyncio
async def test_manual_rename_wins_over_delayed_initialize_title(db_session):
    user_id = uuid.uuid4()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(
            clientConversationId="chat-race",
            title=DEFAULT_UNINITIALIZED_TITLE,
        ),
    )
    conv_id = uuid.UUID(created.id)

    manual = await patch_standalone_conversation(
        db_session,
        user_id=user_id,
        conversation_id=conv_id,
        body=StandaloneConversationPatch(
            title="Kadıköy zemin taşlarının değerlendirilmesi",
            titlePinned=True,
        ),
    )
    assert manual.title == "Kadıköy zemin taşlarının değerlendirilmesi"
    assert manual.titlePinned is True

    delayed = await patch_standalone_conversation(
        db_session,
        user_id=user_id,
        conversation_id=conv_id,
        body=StandaloneConversationPatch(
            title="Otomatik türetilmiş başlık",
            initializeTitleOnly=True,
        ),
    )
    assert delayed.title == "Kadıköy zemin taşlarının değerlendirilmesi"
    assert delayed.titlePinned is True


@pytest.mark.asyncio
async def test_initialize_title_noop_when_pinned(db_session):
    user_id = uuid.uuid4()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(
            clientConversationId="chat-pinned",
            title=DEFAULT_UNINITIALIZED_TITLE,
            titlePinned=True,
        ),
    )
    conv_id = uuid.UUID(created.id)

    result = await patch_standalone_conversation(
        db_session,
        user_id=user_id,
        conversation_id=conv_id,
        body=StandaloneConversationPatch(
            title="Should not apply",
            initializeTitleOnly=True,
        ),
    )
    assert result.title == DEFAULT_UNINITIALIZED_TITLE
    assert result.titlePinned is True


@pytest.mark.asyncio
async def test_initialize_title_noop_when_non_default(db_session):
    user_id = uuid.uuid4()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(
            clientConversationId="chat-nondflt",
            title="Existing meaningful",
        ),
    )
    conv_id = uuid.UUID(created.id)

    result = await patch_standalone_conversation(
        db_session,
        user_id=user_id,
        conversation_id=conv_id,
        body=StandaloneConversationPatch(
            title="Auto override attempt",
            initializeTitleOnly=True,
        ),
    )
    assert result.title == "Existing meaningful"
    assert result.titlePinned is False


@pytest.mark.asyncio
async def test_initialize_title_cross_user_inaccessible(db_session):
    owner = uuid.uuid4()
    intruder = uuid.uuid4()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=owner,
        body=StandaloneConversationCreate(
            clientConversationId="chat-owned",
            title=DEFAULT_UNINITIALIZED_TITLE,
        ),
    )
    conv_id = uuid.UUID(created.id)

    with pytest.raises(StandaloneConversationNotFoundError):
        await patch_standalone_conversation(
            db_session,
            user_id=intruder,
            conversation_id=conv_id,
            body=StandaloneConversationPatch(
                title="Hijack",
                initializeTitleOnly=True,
            ),
        )


def test_http_initialize_title_only_exclusive_and_owned(authenticated_api_client):
    api_client, _user, headers, _Session = authenticated_api_client
    created = api_client.post(
        "/api/standalone/conversations",
        json={"clientConversationId": "chat-http-cas", "title": "Yeni sohbet"},
        headers=headers,
    )
    assert created.status_code == 201
    conv_id = created.json()["id"]

    exclusive = api_client.patch(
        f"/api/standalone/conversations/{conv_id}",
        json={
            "title": "Auto",
            "initializeTitleOnly": True,
            "titlePinned": True,
        },
        headers=headers,
    )
    assert exclusive.status_code == 422

    ok = api_client.patch(
        f"/api/standalone/conversations/{conv_id}",
        json={"title": "Auto title", "initializeTitleOnly": True},
        headers=headers,
    )
    assert ok.status_code == 200
    assert ok.json()["title"] == "Auto title"

    other = _make_user()
    other_headers = _auth_header(other)
    denied = api_client.patch(
        f"/api/standalone/conversations/{conv_id}",
        json={"title": "Nope", "initializeTitleOnly": True},
        headers=other_headers,
    )
    assert denied.status_code == 404
