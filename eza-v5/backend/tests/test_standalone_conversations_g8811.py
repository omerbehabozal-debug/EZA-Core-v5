# -*- coding: utf-8 -*-
"""Phase 8.8G-1.1 — standalone conversation persistence remediation."""

from __future__ import annotations

import uuid
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from backend.core.schemas.standalone_conversations import (
    StandaloneConversationCreate,
    StandaloneConversationMessageCreate,
    StandaloneConversationPatch,
)
from backend.core.utils.dependencies import get_db
from backend.main import app
from backend.models.institution import Institution  # noqa: F401
from backend.models.role import Role  # noqa: F401
from backend.models.user import LegacyUser  # noqa: F401
from backend.models.standalone_conversations import (
    StandaloneConversation,
    StandaloneConversationMessage,
)
from backend.services.production_auth import create_access_token
from backend.services.standalone.conversations import (
    StandaloneConversationNotFoundError,
    delete_standalone_conversation,
    get_standalone_conversation_detail,
    list_standalone_conversations,
    patch_standalone_conversation,
    upsert_standalone_conversation,
)
from backend.services.standalone.metadata_security import (
    find_forbidden_metadata_key,
    reject_forbidden_metadata,
)
from backend.services.standalone.persistence_limits import (
    MAX_MESSAGE_CONTENT_LENGTH,
    MAX_METADATA_DEPTH,
    MAX_METADATA_JSON_BYTES,
    validate_bounded_json,
)

MIGRATION_G8811_PATH = (
    Path(__file__).resolve().parents[1]
    / "migrations"
    / "versions"
    / "add_standalone_conversations_g8811_v1.py"
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
    yield engine
    await engine.dispose()


@pytest.fixture
async def db_session(db_engine):
    Session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session


async def _seed_user_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def authenticated_api_client(db_engine):
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


def test_g8811_migration_head_and_check_constraints():
    src = MIGRATION_G8811_PATH.read_text(encoding="utf-8")
    assert 'revision: str = "add_standalone_conversations_g8811_v1"' in src
    assert 'down_revision: Union[str, None] = "add_standalone_conversations_g881_v1"' in src
    assert "ck_standalone_conversations_type" in src
    assert "ck_standalone_conversation_messages_role" in src


@pytest.mark.asyncio
async def test_archive_restore_cycle(db_session):
    user_id = await _seed_user_id()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(clientConversationId="archive-restore"),
    )
    conv_id = uuid.UUID(created.id)

    await patch_standalone_conversation(
        db_session,
        user_id=user_id,
        conversation_id=conv_id,
        body=StandaloneConversationPatch(archived=True),
    )
    assert await list_standalone_conversations(db_session, user_id=user_id) == []
    with pytest.raises(StandaloneConversationNotFoundError):
        await get_standalone_conversation_detail(db_session, user_id=user_id, conversation_id=conv_id)

    restored = await patch_standalone_conversation(
        db_session,
        user_id=user_id,
        conversation_id=conv_id,
        body=StandaloneConversationPatch(archived=False),
    )
    assert restored.archived is False
    assert len(await list_standalone_conversations(db_session, user_id=user_id)) == 1
    detail = await get_standalone_conversation_detail(db_session, user_id=user_id, conversation_id=conv_id)
    assert detail.clientConversationId == "archive-restore"


@pytest.mark.asyncio
async def test_foreign_user_cannot_restore_archived_conversation(db_session):
    owner = await _seed_user_id()
    intruder = await _seed_user_id()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=owner,
        body=StandaloneConversationCreate(clientConversationId="owned-archived"),
    )
    conv_id = uuid.UUID(created.id)
    await patch_standalone_conversation(
        db_session,
        user_id=owner,
        conversation_id=conv_id,
        body=StandaloneConversationPatch(archived=True),
    )
    with pytest.raises(StandaloneConversationNotFoundError):
        await patch_standalone_conversation(
            db_session,
            user_id=intruder,
            conversation_id=conv_id,
            body=StandaloneConversationPatch(archived=False),
        )


