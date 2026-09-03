# -*- coding: utf-8 -*-
"""Phase 8.8G-3.2 — bounded standalone conversation list pagination."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from backend.core.schemas.standalone_conversations import MAX_CONVERSATION_LIST_LIMIT
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
from backend.services.standalone.conversations import list_standalone_conversations


@compiles(PGUUID, "sqlite")
def _compile_uuid_sqlite(_type, _compiler, **_kw):
    return "CHAR(36)"


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


def _make_user():
    user_id = uuid.uuid4()
    return SimpleNamespace(
        id=user_id,
        email=f"{user_id.hex[:8]}@g8832.test",
        password_hash="hash",
        role="user",
        is_active=True,
        mirror_plan="free",
    )


def _auth_header(user) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user)}"}


@pytest.fixture
def authenticated_api_client(db_engine):
    Session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    user = _make_user()

    async def _override_db():
        async with Session() as session:
            yield session

    app.dependency_overrides[get_db] = _override_db
    try:
        yield TestClient(app), user, _auth_header(user)
    finally:
        app.dependency_overrides.pop(get_db, None)


def _conversation(
    user_id: uuid.UUID,
    index: int,
    *,
    conversation_id: uuid.UUID | None = None,
    timestamp: datetime | None = None,
    deleted: bool = False,
) -> StandaloneConversation:
    occurred_at = timestamp or datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(
        seconds=index
    )
    return StandaloneConversation(
        id=conversation_id or uuid.uuid4(),
        user_id=user_id,
        client_conversation_id=f"conversation-{index:03d}",
        title=f"Conversation {index}",
        conversation_type="direct",
        message_count=0,
        created_at=occurred_at,
        updated_at=occurred_at,
        last_message_at=occurred_at,
        deleted_at=occurred_at if deleted else None,
    )


async def _seed_conversations(
    db_session: AsyncSession,
    user_id: uuid.UUID,
    count: int,
    *,
    start: int = 0,
) -> list[StandaloneConversation]:
    rows = [_conversation(user_id, i) for i in range(start, start + count)]
    db_session.add_all(rows)
    await db_session.commit()
    return rows


def _client_ids(page) -> list[str]:
    return [item.clientConversationId for item in page.items]


@pytest.mark.asyncio
async def test_first_and_second_pages_are_deterministic(db_session):
    user_id = uuid.uuid4()
    await _seed_conversations(db_session, user_id, 7)

    first = await list_standalone_conversations(
        db_session, user_id=user_id, limit=3, offset=0
    )
    second = await list_standalone_conversations(
        db_session, user_id=user_id, limit=3, offset=3
    )

    assert _client_ids(first) == [
        "conversation-006",
        "conversation-005",
        "conversation-004",
    ]
    assert (first.limit, first.offset, first.total, first.hasMore) == (3, 0, 7, True)
    assert _client_ids(second) == [
        "conversation-003",
        "conversation-002",
        "conversation-001",
    ]
    assert (second.limit, second.offset, second.total, second.hasMore) == (3, 3, 7, True)


@pytest.mark.asyncio
async def test_more_than_max_page_size_is_accessible_by_draining_pages(db_session):
    user_id = uuid.uuid4()
    await _seed_conversations(db_session, user_id, 135)

    seen: list[str] = []
    offset = 0
    while True:
        page = await list_standalone_conversations(
            db_session, user_id=user_id, limit=37, offset=offset
        )
        seen.extend(_client_ids(page))
        if not page.hasMore:
            break
        offset += len(page.items)

    assert len(seen) == 135
    assert len(set(seen)) == 135
    assert seen[0] == "conversation-134"
    assert seen[-1] == "conversation-000"
    assert page.total == 135


@pytest.mark.asyncio
async def test_pagination_is_owner_scoped(db_session):
    owner = uuid.uuid4()
    other = uuid.uuid4()
    await _seed_conversations(db_session, owner, 5)
    await _seed_conversations(db_session, other, 4, start=100)

    page = await list_standalone_conversations(
        db_session, user_id=owner, limit=2, offset=2
    )

    assert _client_ids(page) == ["conversation-002", "conversation-001"]
    assert page.total == 5
    assert page.hasMore is True


@pytest.mark.asyncio
async def test_deleted_rows_are_excluded_from_items_and_total(db_session):
    user_id = uuid.uuid4()
    db_session.add_all(
        [
            _conversation(user_id, 0),
            _conversation(user_id, 1, deleted=True),
            _conversation(user_id, 2),
        ]
    )
    await db_session.commit()

    page = await list_standalone_conversations(
        db_session, user_id=user_id, limit=10, offset=0
    )

    assert _client_ids(page) == ["conversation-002", "conversation-000"]
    assert page.total == 2
    assert page.hasMore is False


@pytest.mark.asyncio
async def test_equal_timestamps_use_id_desc_as_final_tiebreaker(db_session):
    user_id = uuid.uuid4()
    tied_at = datetime(2026, 2, 2, tzinfo=timezone.utc)
    low_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    high_id = uuid.UUID("ffffffff-ffff-ffff-ffff-ffffffffffff")
    db_session.add_all(
        [
            _conversation(user_id, 1, conversation_id=low_id, timestamp=tied_at),
            _conversation(user_id, 2, conversation_id=high_id, timestamp=tied_at),
        ]
    )
    await db_session.commit()

    page = await list_standalone_conversations(
        db_session, user_id=user_id, limit=1, offset=0
    )
    next_page = await list_standalone_conversations(
        db_session, user_id=user_id, limit=1, offset=1
    )

    assert [page.items[0].id, next_page.items[0].id] == [str(high_id), str(low_id)]


@pytest.mark.asyncio
async def test_limit_max_and_invalid_service_values(db_session):
    user_id = uuid.uuid4()
    await _seed_conversations(db_session, user_id, 101)

    page = await list_standalone_conversations(
        db_session,
        user_id=user_id,
        limit=MAX_CONVERSATION_LIST_LIMIT,
        offset=0,
    )
    assert len(page.items) == MAX_CONVERSATION_LIST_LIMIT
    assert page.hasMore is True

    for limit, offset, detail in [
        (0, 0, "invalid_list_limit"),
        (MAX_CONVERSATION_LIST_LIMIT + 1, 0, "invalid_list_limit"),
        (1, -1, "invalid_list_offset"),
    ]:
        with pytest.raises(HTTPException) as exc:
            await list_standalone_conversations(
                db_session, user_id=user_id, limit=limit, offset=offset
            )
        assert exc.value.status_code == 422
        assert exc.value.detail == detail


@pytest.mark.parametrize(
    "query",
    [
        "?limit=0",
        f"?limit={MAX_CONVERSATION_LIST_LIMIT + 1}",
        "?offset=-1",
        "?limit=invalid",
        "?offset=invalid",
    ],
)
def test_http_rejects_invalid_limit_and_offset(authenticated_api_client, query):
    client, _user, headers = authenticated_api_client
    response = client.get(f"/api/standalone/conversations{query}", headers=headers)
    assert response.status_code == 422


def _preparation(
    user_id: uuid.UUID,
    conversation_id: uuid.UUID,
    *,
    source: str,
    published_slug: str | None = None,
) -> StandaloneYansiPreparation:
    return StandaloneYansiPreparation(
        user_id=user_id,
        conversation_id=conversation_id,
        source_identity=source,
        journey_id=source,
        journey_version=1,
        window_index=0,
        window_hash=f"{source}-window",
        selected_steps_hash=f"{source}-steps",
        generation_id=f"{source}-generation",
        status="ready",
        public_title="Ready",
        public_summary="Ready summary",
        scene_image_url="https://api.ezacore.ai/api/public/mirror-scene-assets/test.png",
        sealed_lineage={"journeyId": source},
        published_slug=published_slug,
    )


@pytest.mark.asyncio
async def test_yansi_flags_survive_pagination_without_filtering_no_yansi_rows(db_session):
    user_id = uuid.uuid4()
    rows = [_conversation(user_id, i) for i in range(4)]
    db_session.add_all(rows)
    await db_session.flush()
    # Descending order is D, C, B, A. Both pages include flagged and unflagged rows.
    db_session.add_all(
        [
            _preparation(user_id, rows[0].id, source="ready-a"),
            _preparation(
                user_id,
                rows[3].id,
                source="published-d",
                published_slug="published-d",
            ),
        ]
    )
    await db_session.commit()

    first = await list_standalone_conversations(
        db_session, user_id=user_id, limit=2, offset=0
    )
    second = await list_standalone_conversations(
        db_session, user_id=user_id, limit=2, offset=2
    )
    all_items = {item.clientConversationId: item for item in first.items + second.items}

    assert set(all_items) == {
        "conversation-000",
        "conversation-001",
        "conversation-002",
        "conversation-003",
    }
    assert all_items["conversation-000"].hasReadyYansi is True
    assert all_items["conversation-000"].publishedYansiSlug is None
    assert all_items["conversation-001"].hasReadyYansi is False
    assert all_items["conversation-002"].hasReadyYansi is False
    assert all_items["conversation-003"].hasReadyYansi is False
    assert all_items["conversation-003"].publishedYansiSlug == "published-d"
    assert first.total == second.total == 4
