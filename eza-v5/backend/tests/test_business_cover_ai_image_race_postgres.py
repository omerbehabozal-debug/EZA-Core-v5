"""Disposable PostgreSQL races for Cover AI image confirmation.

Skips when BILIGN_COVER_AI_TEST_POSTGRES_URL is unset. Never reads DATABASE_URL.
"""
from __future__ import annotations

import asyncio
import io
import json
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import pytest
from PIL import Image
from sqlalchemy import select
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.schema import CreateSchema, DropSchema

from backend.core.utils.dependencies import Base
from backend.models.business_brand_assets import BusinessBrandAsset, BusinessKnowledgeAssetLink
from backend.models.business_cover_ai import BusinessCoverAiProposal, BusinessCoverAiUsage
from backend.models.business_video_cover_jobs import BusinessVideoCoverJob
from backend.models.business_yansi import (
    BusinessMember,
    BusinessProfile,
    BusinessKnowledgeVersion,
    BusinessYansiDraft,
)
from backend.models.mirror_network import MirrorNetworkNode
from backend.models.production import Organization, User
from backend.models.standalone_conversations import StandaloneConversation
from backend.services.business_yansi import service as svc
from backend.services.business_yansi.cover_ai import FLAG, IMAGE_MODEL_ENV, MODEL_ENV, PRICES
from backend.services.business_yansi.cover_ai_preview_store import PREVIEW_DIR_ENV
from backend.services.business_yansi.cover_image_suggestions import (
    confirm_image_suggestion,
    suggest_image_cover,
    _snapshot,
)
from backend.tests.test_business_video_cover_policy import _steps


def _raw_url() -> str:
    for name in (
        "BILIGN_COVER_AI_TEST_POSTGRES_URL",
        "BILIGN_COVER_RETARGET_TEST_URL",
        "BUSINESS_VIDEO_AUTH_TEST_POSTGRES_URL",
    ):
        raw = os.getenv(name, "").strip()
        if raw:
            return raw
    return ""


def _require_url():
    raw = _raw_url()
    if not raw:
        pytest.skip("BLOCKED: disposable PostgreSQL is not configured for cover AI image races")
    if raw.startswith("postgresql://"):
        raw = "postgresql+asyncpg://" + raw[len("postgresql://"):]
    if not raw.startswith("postgresql+asyncpg://"):
        pytest.skip("BLOCKED: disposable PostgreSQL URL must use the postgresql scheme")
    url = make_url(raw)
    assert url.host in {"127.0.0.1", "localhost", "::1"}
    return raw


def _png(width=128, height=128, color=(30, 90, 140)) -> bytes:
    image = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


def _image_env(monkeypatch, tmp_path):
    monkeypatch.setenv(FLAG, "true")
    monkeypatch.setenv(MODEL_ENV, "gpt-4o")
    monkeypatch.setenv(IMAGE_MODEL_ENV, "gpt-image-2.5-sunburst")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-cover-ai-image-pg-not-paid")
    monkeypatch.setenv(PREVIEW_DIR_ENV, str(tmp_path / "previews"))
    monkeypatch.setenv("EZA_BRAND_ASSET_DIR", str(tmp_path / "assets"))
    monkeypatch.setenv(
        PRICES,
        json.dumps({
            "version": "cover-ai-prices-v1",
            "models": {
                "gpt-4o": {
                    "inputUsdPer1k": "0.01",
                    "outputUsdPer1k": "0.02",
                    "maxInputTokens": 12000,
                    "maxOutputTokens": 400,
                }
            },
            "imageModels": {
                "gpt-image-2.5-sunburst": {
                    "reservedMaxUsdPerImage": "0.04",
                    "size": "1024x1024",
                    "quality": "medium",
                    "outputFormat": "png",
                    "n": 1,
                }
            },
        }),
    )
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_AI_REQUEST_USD", "1.00")
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_AI_DAILY_USD", "10.00")


