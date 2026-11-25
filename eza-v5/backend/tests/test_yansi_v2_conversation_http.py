"""Yansı V2 Stage 02A — conversation draft HTTP API + public read integration."""
from __future__ import annotations

import asyncio
import os
import uuid
from contextlib import asynccontextmanager
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import select
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.schema import CreateSchema, DropSchema

from backend.auth.deps import get_current_user
from backend.core.utils.dependencies import Base, get_db
from backend.models.business_brand_assets import BusinessBrandAsset
from backend.models.business_yansi import BusinessMember, BusinessProfile, BusinessYansiDraft
from backend.models.mirror_network import MirrorNetworkNode, YansiPublicationVersionV2
from backend.models.production import Organization, User
from backend.models.yansi_knowledge_bundle import YansiKnowledgeBundle, YansiKnowledgeBundleVersion
from backend.models.yansi_v2_conversation_draft import YansiV2ConversationDraft
from backend.routers import yansi_v2 as routes
from backend.services.yansi.publish_conversation_v2 import publish_approved_conversation_v2
from backend.tests.test_business_yansi import sample  # noqa: F401
from backend.tests.test_yansi_v2_publish_image import _image_asset


async def _ensure_tables(db: AsyncSession):
    def create(sync):
        Base.metadata.create_all(
            sync.connection(),
            tables=[
                YansiKnowledgeBundle.__table__,
                YansiKnowledgeBundleVersion.__table__,
                YansiPublicationVersionV2.__table__,
                YansiV2ConversationDraft.__table__,
            ],
        )
    await db.run_sync(create)


