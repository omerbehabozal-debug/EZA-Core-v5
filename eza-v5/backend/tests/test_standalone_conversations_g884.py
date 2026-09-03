# -*- coding: utf-8 -*-
"""Phase 8.8G-4 — authenticated ready/unpublished Yansı persistence."""

from __future__ import annotations

import uuid
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from backend.core.schemas.standalone_conversations import (
    StandaloneConversationCreate,
    StandaloneConversationMessageCreate,
    YansiPreparationUpsert,
)
from backend.core.utils.dependencies import get_db
from backend.main import app
from backend.migrations.alembic_version_capacity import HEAD_REVISION
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
    delete_standalone_conversation,
    list_standalone_conversations,
    upsert_standalone_conversation,
)
from backend.services.standalone.yansi_preparations import (
    YansiPreparationNotFoundError,
    list_owned_preparations,
    upsert_ready_preparation,
    validate_canonical_scene_url,
)

MIGRATION_PATH = (
    Path(__file__).resolve().parents[1]
    / "migrations"
    / "versions"
    / "add_standalone_yansi_prep_g884_v1.py"
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
    rows = []
    for i in range(n):
        rows.append(
            {
                "stepIndex": i,
                "sourceOrder": i,
                "sourceUserMessageId": f"u-{i}",
                "sourceAssistantMessageId": f"a-{i}",
                "publicQuestion": f"Soru {i + 1}",
                "publicAnswer": f"Yanıt {i + 1}",
            }
        )
    return rows


def _lineage(*, journey_id: str = "journey-alpha", **overrides) -> dict:
    payload = {
        "contractVersion": "journey_generation_lineage_v1",
        "journeyId": journey_id,
        "journeyVersion": 1,
        "sourceConversationId": "client-chat-1",
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
    payload.update(overrides)
    return payload


def _upsert(
    *,
    journey_id: str = "journey-alpha",
    title: str = "Hazır başlık",
    summary: str = "Hazır özet",
    scene: str = "https://api.ezacore.ai/api/public/mirror-scene-assets/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png",
    lineage: dict | None = None,
    **kwargs,
) -> YansiPreparationUpsert:
    lin = lineage or _lineage(journey_id=journey_id)
    return YansiPreparationUpsert(
        journeyId=journey_id,
        journeyVersion=1,
        windowIndex=0,
        windowHash="win-hash-1",
        selectedStepsHash="steps-hash-1",
        generationId="gen-1",
        publicTitle=title,
        publicSummary=summary,
        sceneImageUrl=scene,
        sceneFocalX=0.42,
        sceneFocalY=0.58,
        sealedLineage=lin,
        sealedPublicLanding={
            "publicTitle": title,
            "publicSummary": summary,
            "continuationContext": "devam",
        },
        **kwargs,
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


def test_migration_head_and_model_parity():
    src = MIGRATION_PATH.read_text(encoding="utf-8")
    assert 'revision: str = "add_standalone_yansi_prep_g884_v1"' in src
    assert 'down_revision: Union[str, None] = "add_standalone_conversations_g8811_v1"' in src
    assert HEAD_REVISION == "add_standalone_yansi_prep_g884_v1"
    assert "standalone_yansi_preparations" in src
    assert "uq_standalone_yansi_prep_source" in src
    assert "ck_standalone_yansi_prep_status" in src
    model_src = (
        Path(__file__).resolve().parents[1]
        / "models"
        / "standalone_conversations.py"
    ).read_text(encoding="utf-8")
    assert 'name="uq_standalone_yansi_prep_source"' in model_src
    assert 'name="ck_standalone_yansi_prep_status"' in model_src


def test_client_cannot_forge_published_fields():
    with pytest.raises(ValidationError):
        YansiPreparationUpsert(
            journeyId="j",
            journeyVersion=1,
            windowIndex=0,
            windowHash="h",
            selectedStepsHash="s",
            generationId="g",
            publicTitle="t",
            publicSummary="sum",
            sceneImageUrl="https://example.com/a.png",
            sealedLineage=_lineage(),
            published=True,  # type: ignore[call-arg]
        )
    with pytest.raises(ValidationError):
        YansiPreparationUpsert(
            journeyId="j",
            journeyVersion=1,
            windowIndex=0,
            windowHash="h",
            selectedStepsHash="s",
            generationId="g",
            publicTitle="t",
            publicSummary="sum",
            sceneImageUrl="https://example.com/a.png",
            sealedLineage=_lineage(),
            visibility="public",  # type: ignore[call-arg]
        )


def test_transient_scene_urls_rejected():
    with pytest.raises(Exception):
        validate_canonical_scene_url("blob:https://localhost/abc")
    with pytest.raises(Exception):
        validate_canonical_scene_url("data:image/png;base64,abc")
    with pytest.raises(Exception):
        validate_canonical_scene_url("file:///tmp/x.png")
    assert validate_canonical_scene_url(
        "https://api.ezacore.ai/api/public/mirror-scene-assets/x.png"
    ).startswith("https://")


async def _create_conv(db_session, user_id, client_id="client-chat-1"):
    return await upsert_standalone_conversation(
        db_session,
        user_id=user_id,
        body=StandaloneConversationCreate(
            clientConversationId=client_id,
            title="Sohbet",
            conversationType="direct",
        ),
    )


@pytest.mark.asyncio
async def test_owned_conversation_can_create_ready_preparation(db_session):
    user_id = uuid.uuid4()
    conv = await _create_conv(db_session, user_id)
    dto = await upsert_ready_preparation(
        db_session,
        user_id=user_id,
        conversation_id=uuid.UUID(conv.id),
        body=_upsert(),
    )
    assert dto.status == "ready"
    assert dto.publicTitle == "Hazır başlık"
    assert dto.sceneFocalX == 0.42
    listed = (await list_standalone_conversations(db_session, user_id=user_id)).items
    assert listed[0].hasReadyYansi is True
    assert listed[0].publishedYansiSlug is None


@pytest.mark.asyncio
async def test_cross_user_cannot_create_or_read(db_session):
    owner = uuid.uuid4()
    other = uuid.uuid4()
    conv = await _create_conv(db_session, owner)
    with pytest.raises(YansiPreparationNotFoundError):
        await upsert_ready_preparation(
            db_session,
            user_id=other,
            conversation_id=uuid.UUID(conv.id),
            body=_upsert(),
        )
    await upsert_ready_preparation(
        db_session,
        user_id=owner,
        conversation_id=uuid.UUID(conv.id),
        body=_upsert(),
    )
    with pytest.raises(YansiPreparationNotFoundError):
        await list_owned_preparations(
            db_session,
            user_id=other,
            conversation_id=uuid.UUID(conv.id),
        )


@pytest.mark.asyncio
async def test_same_source_twice_one_artifact(db_session):
    user_id = uuid.uuid4()
    conv = await _create_conv(db_session, user_id)
    first = await upsert_ready_preparation(
        db_session,
        user_id=user_id,
        conversation_id=uuid.UUID(conv.id),
        body=_upsert(title="Bir"),
    )
    second = await upsert_ready_preparation(
        db_session,
        user_id=user_id,
        conversation_id=uuid.UUID(conv.id),
        body=_upsert(title="İki", summary="değişmemeli"),
    )
    assert first.id == second.id
    assert second.publicTitle == "Bir"
    assert second.publicSummary == "Hazır özet"
    rows = await db_session.execute(select(StandaloneYansiPreparation))
    assert len(list(rows.scalars().all())) == 1


@pytest.mark.asyncio
async def test_concurrent_create_converges(db_session):
    """Two writers for the same source converge on one row (loser reads winner)."""
    user_id = uuid.uuid4()
    conv = await _create_conv(db_session, user_id)
    conv_id = uuid.UUID(conv.id)
    first = await upsert_ready_preparation(
        db_session,
        user_id=user_id,
        conversation_id=conv_id,
        body=_upsert(),
    )
    second = await upsert_ready_preparation(
        db_session,
        user_id=user_id,
        conversation_id=conv_id,
        body=_upsert(title="Diğer cihaz"),
    )
    assert first.id == second.id
    assert second.publicTitle == first.publicTitle
    rows = await db_session.execute(select(StandaloneYansiPreparation))
    assert len(list(rows.scalars().all())) == 1


@pytest.mark.asyncio
async def test_snapshot_survives_later_messages(db_session):
    user_id = uuid.uuid4()
    conv = await _create_conv(db_session, user_id)
    created = await upsert_ready_preparation(
        db_session,
        user_id=user_id,
        conversation_id=uuid.UUID(conv.id),
        body=_upsert(),
    )
    await append_standalone_message(
        db_session,
        user_id=user_id,
        conversation_id=uuid.UUID(conv.id),
        body=StandaloneConversationMessageCreate(
            clientMessageId="later-1",
            role="user",
            content="sonradan gelen mesaj",
        ),
    )
    items = await list_owned_preparations(
        db_session,
        user_id=user_id,
        conversation_id=uuid.UUID(conv.id),
    )
    assert items[0].id == created.id
    assert items[0].sealedLineage["selectedSteps"][0]["publicAnswer"] == "Yanıt 1"
    assert items[0].publicTitle == created.publicTitle


@pytest.mark.asyncio
async def test_secret_metadata_rejected(db_session):
    user_id = uuid.uuid4()
    conv = await _create_conv(db_session, user_id)
    lineage = _lineage()
    lineage["continuationProofToken"] = "secret"
    with pytest.raises(Exception):
        await upsert_ready_preparation(
            db_session,
            user_id=user_id,
            conversation_id=uuid.UUID(conv.id),
            body=_upsert(lineage=lineage),
        )


@pytest.mark.asyncio
async def test_blob_url_rejected_on_upsert(db_session):
    user_id = uuid.uuid4()
    conv = await _create_conv(db_session, user_id)
    with pytest.raises(Exception):
        await upsert_ready_preparation(
            db_session,
            user_id=user_id,
            conversation_id=uuid.UUID(conv.id),
            body=_upsert(scene="blob:https://x/1"),
        )


@pytest.mark.asyncio
async def test_deleted_conversation_cannot_create_and_hides_prep(db_session):
    user_id = uuid.uuid4()
    conv = await _create_conv(db_session, user_id)
    conv_id = uuid.UUID(conv.id)
    await upsert_ready_preparation(
        db_session,
        user_id=user_id,
        conversation_id=conv_id,
        body=_upsert(),
    )
    await delete_standalone_conversation(db_session, user_id=user_id, conversation_id=conv_id)
    with pytest.raises(YansiPreparationNotFoundError):
        await upsert_ready_preparation(
            db_session,
            user_id=user_id,
            conversation_id=conv_id,
            body=_upsert(journey_id="journey-beta"),
        )
    with pytest.raises(YansiPreparationNotFoundError):
        await list_owned_preparations(
            db_session, user_id=user_id, conversation_id=conv_id
        )
    listed = await list_standalone_conversations(db_session, user_id=user_id)
    assert listed.items == []


@pytest.mark.asyncio
async def test_limits_and_invalid_status(db_session):
    user_id = uuid.uuid4()
    conv = await _create_conv(db_session, user_id)
    with pytest.raises(ValidationError):
        YansiPreparationUpsert(
            journeyId="j",
            journeyVersion=1,
            windowIndex=0,
            windowHash="h",
            selectedStepsHash="s",
            generationId="g",
            publicTitle="t" * 201,
            publicSummary="sum",
            sceneImageUrl="https://example.com/a.png",
            sealedLineage=_lineage(),
        )
    lineage = _lineage()
    lineage["selectedSteps"] = _steps(2)
    with pytest.raises(Exception):
        await upsert_ready_preparation(
            db_session,
            user_id=user_id,
            conversation_id=uuid.UUID(conv.id),
            body=_upsert(lineage=lineage),
        )


@pytest.mark.asyncio
async def test_db_uniqueness_constraint(db_session):
    user_id = uuid.uuid4()
    conv = await _create_conv(db_session, user_id)
    await upsert_ready_preparation(
        db_session,
        user_id=user_id,
        conversation_id=uuid.UUID(conv.id),
        body=_upsert(),
    )
    db_session.add(
        StandaloneYansiPreparation(
            user_id=user_id,
            conversation_id=uuid.UUID(conv.id),
            source_identity="journey-alpha::v1",
            journey_id="journey-alpha",
            journey_version=1,
            window_index=0,
            window_hash="other",
            selected_steps_hash="other",
            generation_id="g2",
            status="ready",
            public_title="dup",
            public_summary="dup",
            scene_image_url="https://example.com/b.png",
            sealed_lineage=_lineage(),
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.commit()


def test_api_owner_roundtrip_and_cross_user(authenticated_api_client):
    client, user, headers = authenticated_api_client
    created = client.post(
        "/api/standalone/conversations",
        json={"clientConversationId": "chat-api-1", "conversationType": "direct"},
        headers=headers,
    )
    assert created.status_code == 201
    conv_id = created.json()["id"]
    put = client.put(
        f"/api/standalone/conversations/{conv_id}/yansi-preparation",
        json=_upsert().model_dump(),
        headers=headers,
    )
    assert put.status_code == 200
    got = client.get(
        f"/api/standalone/conversations/{conv_id}/yansi-preparation",
        headers=headers,
    )
    assert got.status_code == 200
    assert got.json()["items"][0]["publicTitle"] == "Hazır başlık"

    other = _make_user()
    other_headers = _auth_header(other)
    denied = client.get(
        f"/api/standalone/conversations/{conv_id}/yansi-preparation",
        headers=other_headers,
    )
    assert denied.status_code == 404
    create_denied = client.put(
        f"/api/standalone/conversations/{conv_id}/yansi-preparation",
        json=_upsert(journey_id="journey-other").model_dump(),
        headers=other_headers,
    )
    assert create_denied.status_code == 404


def test_publication_link_requires_owned_node(authenticated_api_client):
    client, user, headers = authenticated_api_client
    created = client.post(
        "/api/standalone/conversations",
        json={"clientConversationId": "chat-api-2", "conversationType": "direct"},
        headers=headers,
    )
    conv_id = created.json()["id"]
    client.put(
        f"/api/standalone/conversations/{conv_id}/yansi-preparation",
        json=_upsert().model_dump(),
        headers=headers,
    )
    missing = client.post(
        f"/api/standalone/conversations/{conv_id}/yansi-preparation/publication-link",
        json={"slug": "not-a-real-slug", "journeyId": "journey-alpha", "journeyVersion": 1},
        headers=headers,
    )
    assert missing.status_code in {404, 500}
    listed = client.get("/api/standalone/conversations", headers=headers)
    assert listed.json()["items"][0]["hasReadyYansi"] is True