@asynccontextmanager
async def _database():
    url = _require_url()
    schema = "cover_img_" + uuid.uuid4().hex
    engine = create_async_engine(
        url,
        connect_args={
            "server_settings": {
                "search_path": schema,
                "lock_timeout": "5s",
                "statement_timeout": "20s",
            }
        },
    )
    made = False
    try:
        async with engine.begin() as connection:
            await connection.execute(CreateSchema(schema))
            made = True

            def setup(sync):
                Base.metadata.create_all(
                    sync,
                    tables=[
                        User.__table__,
                        Organization.__table__,
                        StandaloneConversation.__table__,
                        MirrorNetworkNode.__table__,
                        BusinessProfile.__table__,
                        BusinessMember.__table__,
                        BusinessKnowledgeVersion.__table__,
                        BusinessYansiDraft.__table__,
                        BusinessBrandAsset.__table__,
                        BusinessKnowledgeAssetLink.__table__,
                        BusinessVideoCoverJob.__table__,
                        BusinessCoverAiProposal.__table__,
                        BusinessCoverAiUsage.__table__,
                    ],
                )

            await connection.run_sync(setup)
        maker = async_sessionmaker(engine, expire_on_commit=False)
        async with maker() as db:
            owner = User(id=uuid.uuid4(), email=f"owner-{uuid.uuid4().hex[:8]}@example.test", role="user", is_active=True)
            editor = User(id=uuid.uuid4(), email=f"editor-{uuid.uuid4().hex[:8]}@example.test", role="user", is_active=True)
            org = Organization(id=uuid.uuid4(), name="CoverImg", status="active")
            db.add_all([owner, editor, org])
            await db.commit()
            business = await svc.create_business(
                db, owner,
                {"organizationId": str(org.id), "ownerId": str(owner.id), "slug": f"cimg-{uuid.uuid4().hex[:8]}", "name": "CoverImg"},
            )
            business.verified = True
            business.official = True
            db.add(BusinessMember(business_id=business.id, user_id=editor.id, role="editor"))
            await db.commit()
            yield {
                "engine": engine,
                "maker": maker,
                "business": business,
                "editor": editor,
                "owner": owner,
            }
    finally:
        if made:
            async with engine.begin() as connection:
                await connection.execute(DropSchema(schema, cascade=True))
        await engine.dispose()


async def _seed_draft(db, business, editor):
    knowledge = await svc.create_knowledge(
        db,
        business.id,
        editor.id,
        {
            "title": "Yansi nedir",
            "content": "Yansi yayimlanmis bir sohbet deneyimidir.",
            "source": "Dogrulanmis uygulama akisi",
            "publicAllowed": True,
        },
    )
    draft = await svc.create_draft(
        db,
        business.id,
        editor.id,
        "Atolye kapak",
        "Ozet",
        _steps(knowledge),
    )
    return draft, knowledge


class BoundFakeImageProvider:
    def __init__(self, snapshot, blob: bytes):
        self.snapshot = snapshot
        self.blob = blob
        self.calls = 0

    async def complete(self, request):
        self.calls += 1
        from backend.services.business_yansi.cover_image_suggestions import ImageGenerationProvider

        async def generate(body, *, dispatch=None):
            if dispatch is not None:
                dispatch.mark_dispatched()
            return self.blob

        return await ImageGenerationProvider(self.snapshot, generate=generate).complete(request)


@pytest.mark.asyncio
async def test_pg_concurrent_confirm_creates_one_asset(monkeypatch, tmp_path):
    _image_env(monkeypatch, tmp_path)
    async with _database() as ctx:
        maker = ctx["maker"]
        business = ctx["business"]
        editor = ctx["editor"]
        async with maker() as db:
            draft, knowledge = await _seed_draft(db, business, editor)
            snap = _snapshot(draft, business.id)
            proposal = await suggest_image_cover(
                db, business.id, editor.id, draft.id, "pg-image-confirm-race",
                provider=BoundFakeImageProvider(snap, _png()),
            )
            proposal_id = proposal.id
            draft_id = draft.id
            version_id = knowledge.id

        barrier = asyncio.Barrier(2)
        results = []

        async def worker():
            async with maker() as session:
                await barrier.wait()
                try:
                    asset = await confirm_image_suggestion(
                        session, business.id, editor.id, draft_id, proposal_id,
                        link_version_ids=[version_id],
                    )
                    results.append(("ok", str(asset.id)))
                except Exception as exc:
                    detail = getattr(exc, "detail", None)
                    code = detail.get("code") if isinstance(detail, dict) else None
                    results.append(("err", code or type(exc).__name__))

        await asyncio.gather(worker(), worker())
        assert len(results) == 2
        oks = [item for item in results if item[0] == "ok"]
        errs = [item for item in results if item[0] == "err"]
        assert errs == [], f"both confirmations must succeed; got {results!r}"
        assert len(oks) == 2
        assert oks[0][1] == oks[1][1]
        confirmed_id = oks[0][1]
        async with maker() as db:
            assets = list((await db.scalars(select(BusinessBrandAsset).where(BusinessBrandAsset.business_id == business.id))).all())
            assert len(assets) == 1
            assert str(assets[0].id) == confirmed_id
            proposal = await db.get(BusinessCoverAiProposal, proposal_id)
            assert proposal.result_payload["confirmedAssetId"] == confirmed_id
            links = list((await db.scalars(select(BusinessKnowledgeAssetLink).where(BusinessKnowledgeAssetLink.asset_id == assets[0].id))).all())
            assert len(links) == 1
            assert links[0].status == "active"
            assert links[0].confirmed_version_id == version_id
            assert links[0].business_id == business.id


