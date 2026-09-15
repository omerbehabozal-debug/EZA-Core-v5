# -*- coding: utf-8 -*-
"""Owner-wide Yansı preparation inventory — sidebar bootstrap."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from backend.core.schemas.standalone_conversations import (
    StandaloneConversationCreate,
    YansiPreparationUpsert,
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
    delete_standalone_conversation,
    upsert_standalone_conversation,
)
from backend.services.standalone.yansi_preparations import (
    list_owner_preparations,
    upsert_ready_preparation,
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


def _steps(n: int = 8) -> list[dict]:
    return [
        {
            "stepIndex": i,
            "sourceOrder": i,
            "sourceUserMessageId": f"u-{i}",
            "sourceAssistantMessageId": f"a-{i}",
            "publicQuestion": f"Soru {i + 1}",
            "publicAnswer": f"Yanıt {i + 1}",
        }
        for i in range(n)
    ]


def _lineage(*, journey_id: str = "journey-alpha", conv: str = "client-chat-1") -> dict:
    return {
        "contractVersion": "journey_generation_lineage_v1",
        "journeyId": journey_id,
        "journeyVersion": 1,
        "sourceConversationId": conv,
        "windowIndex": 0,
        "windowStart": 0,
        "windowEnd": 8,
        "windowHash": "win-hash-1",
        "scopedInputHash": "scoped-1",
        "selectedStepsHash": "steps-hash-1",
        "interpretationHash": "interp-1",
        "publicLandingHash": "land-1",
        "mappedPromptHash": "map-1",
        "generationId": "gen-1",
        "selectedSteps": _steps(),
    }


def _upsert(
    *,
    journey_id: str = "journey-alpha",
    journey_version: int = 1,
    window_index: int = 0,
    title: str = "Hazır başlık",
    summary: str = "Hazır özet",
    scene: str = "https://api.ezacore.ai/api/public/mirror-scene-assets/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png",
    conv: str = "client-chat-1",
) -> YansiPreparationUpsert:
    return YansiPreparationUpsert(
        journeyId=journey_id,
        journeyVersion=journey_version,
        windowIndex=window_index,
        windowHash=f"win-{journey_id}-{window_index}",
        selectedStepsHash=f"steps-{journey_id}-{window_index}",
        generationId=f"gen-{journey_id}-{window_index}",
        publicTitle=title,
        publicSummary=summary,
        sceneImageUrl=scene,
        sealedLineage=_lineage(journey_id=journey_id, conv=conv),
        sealedPublicLanding={
            "publicTitle": title,
            "publicSummary": summary,
            "continuationContext": "devam",
        },
    )


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


async def _create_conv(db, user_id, client_id: str):
    return await upsert_standalone_conversation(
        db,
        user_id=user_id,
        body=StandaloneConversationCreate(
            clientConversationId=client_id,
            conversationType="direct",
            title=f"Title {client_id}",
        ),
    )


@pytest.mark.asyncio
async def test_owner_list_ready_and_published(db_session):
    user_id = uuid.uuid4()
    conv = await _create_conv(db_session, user_id, "chat-c")
    await upsert_ready_preparation(
        db_session,
        user_id=user_id,
        conversation_id=uuid.UUID(conv.id),
        body=_upsert(journey_id="journey-a", title="İstanbul Semtleri", conv="chat-c"),
    )
    published = await upsert_ready_preparation(
        db_session,
        user_id=user_id,
        conversation_id=uuid.UUID(conv.id),
        body=_upsert(
            journey_id="journey-b",
            journey_version=1,
            window_index=1,
            title="Çocuklu Yaşam",
            conv="chat-c",
        ),
    )
    # Link publication via direct field (service link needs network node).
    from sqlalchemy import select

    row = (
        await db_session.execute(
            select(StandaloneYansiPreparation).where(
                StandaloneYansiPreparation.id == uuid.UUID(published.id)
            )
        )
    ).scalar_one()
    row.published_slug = "published-slug-b"
    await db_session.commit()

    page = await list_owner_preparations(db_session, user_id=user_id, limit=100, offset=0)
    assert page.total == 2
    assert page.hasMore is False
    titles = {item.publicTitle for item in page.items}
    assert titles == {"İstanbul Semtleri", "Çocuklu Yaşam"}
    assert all(item.conversationId == "chat-c" for item in page.items)
    published_item = next(i for i in page.items if i.journeyId == "journey-b")
    assert published_item.publishedSlug == "published-slug-b"
    assert published_item.sceneImageUrl.startswith("https://")


@pytest.mark.asyncio
async def test_owner_list_excludes_deleted_prep_and_deleted_conversation(db_session):
    user_id = uuid.uuid4()
    live = await _create_conv(db_session, user_id, "chat-live")
    doomed = await _create_conv(db_session, user_id, "chat-doomed")
    await upsert_ready_preparation(
        db_session,
        user_id=user_id,
        conversation_id=uuid.UUID(live.id),
        body=_upsert(journey_id="journey-live", conv="chat-live"),
    )
    doomed_prep = await upsert_ready_preparation(
        db_session,
        user_id=user_id,
        conversation_id=uuid.UUID(doomed.id),
        body=_upsert(journey_id="journey-doomed", conv="chat-doomed"),
    )
    soft = await upsert_ready_preparation(
        db_session,
        user_id=user_id,
        conversation_id=uuid.UUID(live.id),
        body=_upsert(journey_id="journey-soft", window_index=1, conv="chat-live"),
    )
    from sqlalchemy import select

    soft_row = (
        await db_session.execute(
            select(StandaloneYansiPreparation).where(
                StandaloneYansiPreparation.id == uuid.UUID(soft.id)
            )
        )
    ).scalar_one()
    soft_row.deleted_at = datetime.now(timezone.utc)
    await db_session.commit()

    await delete_standalone_conversation(
        db_session, user_id=user_id, conversation_id=uuid.UUID(doomed.id)
    )

    page = await list_owner_preparations(db_session, user_id=user_id)
    assert page.total == 1
    assert page.items[0].journeyId == "journey-live"
    assert doomed_prep.journeyId == "journey-doomed"


@pytest.mark.asyncio
async def test_owner_list_excludes_other_user(db_session):
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()
    conv_a = await _create_conv(db_session, user_a, "chat-a")
    conv_b = await _create_conv(db_session, user_b, "chat-b")
    await upsert_ready_preparation(
        db_session,
        user_id=user_a,
        conversation_id=uuid.UUID(conv_a.id),
        body=_upsert(journey_id="journey-a", conv="chat-a"),
    )
    await upsert_ready_preparation(
        db_session,
        user_id=user_b,
        conversation_id=uuid.UUID(conv_b.id),
        body=_upsert(journey_id="journey-b", conv="chat-b"),
    )
    page = await list_owner_preparations(db_session, user_id=user_a)
    assert page.total == 1
    assert page.items[0].journeyId == "journey-a"


@pytest.mark.asyncio
async def test_owner_list_excludes_non_ready_status_when_present(db_session):
    """DB normally only stores ready; still filter status==ready if a non-ready row exists."""
    user_id = uuid.uuid4()
    conv = await _create_conv(db_session, user_id, "chat-c")
    await upsert_ready_preparation(
        db_session,
        user_id=user_id,
        conversation_id=uuid.UUID(conv.id),
        body=_upsert(journey_id="journey-ready", conv="chat-c"),
    )
    # Best-effort insert of non-ready rows (SQLite CHECK may block).
    for status in ("generating", "failed"):
        try:
            await db_session.execute(
                text(
                    "INSERT INTO standalone_yansi_preparations "
                    "(id, user_id, conversation_id, source_identity, journey_id, journey_version, "
                    "window_index, window_hash, selected_steps_hash, generation_id, status, "
                    "public_title, public_summary, scene_image_url, sealed_lineage, created_at) "
                    "VALUES (:id, :uid, :cid, :sid, :jid, 1, 9, 'w', 's', 'g', :st, "
                    "'t', 'sum', 'https://example.com/x.png', '{}', CURRENT_TIMESTAMP)"
                ),
                {
                    "id": str(uuid.uuid4()),
                    "uid": str(user_id),
                    "cid": conv.id,
                    "sid": f"journey-{status}::v1",
                    "jid": f"journey-{status}",
                    "st": status,
                },
            )
            await db_session.commit()
        except Exception:
            await db_session.rollback()

    page = await list_owner_preparations(db_session, user_id=user_id)
    assert all(item.status == "ready" for item in page.items)
    assert all(item.journeyId == "journey-ready" for item in page.items)


@pytest.mark.asyncio
async def test_owner_list_deterministic_pagination(db_session):
    user_id = uuid.uuid4()
    conv = await _create_conv(db_session, user_id, "chat-c")
    for i, jid in enumerate(["journey-a", "journey-b", "journey-c"]):
        await upsert_ready_preparation(
            db_session,
            user_id=user_id,
            conversation_id=uuid.UUID(conv.id),
            body=_upsert(
                journey_id=jid,
                window_index=i,
                title=f"Title {jid}",
                conv="chat-c",
            ),
        )
    first = await list_owner_preparations(db_session, user_id=user_id, limit=2, offset=0)
    second = await list_owner_preparations(db_session, user_id=user_id, limit=2, offset=2)
    assert first.total == 3
    assert first.hasMore is True
    assert [i.journeyId for i in first.items] == ["journey-a", "journey-b"]
    assert [i.journeyId for i in second.items] == ["journey-c"]
    assert second.hasMore is False


def test_owner_api_auth_and_client_conversation_id(authenticated_api_client):
    client, user, headers = authenticated_api_client
    created = client.post(
        "/api/standalone/conversations",
        json={"clientConversationId": "chat-api-owner", "conversationType": "direct"},
        headers=headers,
    )
    assert created.status_code == 201
    conv_id = created.json()["id"]
    put = client.put(
        f"/api/standalone/conversations/{conv_id}/yansi-preparation",
        json=_upsert(journey_id="journey-api", conv="chat-api-owner").model_dump(),
        headers=headers,
    )
    assert put.status_code == 200

    unauth = client.get("/api/standalone/yansi-preparations")
    assert unauth.status_code in {401, 403}

    got = client.get("/api/standalone/yansi-preparations?limit=50&offset=0", headers=headers)
    assert got.status_code == 200
    body = got.json()
    assert body["total"] == 1
    assert body["hasMore"] is False
    item = body["items"][0]
    assert item["conversationId"] == "chat-api-owner"
    assert item["journeyId"] == "journey-api"
    assert item["publicTitle"] == "Hazır başlık"
    assert item["publicSummary"] == "Hazır özet"
    assert item["sceneImageUrl"]


def test_owner_api_cross_user_empty(authenticated_api_client):
    client, user, headers = authenticated_api_client
    created = client.post(
        "/api/standalone/conversations",
        json={"clientConversationId": "chat-private", "conversationType": "direct"},
        headers=headers,
    )
    conv_id = created.json()["id"]
    client.put(
        f"/api/standalone/conversations/{conv_id}/yansi-preparation",
        json=_upsert(journey_id="journey-private", conv="chat-private").model_dump(),
        headers=headers,
    )
    other = _make_user()
    other_headers = _auth_header(other)
    listed = client.get("/api/standalone/yansi-preparations", headers=other_headers)
    assert listed.status_code == 200
    assert listed.json()["total"] == 0
    assert listed.json()["items"] == []
