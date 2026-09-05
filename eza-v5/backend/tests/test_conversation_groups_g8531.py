# -*- coding: utf-8 -*-
"""Phase 8.8G-5.3.1 — authenticated conversation group authority + ownership."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from backend.core.schemas.conversation_tree import (
    ConversationGroupCreate,
    ConversationGroupPatch,
)
from backend.core.schemas.standalone_conversations import (
    LegacyMigrationConversation,
    LegacyMigrationMessage,
    LegacyMigrationRequest,
    StandaloneConversationCreate,
    StandaloneConversationPatch,
)
from backend.models.institution import Institution  # noqa: F401
from backend.models.role import Role  # noqa: F401
from backend.models.user import LegacyUser  # noqa: F401
from backend.models.conversation_groups import ConversationGroup
from backend.models.standalone_conversations import (
    StandaloneConversation,
    StandaloneConversationMessage,
    StandaloneYansiPreparation,
)
from backend.services.conversation_tree.groups import (
    ConversationGroupNotFoundError,
    delete_conversation_group,
    fetch_conversation_groups,
    patch_conversation_group,
    persist_conversation_group,
)
from backend.services.standalone.conversations import (
    patch_standalone_conversation,
    upsert_standalone_conversation,
)
from backend.services.standalone.legacy_migration import migrate_legacy_conversations
from backend.migrations.alembic_version_capacity import HEAD_REVISION


@compiles(PGUUID, "sqlite")
def _compile_uuid_sqlite(_type, _compiler, **_kw):
    return "CHAR(36)"


@pytest.fixture
async def db_engine():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.execute(text("PRAGMA foreign_keys=OFF"))
        await conn.run_sync(ConversationGroup.__table__.create)
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


def _legacy_conv(client_id: str, *, group_id: str | None = None):
    return LegacyMigrationConversation(
        clientConversationId=client_id,
        title="Eski",
        conversationType="direct",
        groupId=group_id,
        messages=[
            LegacyMigrationMessage(
                clientMessageId="u0", role="user", content="Merhaba", ordinal=0
            ),
            LegacyMigrationMessage(
                clientMessageId="a1", role="assistant", content="Selam", ordinal=1
            ),
        ],
    )


@pytest.mark.asyncio
async def test_authenticated_create_binds_current_user(db_session):
    user_a = uuid.uuid4()
    row = await persist_conversation_group(
        db_session,
        ConversationGroupCreate(title="Mardin", source="manual"),
        user_id=user_a,
    )
    assert row.user_id == user_a
    assert row.guest_token is None
    assert row.title == "Mardin"


@pytest.mark.asyncio
async def test_list_excludes_other_user(db_session):
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()
    await persist_conversation_group(
        db_session, ConversationGroupCreate(title="A"), user_id=user_a
    )
    await persist_conversation_group(
        db_session, ConversationGroupCreate(title="B"), user_id=user_b
    )
    listed = await fetch_conversation_groups(db_session, user_id=user_a)
    assert [g.title for g in listed] == ["A"]


@pytest.mark.asyncio
async def test_client_group_id_idempotent_same_user(db_session):
    user_a = uuid.uuid4()
    body = ConversationGroupCreate(
        title="Keşiflerim",
        source="manual",
        clientGroupId="group-1710000000-abc123",
    )
    first = await persist_conversation_group(db_session, body, user_id=user_a)
    second = await persist_conversation_group(db_session, body, user_id=user_a)
    assert first.id == second.id
    rows = await db_session.execute(
        select(ConversationGroup).where(ConversationGroup.user_id == user_a)
    )
    assert len(rows.scalars().all()) == 1


@pytest.mark.asyncio
async def test_same_client_group_id_different_users(db_session):
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()
    cid = "group-shared-local-id"
    a = await persist_conversation_group(
        db_session,
        ConversationGroupCreate(title="A", clientGroupId=cid),
        user_id=user_a,
    )
    b = await persist_conversation_group(
        db_session,
        ConversationGroupCreate(title="B", clientGroupId=cid),
        user_id=user_b,
    )
    assert a.id != b.id
    assert a.client_group_id == cid
    assert b.client_group_id == cid


@pytest.mark.asyncio
async def test_client_group_id_integrity_reread(db_session):
    """Simulated race: pre-insert then upsert returns existing."""
    user_a = uuid.uuid4()
    cid = "group-race-1"
    existing = ConversationGroup(
        user_id=user_a,
        title="Existing",
        source="manual",
        client_group_id=cid,
        sort_order=1,
    )
    db_session.add(existing)
    await db_session.commit()
    await db_session.refresh(existing)

    got = await persist_conversation_group(
        db_session,
        ConversationGroupCreate(title="Newer", clientGroupId=cid),
        user_id=user_a,
    )
    assert got.id == existing.id
    assert got.title == "Existing"


@pytest.mark.asyncio
async def test_rename_own_group(db_session):
    user_a = uuid.uuid4()
    row = await persist_conversation_group(
        db_session, ConversationGroupCreate(title="Old"), user_id=user_a
    )
    patched = await patch_conversation_group(
        db_session,
        user_id=user_a,
        group_id=row.id,
        body=ConversationGroupPatch(title="New"),
    )
    assert patched.title == "New"


@pytest.mark.asyncio
async def test_rename_other_user_not_found(db_session):
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()
    row = await persist_conversation_group(
        db_session, ConversationGroupCreate(title="Secret"), user_id=user_b
    )
    with pytest.raises(ConversationGroupNotFoundError):
        await patch_conversation_group(
            db_session,
            user_id=user_a,
            group_id=row.id,
            body=ConversationGroupPatch(title="Hijack"),
        )


@pytest.mark.asyncio
async def test_delete_group_nulls_membership_keeps_conversation(db_session):
    user_a = uuid.uuid4()
    group = await persist_conversation_group(
        db_session, ConversationGroupCreate(title="Folder"), user_id=user_a
    )
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_a,
        body=StandaloneConversationCreate(
            clientConversationId="chat-1",
            title="Keep me",
            conversationType="direct",
            groupId=str(group.id),
        ),
    )
    assert created.groupId == str(group.id)

    await delete_conversation_group(db_session, user_id=user_a, group_id=group.id)

    conv = (
        await db_session.execute(
            select(StandaloneConversation).where(
                StandaloneConversation.id == uuid.UUID(created.id)
            )
        )
    ).scalar_one()
    assert conv.group_id is None
    assert conv.deleted_at is None
    assert conv.title == "Keep me"

    groups_left = await fetch_conversation_groups(db_session, user_id=user_a)
    assert groups_left == []


@pytest.mark.asyncio
async def test_delete_other_user_group_no_mutation(db_session):
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()
    group = await persist_conversation_group(
        db_session, ConversationGroupCreate(title="B"), user_id=user_b
    )
    with pytest.raises(ConversationGroupNotFoundError):
        await delete_conversation_group(db_session, user_id=user_a, group_id=group.id)
    still = (
        await db_session.execute(
            select(ConversationGroup).where(ConversationGroup.id == group.id)
        )
    ).scalar_one_or_none()
    assert still is not None


@pytest.mark.asyncio
async def test_assign_and_ungroup_own_conversation(db_session):
    user_a = uuid.uuid4()
    group = await persist_conversation_group(
        db_session, ConversationGroupCreate(title="G"), user_id=user_a
    )
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_a,
        body=StandaloneConversationCreate(
            clientConversationId="c-assign",
            conversationType="direct",
        ),
    )
    assert created.groupId is None

    patched = await patch_standalone_conversation(
        db_session,
        user_id=user_a,
        conversation_id=uuid.UUID(created.id),
        body=StandaloneConversationPatch(groupId=str(group.id)),
    )
    assert patched.groupId == str(group.id)

    ungrouped = await patch_standalone_conversation(
        db_session,
        user_id=user_a,
        conversation_id=uuid.UUID(created.id),
        body=StandaloneConversationPatch(groupId=None),
    )
    assert ungrouped.groupId is None


@pytest.mark.asyncio
async def test_assign_own_conversation_to_other_group_404(db_session):
    from fastapi import HTTPException

    user_a = uuid.uuid4()
    user_b = uuid.uuid4()
    b_group = await persist_conversation_group(
        db_session, ConversationGroupCreate(title="B"), user_id=user_b
    )
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_a,
        body=StandaloneConversationCreate(
            clientConversationId="c-cross",
            conversationType="direct",
        ),
    )
    with pytest.raises(HTTPException) as exc:
        await patch_standalone_conversation(
            db_session,
            user_id=user_a,
            conversation_id=uuid.UUID(created.id),
            body=StandaloneConversationPatch(groupId=str(b_group.id)),
        )
    assert exc.value.status_code == 404
    row = (
        await db_session.execute(
            select(StandaloneConversation).where(
                StandaloneConversation.id == uuid.UUID(created.id)
            )
        )
    ).scalar_one()
    assert row.group_id is None


@pytest.mark.asyncio
async def test_create_malformed_group_id_still_creates(db_session):
    user_a = uuid.uuid4()
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_a,
        body=StandaloneConversationCreate(
            clientConversationId="c-bad",
            conversationType="direct",
            groupId="group-local-not-uuid",
        ),
    )
    assert created.id
    assert created.groupId is None


@pytest.mark.asyncio
async def test_create_unauthorized_valid_group_id_soft_null(db_session):
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()
    b_group = await persist_conversation_group(
        db_session, ConversationGroupCreate(title="B"), user_id=user_b
    )
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_a,
        body=StandaloneConversationCreate(
            clientConversationId="c-unauth",
            conversationType="direct",
            groupId=str(b_group.id),
        ),
    )
    assert created.id
    assert created.groupId is None


@pytest.mark.asyncio
async def test_create_owned_group_id_stored(db_session):
    user_a = uuid.uuid4()
    group = await persist_conversation_group(
        db_session, ConversationGroupCreate(title="Mine"), user_id=user_a
    )
    created = await upsert_standalone_conversation(
        db_session,
        user_id=user_a,
        body=StandaloneConversationCreate(
            clientConversationId="c-owned",
            conversationType="direct",
            groupId=str(group.id),
        ),
    )
    assert created.groupId == str(group.id)


@pytest.mark.asyncio
async def test_legacy_migrate_malformed_and_unauthorized_group_still_migrates(db_session):
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()
    b_group = await persist_conversation_group(
        db_session, ConversationGroupCreate(title="B"), user_id=user_b
    )

    bad = await migrate_legacy_conversations(
        db_session,
        user_id=user_a,
        request=LegacyMigrationRequest(
            conversations=[_legacy_conv("leg-bad", group_id="group-xxx")]
        ),
    )
    assert bad.results[0].status == "migrated"
    assert bad.results[0].reason == "group_id_sanitized"

    unauth = await migrate_legacy_conversations(
        db_session,
        user_id=user_a,
        request=LegacyMigrationRequest(
            conversations=[_legacy_conv("leg-unauth", group_id=str(b_group.id))]
        ),
    )
    assert unauth.results[0].status == "migrated"
    assert unauth.results[0].reason == "group_id_sanitized"
    detail_id = uuid.UUID(unauth.results[0].serverConversationId)
    row = (
        await db_session.execute(
            select(StandaloneConversation).where(StandaloneConversation.id == detail_id)
        )
    ).scalar_one()
    assert row.group_id is None


@pytest.mark.asyncio
async def test_legacy_migrate_owned_group_preserved(db_session):
    user_a = uuid.uuid4()
    group = await persist_conversation_group(
        db_session, ConversationGroupCreate(title="Mine"), user_id=user_a
    )
    res = await migrate_legacy_conversations(
        db_session,
        user_id=user_a,
        request=LegacyMigrationRequest(
            conversations=[_legacy_conv("leg-owned", group_id=str(group.id))]
        ),
    )
    assert res.results[0].status == "migrated"
    assert res.results[0].reason is None
    row = (
        await db_session.execute(
            select(StandaloneConversation).where(
                StandaloneConversation.id
                == uuid.UUID(res.results[0].serverConversationId)
            )
        )
    ).scalar_one()
    assert row.group_id == group.id


def test_migration_head_is_g8531():
    assert HEAD_REVISION == "add_conv_groups_g8531_v1"
    from pathlib import Path

    mig = (
        Path(__file__).resolve().parents[1]
        / "migrations"
        / "versions"
        / "add_conv_groups_g8531_v1.py"
    )
    src = mig.read_text(encoding="utf-8")
    assert 'revision: str = "add_conv_groups_g8531_v1"' in src
    assert 'down_revision: Union[str, None] = "add_standalone_yansi_prep_g884_v1"' in src
    assert "client_group_id" in src
    assert "uq_conversation_groups_user_client_id" in src