@pytest.mark.asyncio
async def test_pg_invalid_knowledge_rolls_back(monkeypatch, tmp_path):
    _image_env(monkeypatch, tmp_path)
    async with _database() as ctx:
        maker = ctx["maker"]
        business = ctx["business"]
        editor = ctx["editor"]
        async with maker() as db:
            draft, _knowledge = await _seed_draft(db, business, editor)
            snap = _snapshot(draft, business.id)
            proposal = await suggest_image_cover(
                db, business.id, editor.id, draft.id, "pg-image-bad-link",
                provider=BoundFakeImageProvider(snap, _png()),
            )
            with pytest.raises(Exception) as raised:
                await confirm_image_suggestion(
                    db, business.id, editor.id, draft.id, proposal.id,
                    link_version_ids=[uuid.uuid4()],
                )
            detail = getattr(raised.value, "detail", None)
            assert isinstance(detail, dict) and detail.get("code") == "published_knowledge_required"
            reloaded = await db.get(BusinessCoverAiProposal, proposal.id)
            assert not (reloaded.result_payload or {}).get("confirmedAssetId")
            assets = list((await db.scalars(select(BusinessBrandAsset).where(BusinessBrandAsset.business_id == business.id))).all())
            assert assets == []


@pytest.mark.asyncio
async def test_pg_draft_update_races_confirmation(monkeypatch, tmp_path):
    _image_env(monkeypatch, tmp_path)
    async with _database() as ctx:
        maker = ctx["maker"]
        business = ctx["business"]
        editor = ctx["editor"]
        async with maker() as db:
            draft, knowledge = await _seed_draft(db, business, editor)
            snap = _snapshot(draft, business.id)
            proposal = await suggest_image_cover(
                db, business.id, editor.id, draft.id, "pg-image-draft-race",
                provider=BoundFakeImageProvider(snap, _png()),
            )
            proposal_id = proposal.id
            draft_id = draft.id
            version_id = knowledge.id
            original_revision = draft.revision

        ready = asyncio.Event()
        confirm_entered = asyncio.Event()
        outcomes = []

        async def confirmer():
            async with maker() as session:
                # Hold the business lock briefly after seeing the proposal, then confirm.
                from backend.services.business_yansi.studio_media import business_media_lock
                from backend.services.business_yansi.video_authority import require_locked_actor

                async with business_media_lock(session, business.id):
                    await require_locked_actor(session, business.id, editor.id, "editor")
                    confirm_entered.set()
                    await ready.wait()
                try:
                    asset = await confirm_image_suggestion(
                        session, business.id, editor.id, draft_id, proposal_id,
                        link_version_ids=[version_id],
                    )
                    outcomes.append(("ok", str(asset.id)))
                except Exception as exc:
                    detail = getattr(exc, "detail", None)
                    code = detail.get("code") if isinstance(detail, dict) else None
                    outcomes.append(("err", code or type(exc).__name__))

        async def updater():
            await confirm_entered.wait()
            async with maker() as session:
                from backend.models.business_yansi import BusinessYansiDraft as Draft

                row = await session.get(Draft, draft_id)
                row.title = "Degisen taslak"
                row.revision = original_revision + 1
                row.source_hash = "race-hash"
                session.add(row)
                await session.commit()
            ready.set()

        await asyncio.gather(confirmer(), updater())
        # Either confirm won before the update became visible under the lock, or stale rejection.
        assert outcomes
        async with maker() as db:
            proposal = await db.get(BusinessCoverAiProposal, proposal_id)
            assets = list((await db.scalars(select(BusinessBrandAsset).where(BusinessBrandAsset.business_id == business.id))).all())
            if any(item[0] == "ok" for item in outcomes):
                assert (proposal.result_payload or {}).get("confirmedAssetId")
                assert len(assets) == 1
            else:
                assert outcomes[0][1] == "cover_ai_draft_stale"
                assert not (proposal.result_payload or {}).get("confirmedAssetId")
                assert assets == []