@pytest.mark.asyncio
async def test_deleted_conversation_cannot_restore_via_archive_false(db_session):
    user_id = await _seed_user_id()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(clientConversationId="deleted-restore"),
    )
    conv_id = uuid.UUID(created.id)
    await patch_standalone_conversation(
        db_session,
        user_id=user_id,
        conversation_id=conv_id,
        body=StandaloneConversationPatch(archived=True),
    )
    await delete_standalone_conversation(db_session, user_id=user_id, conversation_id=conv_id)
    with pytest.raises(StandaloneConversationNotFoundError):
        await patch_standalone_conversation(
            db_session,
            user_id=user_id,
            conversation_id=conv_id,
            body=StandaloneConversationPatch(archived=False),
        )


def test_http_archive_restore_flow(authenticated_api_client):
    api_client, _user, headers = authenticated_api_client
    created = api_client.post(
        "/api/standalone/conversations",
        json={"clientConversationId": f"restore-{uuid.uuid4().hex[:6]}"},
        headers=headers,
    )
    assert created.status_code == 201
    conv_id = created.json()["id"]

    archived = api_client.patch(
        f"/api/standalone/conversations/{conv_id}",
        json={"archived": True},
        headers=headers,
    )
    assert archived.status_code == 200
    assert archived.json()["archived"] is True
    assert api_client.get("/api/standalone/conversations", headers=headers).json() == []
    assert api_client.get(f"/api/standalone/conversations/{conv_id}", headers=headers).status_code == 404

    restored = api_client.patch(
        f"/api/standalone/conversations/{conv_id}",
        json={"archived": False},
        headers=headers,
    )
    assert restored.status_code == 200
    assert restored.json()["archived"] is False
    assert len(api_client.get("/api/standalone/conversations", headers=headers).json()) == 1
    assert api_client.get(f"/api/standalone/conversations/{conv_id}", headers=headers).status_code == 200


@pytest.mark.parametrize(
    "payload",
    [
        {"lineageProofToken": "secret"},
        {"nested": {"continuationProofToken": "secret"}},
        {"items": [{"bearerToken": "secret"}]},
        {"session-credentials": {"authorization": "secret"}},
    ],
)
def test_forbidden_metadata_keys_are_detected(payload):
    assert find_forbidden_metadata_key(payload) is not None


def test_reject_forbidden_metadata_raises_422():
    with pytest.raises(HTTPException) as exc:
        reject_forbidden_metadata({"lineageProofToken": "must-not-log"}, field_name="tree_metadata")
    assert exc.value.status_code == 422
    assert exc.value.detail == "forbidden_tree_metadata_key"


def test_schema_rejects_nested_lineage_proof_token():
    with pytest.raises(HTTPException) as exc:
        reject_forbidden_metadata(
            {"nested": {"lineageProofToken": "super-secret-proof-value"}},
            field_name="tree_metadata",
        )
    assert exc.value.detail == "forbidden_tree_metadata_key"


def test_create_rejects_lineage_proof_token_schema():
    with pytest.raises(HTTPException) as exc:
        reject_forbidden_metadata({"lineageProofToken": "secret-value"}, field_name="tree_metadata")
    assert exc.value.detail == "forbidden_tree_metadata_key"


@pytest.mark.asyncio
async def test_upsert_rejects_forbidden_tree_metadata(db_session):
    user_id = await _seed_user_id()
    with pytest.raises(HTTPException) as exc:
        await upsert_standalone_conversation(
            db_session,
            user_id=user_id,
            body=StandaloneConversationCreate(
                clientConversationId="reject-upsert",
                treeMetadata={"lineageProofToken": "secret-value"},
            ),
        )
    assert exc.value.detail == "forbidden_tree_metadata_key"


@pytest.mark.asyncio
async def test_legitimate_tree_metadata_persists(db_session):
    user_id = await _seed_user_id()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(
            clientConversationId="safe-meta",
            treeMetadata={
                "sourceType": "mirror_branch",
                "branchTitle": "Yerel kafeler",
                "parentConversationId": "parent-client",
            },
        ),
    )
    conv_id = uuid.UUID(created.id)
    detail = await get_standalone_conversation_detail(
        db_session, user_id=user_id, conversation_id=conv_id
    )
    assert detail.clientConversationId == "safe-meta"


def test_http_rejects_forbidden_tree_metadata(authenticated_api_client):
    api_client, _user, headers = authenticated_api_client
    res = api_client.post(
        "/api/standalone/conversations",
        json={
            "clientConversationId": f"meta-{uuid.uuid4().hex[:6]}",
            "treeMetadata": {"lineageProofToken": "secret-value"},
        },
        headers=headers,
    )
    assert res.status_code == 422
    assert res.json()["detail"] == "forbidden_tree_metadata_key"
    assert "secret-value" not in res.text