def _app(db, user_id: str) -> FastAPI:
    app = FastAPI()
    app.include_router(routes.router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: {"user_id": user_id, "role": "user"}
    app.dependency_overrides[routes.rate_limit_standalone] = lambda: None
    return app


def _turns(n: int) -> list[dict]:
    return [
        {"stepIndex": i, "question": f"Merak {i}?", "answer": f"Cevap {i}."}
        for i in range(1, n + 1)
    ]


async def _create_draft(client, business_id, body: dict):
    return await client.post(
        f"/api/business-yansi/{business_id}/v2/conversation-drafts",
        json=body,
    )


async def _transition(client, business_id, draft_id, target, revision, note=None):
    payload = {"target": target, "expectedRevision": revision}
    if note is not None:
        payload["approvalNote"] = note
    return await client.post(
        f"/api/business-yansi/{business_id}/v2/conversation-drafts/{draft_id}/transition",
        json=payload,
    )


async def _publish(client, business_id, draft_id, body: dict):
    return await client.post(
        f"/api/business-yansi/{business_id}/v2/conversation-drafts/{draft_id}/publish",
        json=body,
    )


@pytest.mark.asyncio
async def test_owner_create_get_and_foreign_denied(sample):
    await _ensure_tables(sample.db)
    app = _app(sample.db, str(sample.owner.id))
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        created = await _create_draft(client, sample.business.id, {
            "title": "Sohbet",
            "turns": _turns(3),
        })
        assert created.status_code == 200, created.text
        data = created.json()
        assert data["status"] == "draft"
        assert data["turnCount"] == 3
        assert data["curiosityQuestion"] == "Merak 1?"
        assert data["revision"] == 1

        got = await client.get(
            f"/api/business-yansi/{sample.business.id}/v2/conversation-drafts/{data['id']}",
        )
        assert got.status_code == 200
        assert got.json()["id"] == data["id"]

        foreign = await client.get(
            f"/api/business-yansi/{sample.other.id}/v2/conversation-drafts/{data['id']}",
        )
    assert foreign.status_code in {403, 404}
    assert foreign.json()["detail"]["code"] in {
        "business_not_found", "membership_required", "draft_not_found",
    }

    outsider_app = _app(sample.db, str(sample.outsider.id))
    async with httpx.AsyncClient(app=outsider_app, base_url="http://test") as client:
        denied = await client.get(
            f"/api/business-yansi/{sample.business.id}/v2/conversation-drafts/{data['id']}",
        )
    assert denied.status_code == 403
    assert denied.json()["detail"]["code"] == "membership_required"


@pytest.mark.asyncio
async def test_turn_count_http_bounds(sample):
    await _ensure_tables(sample.db)
    app = _app(sample.db, str(sample.editor.id))
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        zero = await _create_draft(client, sample.business.id, {
            "title": "Zero",
            "turns": [],
        })
        nine = await _create_draft(client, sample.business.id, {
            "title": "Nine",
            "turns": _turns(9),
        })
        one = await _create_draft(client, sample.business.id, {
            "title": "One",
            "turns": _turns(1),
        })
        eight = await _create_draft(client, sample.business.id, {
            "title": "Eight",
            "turns": _turns(8),
        })
    assert zero.status_code == 422
    assert nine.status_code == 422
    assert one.status_code == 200
    assert eight.status_code == 200
    assert one.json()["turnCount"] == 1
    assert eight.json()["turnCount"] == 8


@pytest.mark.asyncio
async def test_revise_invalidates_approval_and_unapproved_publish(sample):
    await _ensure_tables(sample.db)
    app_editor = _app(sample.db, str(sample.editor.id))
    app_owner = _app(sample.db, str(sample.owner.id))
    async with httpx.AsyncClient(app=app_editor, base_url="http://test") as client:
        created = await _create_draft(client, sample.business.id, {
            "title": "Lifecycle",
            "turns": _turns(2),
        })
        draft_id = created.json()["id"]
        rev = created.json()["revision"]
        reviewed = await _transition(client, sample.business.id, draft_id, "review", rev)
        assert reviewed.status_code == 200

    async with httpx.AsyncClient(app=app_owner, base_url="http://test") as client:
        approved = await _transition(
            client, sample.business.id, draft_id, "approved",
            reviewed.json()["revision"], note="OK",
        )
        assert approved.status_code == 200
        assert approved.json()["status"] == "approved"

        # Stale revision publish rejected.
        stale = await _publish(client, sample.business.id, draft_id, {
            "expectedDraftRevision": approved.json()["revision"] - 1,
            "slug": f"stale-{uuid.uuid4().hex[:8]}",
        })
        assert stale.status_code == 409
        assert stale.json()["detail"]["code"] == "revision_conflict"

    async with httpx.AsyncClient(app=app_editor, base_url="http://test") as client:
        revised = await client.patch(
            f"/api/business-yansi/{sample.business.id}/v2/conversation-drafts/{draft_id}",
            json={
                "expectedRevision": approved.json()["revision"],
                "title": "Changed",
                "turns": _turns(2),
            },
        )
        assert revised.status_code == 200
        assert revised.json()["status"] == "draft"
        assert revised.json()["approvedBy"] is None

    async with httpx.AsyncClient(app=app_owner, base_url="http://test") as client:
        unapproved = await _publish(client, sample.business.id, draft_id, {
            "expectedDraftRevision": revised.json()["revision"],
            "slug": f"noap-{uuid.uuid4().hex[:8]}",
        })
    assert unapproved.status_code == 409
    assert unapproved.json()["detail"]["code"] == "approval_required"


@pytest.mark.asyncio
async def test_approved_publish_idempotent_and_public_read(sample):
    await _ensure_tables(sample.db)
    asset = await _image_asset(sample)
    app_editor = _app(sample.db, str(sample.editor.id))
    app_owner = _app(sample.db, str(sample.owner.id))
    turns = _turns(3)
    turns[0]["media"] = [{
        "type": "image",
        "assetId": str(asset.id),
        "assetRevision": 1,
        "title": asset.title,
    }]
    async with httpx.AsyncClient(app=app_editor, base_url="http://test") as client:
        created = await _create_draft(client, sample.business.id, {
            "title": "Publish me",
            "turns": turns,
        })
        draft_id = created.json()["id"]
        reviewed = await _transition(
            client, sample.business.id, draft_id, "review", created.json()["revision"],
        )

    slug = f"conv-http-{uuid.uuid4().hex[:8]}"
    async with httpx.AsyncClient(app=app_owner, base_url="http://test") as client:
        approved = await _transition(
            client, sample.business.id, draft_id, "approved",
            reviewed.json()["revision"],
        )
        first = await _publish(client, sample.business.id, draft_id, {
            "expectedDraftRevision": approved.json()["revision"],
            "slug": slug,
            "expectedCurrentVersion": None,
            "idempotencyKey": "conv-http-1",
        })
        assert first.status_code == 200, first.text
        body = first.json()
        assert body["status"] == "published"
        assert body["idempotent"] is False
        assert body["turnCount"] == 3
        assert body["curiosityQuestion"] == "Merak 1?"
        assert body["slug"] == slug
        assert body["publicationVersion"] == 1
        for banned in ("storageKey", "storage_key", "brand-assets/", '"locator"', "absolutePath"):
            assert banned not in str(body["public"])
        assert asset.locator not in str(body["public"])

        draft_row = await sample.db.get(YansiV2ConversationDraft, uuid.UUID(draft_id))
        second = await _publish(client, sample.business.id, draft_id, {
            "expectedDraftRevision": int(draft_row.revision),
            "nodeId": body["nodeId"],
            "expectedCurrentVersion": 1,
            "idempotencyKey": "conv-http-1",
        })
        assert second.status_code == 200
        assert second.json()["idempotent"] is True
        assert second.json()["publicationVersion"] == 1
        assert second.json()["contractHash"] == body["contractHash"]

        public = await client.get(f"/api/business-yansi/v2/public/{slug}")
        versioned = await client.get(f"/api/business-yansi/v2/public/{slug}/versions/1")

    assert public.status_code == 200, public.text
    assert public.json()["contentKind"] == "conversation"
    assert public.json()["publicationVersion"] == 1
    conv = public.json()["public"]["conversation"]
    assert conv["turnCount"] == 3
    assert conv["curiosityQuestion"] == "Merak 1?"
    assert [t["stepIndex"] for t in conv["turns"]] == [1, 2, 3]
    assert conv["turns"][0]["media"][0]["contentPath"].startswith("/api/business-yansi/public-media/")
    assert versioned.status_code == 200
    blob = str(public.json())
    for banned in ("storageKey", "storage_key", "brand-assets/", "s3Key", "absolutePath"):
        assert banned not in blob
    assert asset.locator not in blob


@pytest.mark.asyncio
async def test_image_only_http_unchanged_and_v1_draft_untouched(sample):
    await _ensure_tables(sample.db)
    asset = await _image_asset(sample)
    slug = f"img-reg-{uuid.uuid4().hex[:8]}"
    app = _app(sample.db, str(sample.owner.id))
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        img = await client.post(
            f"/api/business-yansi/{sample.business.id}/v2/publications/image",
            json={
                "assetId": str(asset.id),
                "expectedAssetRevision": 1,
                "title": "Image only",
                "slug": slug,
                "expectedCurrentVersion": None,
            },
        )
        assert img.status_code == 200, img.text
        pub = await client.get(f"/api/business-yansi/v2/public/{slug}")
    assert pub.status_code == 200
    assert pub.json()["contentKind"] == "image"
    assert pub.json()["public"]["contract"]["contentKind"] == "image"
    assert "conversation" not in pub.json()["public"]

    v1_before = len((await sample.db.scalars(select(BusinessYansiDraft))).all())
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        await _create_draft(client, sample.business.id, {
            "title": "V2 only path",
            "turns": _turns(1),
        })
    v1_after = len((await sample.db.scalars(select(BusinessYansiDraft))).all())
    assert v1_before == v1_after == 0


@pytest.mark.asyncio
async def test_editor_cannot_approve_or_publish(sample):
    await _ensure_tables(sample.db)
    app = _app(sample.db, str(sample.editor.id))
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        created = await _create_draft(client, sample.business.id, {
            "title": "Editor gate",
            "turns": _turns(1),
        })
        draft_id = created.json()["id"]
        reviewed = await _transition(
            client, sample.business.id, draft_id, "review", created.json()["revision"],
        )
        assert reviewed.status_code == 200
        approve = await _transition(
            client, sample.business.id, draft_id, "approved", reviewed.json()["revision"],
        )
        assert approve.status_code == 403
        assert approve.json()["detail"]["code"] == "owner_required"


# --- Optional Postgres concurrent publish ---------------------------------


def _pg_url():
    for name in (
        "BILIGN_YANSI_V2_PG_TEST_URL",
        "BILIGN_COVER_RETARGET_TEST_URL",
        "BUSINESS_STUDIO_TEST_POSTGRES_URL",
    ):
        raw = os.getenv(name, "").strip()
        if raw:
            break
    else:
        return None
    if raw.startswith("postgresql://"):
        raw = "postgresql+asyncpg://" + raw[len("postgresql://"):]
    if not raw.startswith("postgresql+asyncpg://"):
        return None
    url = make_url(raw)
    if url.host not in {"127.0.0.1", "localhost", "::1"}:
        return None
    return raw


def _allow_text_vector_without_pgvector():
    from sqlalchemy.ext.compiler import compiles
    from backend.models.business_yansi import Vector1536

    @compiles(Vector1536, "postgresql")
    def _pg_vector_as_text(type_, compiler, **kw):  # noqa: ARG001
        return "TEXT"


@asynccontextmanager
async def _pg_conversation_sessions():
    url = _pg_url()
    if url is None:
        pytest.skip(
            "BLOCKED: izole PostgreSQL kimlik bilgisi yok — "
            "BILIGN_YANSI_V2_PG_TEST_URL ayarlanmadı; eşzamanlı PG yarışları çalıştırılmadı."
        )
    _allow_text_vector_without_pgvector()
    schema = "yansi_conv_" + uuid.uuid4().hex[:10]
    engine = create_async_engine(
        url,
        connect_args={"server_settings": {"search_path": schema}},
        pool_size=5,
    )
    async with engine.begin() as conn:
        await conn.execute(CreateSchema(schema))
        await conn.run_sync(
            lambda sync: Base.metadata.create_all(
                sync,
                tables=[
                    User.__table__,
                    Organization.__table__,
                    BusinessProfile.__table__,
                    BusinessMember.__table__,
                    BusinessBrandAsset.__table__,
                    MirrorNetworkNode.__table__,
                    YansiKnowledgeBundle.__table__,
                    YansiKnowledgeBundleVersion.__table__,
                    YansiPublicationVersionV2.__table__,
                    YansiV2ConversationDraft.__table__,
                ],
            )
        )
    Session = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with Session() as setup:
            from backend.services.yansi import conversation_draft_v2 as drafts

            owner = User(id=uuid.uuid4(), email=f"c-{uuid.uuid4().hex}@t.test", role="user", is_active=True)
            org = Organization(id=uuid.uuid4(), name="ConvRace", status="active")
            biz = BusinessProfile(
                id=org.id, slug=f"c-{uuid.uuid4().hex[:6]}", name="ConvRace",
                owner_id=owner.id, status="active",
            )
            member = BusinessMember(business_id=org.id, user_id=owner.id, role="owner")
            setup.add_all([owner, org])
            await setup.flush()
            setup.add(biz)
            await setup.flush()
            setup.add(member)
            await setup.commit()

            created = await drafts.create_conversation_draft_v2(
                setup,
                business_id=str(biz.id),
                actor_user_id=str(owner.id),
                title="Race",
                turns=_turns(1),
            )
            reviewed = await drafts.transition_conversation_draft_v2(
                setup,
                business_id=str(biz.id),
                actor_user_id=str(owner.id),
                draft_id=created["id"],
                target="review",
                expected_revision=created["revision"],
            )
            approved = await drafts.transition_conversation_draft_v2(
                setup,
                business_id=str(biz.id),
                actor_user_id=str(owner.id),
                draft_id=reviewed["id"],
                target="approved",
                expected_revision=reviewed["revision"],
            )
            node = MirrorNetworkNode(
                id=uuid.uuid4(),
                slug=f"crace-{uuid.uuid4().hex[:8]}",
                user_id=owner.id,
                visibility="private",
                safety_status="open",
                card_title="Race",
                card_date="2026-11-21",
                public_payload={"yansiV2": True},
                private_payload={},
                artifact_kind="legacy_landing",
                journey_version=1,
                freeze_status="non_frozen",
                current_v2_publication_version=None,
            )
            setup.add(node)
            await setup.commit()
            ctx = SimpleNamespace(
                Session=Session,
                owner=owner,
                business=biz,
                draft=approved,
                node_id=str(node.id),
            )
        yield ctx
    finally:
        async with engine.begin() as conn:
            await conn.execute(DropSchema(schema, cascade=True))
        await engine.dispose()


@pytest.mark.asyncio
async def test_postgres_concurrent_conversation_same_idempotency_key():
    async with _pg_conversation_sessions() as ctx:
        async def worker():
            async with ctx.Session() as db:
                return await publish_approved_conversation_v2(
                    db,
                    business_id=str(ctx.business.id),
                    actor_user_id=str(ctx.owner.id),
                    draft_id=ctx.draft["id"],
                    expected_draft_revision=ctx.draft["revision"],
                    node_id=ctx.node_id,
                    expected_current_version=None,
                    idempotency_key="conv-same-key",
                )

        results = await asyncio.gather(worker(), worker(), return_exceptions=True)
        oks = [r for r in results if isinstance(r, dict)]
        errs = [r for r in results if isinstance(r, BaseException)]
        assert len(oks) == 2, f"expected both to resolve, got oks={oks} errs={errs}"
        assert {r["publicationVersion"] for r in oks} == {1}
        assert oks[0]["contractHash"] == oks[1]["contractHash"]
        assert sum(1 for r in oks if r["idempotent"]) >= 1


@pytest.mark.asyncio
async def test_list_conversation_drafts_member_only_and_paginated(sample):
    await _ensure_tables(sample.db)
    owner_app = _app(sample.db, str(sample.owner.id))
    async with httpx.AsyncClient(app=owner_app, base_url="http://test") as client:
        empty = await client.get(
            f"/api/business-yansi/{sample.business.id}/v2/conversation-drafts",
        )
        assert empty.status_code == 200, empty.text
        assert empty.json() == {"items": [], "total": 0, "limit": 50, "offset": 0}

        created_ids = []
        for title in ("Alpha", "Beta", "Gamma"):
            created = await _create_draft(client, sample.business.id, {
                "title": title,
                "turns": _turns(1),
            })
            assert created.status_code == 200, created.text
            created_ids.append(created.json()["id"])

        listed = await client.get(
            f"/api/business-yansi/{sample.business.id}/v2/conversation-drafts",
            params={"limit": 2, "offset": 0},
        )
        assert listed.status_code == 200, listed.text
        body = listed.json()
        assert body["total"] == 3
        assert body["limit"] == 2
        assert body["offset"] == 0
        assert len(body["items"]) == 2
        for item in body["items"]:
            assert set(item.keys()) >= {
                "id", "businessId", "title", "status", "revision",
                "turnCount", "updatedAt", "createdAt",
            }
            assert "turns" not in item
            assert "knowledgeSourcePins" not in item
            assert "contentDigest" not in item
            assert item["businessId"] == str(sample.business.id).lower()

        page2 = await client.get(
            f"/api/business-yansi/{sample.business.id}/v2/conversation-drafts",
            params={"limit": 2, "offset": 2},
        )
        assert page2.status_code == 200
        assert page2.json()["total"] == 3
        assert len(page2.json()["items"]) == 1

        filtered = await client.get(
            f"/api/business-yansi/{sample.business.id}/v2/conversation-drafts",
            params={"status": "draft"},
        )
        assert filtered.status_code == 200
        assert filtered.json()["total"] == 3
        assert all(row["status"] == "draft" for row in filtered.json()["items"])

        bad_status = await client.get(
            f"/api/business-yansi/{sample.business.id}/v2/conversation-drafts",
            params={"status": "nope"},
        )
        assert bad_status.status_code == 400
        assert bad_status.json()["detail"]["code"] == "invalid_status"

        foreign = await client.get(
            f"/api/business-yansi/{sample.other.id}/v2/conversation-drafts",
        )
    assert foreign.status_code in {403, 404}

    outsider_app = _app(sample.db, str(sample.outsider.id))
    async with httpx.AsyncClient(app=outsider_app, base_url="http://test") as client:
        denied = await client.get(
            f"/api/business-yansi/{sample.business.id}/v2/conversation-drafts",
        )
    assert denied.status_code == 403
    assert denied.json()["detail"]["code"] == "membership_required"

    async with httpx.AsyncClient(app=owner_app, base_url="http://test") as client:
        own = await client.get(
            f"/api/business-yansi/{sample.business.id}/v2/conversation-drafts",
            params={"limit": 100},
        )
    assert {row["id"] for row in own.json()["items"]} == set(created_ids)


@pytest.mark.asyncio
async def test_revise_cover_three_state_omitted_null_and_set(sample):
    """07H.4B — PATCH coverAssetId: omit=keep, null=clear, id=replace."""
    await _ensure_tables(sample.db)
    asset = await _image_asset(sample)
    other = await _image_asset(sample)
    app = _app(sample.db, str(sample.editor.id))
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        created = await _create_draft(client, sample.business.id, {
            "title": "Kapaklı",
            "turns": _turns(1),
            "coverAssetId": str(asset.id),
            "coverAssetRevision": int(asset.revision),
        })
        assert created.status_code == 200, created.text
        draft_id = created.json()["id"]
        rev = created.json()["revision"]
        assert created.json()["coverAssetId"] == str(asset.id).lower()

        # Omitted coverAssetId → keep binding while editing title.
        kept = await client.patch(
            f"/api/business-yansi/{sample.business.id}/v2/conversation-drafts/{draft_id}",
            json={
                "expectedRevision": rev,
                "title": "Başlık güncellendi",
                "turns": _turns(1),
            },
        )
        assert kept.status_code == 200, kept.text
        assert kept.json()["title"] == "Başlık güncellendi"
        assert kept.json()["coverAssetId"] == str(asset.id).lower()
        assert kept.json()["coverAssetRevision"] == int(asset.revision)
        assert kept.json()["status"] == "draft"
        rev = kept.json()["revision"]

        # Explicit null → clear cover.
        cleared = await client.patch(
            f"/api/business-yansi/{sample.business.id}/v2/conversation-drafts/{draft_id}",
            json={
                "expectedRevision": rev,
                "title": "Başlık güncellendi",
                "turns": _turns(1),
                "coverAssetId": None,
            },
        )
        assert cleared.status_code == 200, cleared.text
        assert cleared.json()["coverAssetId"] is None
        assert cleared.json()["coverAssetRevision"] is None
        rev = cleared.json()["revision"]

        # Valid asset id → set cover again.
        replaced = await client.patch(
            f"/api/business-yansi/{sample.business.id}/v2/conversation-drafts/{draft_id}",
            json={
                "expectedRevision": rev,
                "title": "Başlık güncellendi",
                "turns": _turns(1),
                "coverAssetId": str(other.id),
                "coverAssetRevision": int(other.revision),
            },
        )
        assert replaced.status_code == 200, replaced.text
        assert replaced.json()["coverAssetId"] == str(other.id).lower()
        assert replaced.json()["coverAssetRevision"] == int(other.revision)

        # Q&A edit without cover field → still keep.
        qa = await client.patch(
            f"/api/business-yansi/{sample.business.id}/v2/conversation-drafts/{draft_id}",
            json={
                "expectedRevision": replaced.json()["revision"],
                "title": "Başlık güncellendi",
                "turns": [
                    {"stepIndex": 1, "question": "Yeni merak?", "answer": "Yeni cevap."},
                ],
            },
        )
        assert qa.status_code == 200, qa.text
        assert qa.json()["coverAssetId"] == str(other.id).lower()
        assert qa.json()["turns"][0]["question"] == "Yeni merak?"


@pytest.mark.asyncio
async def test_revise_cover_rejects_foreign_asset_and_published_lock(sample):
    await _ensure_tables(sample.db)
    asset = await _image_asset(sample)
    app = _app(sample.db, str(sample.editor.id))
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        created = await _create_draft(client, sample.business.id, {
            "title": "Kilit",
            "turns": _turns(1),
            "coverAssetId": str(asset.id),
            "coverAssetRevision": int(asset.revision),
        })
        draft_id = created.json()["id"]
        rev = created.json()["revision"]

        foreign = await client.patch(
            f"/api/business-yansi/{sample.business.id}/v2/conversation-drafts/{draft_id}",
            json={
                "expectedRevision": rev,
                "title": "Kilit",
                "turns": _turns(1),
                "coverAssetId": "00000000-0000-4000-8000-000000000099",
                "coverAssetRevision": 1,
            },
        )
        assert foreign.status_code in {400, 404, 409, 422}
        # Cover must remain after rejected replace.
        got = await client.get(
            f"/api/business-yansi/{sample.business.id}/v2/conversation-drafts/{draft_id}",
        )
        assert got.json()["coverAssetId"] == str(asset.id).lower()
        assert got.json()["revision"] == rev

    # Mark published and ensure revise is locked.
    row = await sample.db.get(YansiV2ConversationDraft, uuid.UUID(draft_id))
    assert row is not None
    row.status = "published"
    await sample.db.commit()

    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        locked = await client.patch(
            f"/api/business-yansi/{sample.business.id}/v2/conversation-drafts/{draft_id}",
            json={
                "expectedRevision": rev,
                "title": "Kilit",
                "turns": _turns(1),
            },
        )
    assert locked.status_code == 409
    assert locked.json()["detail"]["code"] == "draft_immutable"