def test_http_rejects_forbidden_message_metadata(authenticated_api_client):
    api_client, _user, headers = authenticated_api_client
    created = api_client.post(
        "/api/standalone/conversations",
        json={"clientConversationId": f"msg-meta-{uuid.uuid4().hex[:6]}"},
        headers=headers,
    )
    conv_id = created.json()["id"]
    res = api_client.post(
        f"/api/standalone/conversations/{conv_id}/messages",
        json={
            "clientMessageId": "m1",
            "role": "user",
            "content": "hello",
            "metadata": {"authToken": "secret"},
        },
        headers=headers,
    )
    assert res.status_code == 422
    assert res.json()["detail"] == "forbidden_message_metadata_key"
    assert "secret" not in res.text


def test_normal_message_content_accepted():
    body = StandaloneConversationMessageCreate(
        clientMessageId="ok",
        role="user",
        content="x" * 1000,
    )
    assert len(body.content) == 1000


def test_oversized_message_rejected():
    with pytest.raises(ValidationError):
        StandaloneConversationMessageCreate(
            clientMessageId="big",
            role="user",
            content="x" * (MAX_MESSAGE_CONTENT_LENGTH + 1),
        )


def test_oversized_metadata_rejected():
    huge = {"k": "x" * (MAX_METADATA_JSON_BYTES + 100)}
    with pytest.raises(HTTPException) as exc:
        validate_bounded_json(huge, field_name="message_metadata")
    assert exc.value.detail == "message_metadata_size_exceeded"


def test_excessive_metadata_depth_rejected():
    nested: dict = {}
    cursor = nested
    for _ in range(MAX_METADATA_DEPTH + 2):
        cursor["child"] = {}
        cursor = cursor["child"]
    with pytest.raises(HTTPException) as exc:
        validate_bounded_json(nested, field_name="tree_metadata")
    assert exc.value.detail == "tree_metadata_depth_exceeded"


def test_normal_metadata_accepted():
    validate_bounded_json({"sourceType": "mirror", "branchTitle": "ok"}, field_name="tree_metadata")


def test_http_rejects_oversized_message(authenticated_api_client):
    api_client, _user, headers = authenticated_api_client
    created = api_client.post(
        "/api/standalone/conversations",
        json={"clientConversationId": f"big-msg-{uuid.uuid4().hex[:6]}"},
        headers=headers,
    )
    conv_id = created.json()["id"]
    res = api_client.post(
        f"/api/standalone/conversations/{conv_id}/messages",
        json={
            "clientMessageId": "big",
            "role": "user",
            "content": "x" * (MAX_MESSAGE_CONTENT_LENGTH + 1),
        },
        headers=headers,
    )
    assert res.status_code == 422


def test_http_malformed_conversation_uuid_returns_422(authenticated_api_client):
    api_client, _user, headers = authenticated_api_client
    res = api_client.get("/api/standalone/conversations/not-a-uuid", headers=headers)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_db_rejects_invalid_conversation_type(db_session):
    row = StandaloneConversation(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        client_conversation_id="bad-type",
        conversation_type="evil",
    )
    db_session.add(row)
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


@pytest.mark.asyncio
async def test_db_rejects_invalid_message_role(db_session):
    conv = StandaloneConversation(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        client_conversation_id="host",
        conversation_type="direct",
    )
    db_session.add(conv)
    await db_session.commit()

    row = StandaloneConversationMessage(
        id=uuid.uuid4(),
        conversation_id=conv.id,
        client_message_id="m1",
        role="system",
        content="hello",
        sequence=1,
    )
    db_session.add(row)
    with pytest.raises(IntegrityError):
        await db_session.commit()


@pytest.mark.asyncio
async def test_continuation_lineage_without_proof_authority(db_session):
    user_id = await _seed_user_id()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(
            clientConversationId="cont-lineage",
            conversationType="continuation",
            sourceYansiSlug="published-yansi",
            parentClientConversationId="parent-client",
            treeMetadata={"sourceType": "mirror", "startedFromMirrorId": "child-slug"},
        ),
    )
    assert created.conversationType == "continuation"
    assert created.sourceYansiSlug == "published-yansi"
