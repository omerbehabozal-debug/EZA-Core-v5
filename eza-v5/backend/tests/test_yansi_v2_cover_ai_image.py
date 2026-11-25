"""07H.2 — V2 conversation draft Cover AI adapter (mock provider only)."""
from __future__ import annotations

import io
import json
import uuid

import pytest
from fastapi import HTTPException
from PIL import Image
from sqlalchemy import select

from backend.core.utils.dependencies import Base
from backend.models.business_brand_assets import BusinessBrandAsset, BusinessKnowledgeAssetLink
from backend.models.business_cover_ai import BusinessCoverAiProposal, BusinessCoverAiUsage
from backend.models.yansi_v2_conversation_draft import YansiV2ConversationDraft
from backend.services.business_yansi import service as svc
from backend.services.business_yansi.cover_ai import (
    FLAG,
    IMAGE_MODEL_ENV,
    MODEL_ENV,
    PRICES,
    CoverAiProviderError,
)
from backend.services.business_yansi.cover_ai_preview_store import PREVIEW_DIR_ENV
from backend.services.business_yansi.cover_image_suggestions import ImageGenerationProvider
from backend.services.yansi import conversation_draft_v2 as drafts
from backend.services.yansi.cover_image_suggestions_v2 import (
    DRAFT_KIND,
    confirm_image_suggestion_v2,
    read_image_preview_v2,
    read_image_suggestion_v2,
    snapshot_v2,
    suggest_image_cover_v2,
)
from backend.tests.test_business_yansi import sample  # noqa: F401
from backend.tests.test_business_yansi import source


def _png(width=128, height=128, color=(40, 100, 160)) -> bytes:
    image = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


def _image_prices(monkeypatch, tmp_path, *, usd="0.04", model="gpt-image-2.5-sunburst"):
    monkeypatch.setenv(FLAG, "true")
    monkeypatch.setenv(MODEL_ENV, "gpt-4o")
    monkeypatch.setenv(IMAGE_MODEL_ENV, model)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-cover-ai-v2-not-paid")
    monkeypatch.setenv(PREVIEW_DIR_ENV, str(tmp_path / "previews"))
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
                model: {
                    "reservedMaxUsdPerImage": usd,
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


async def _ensure_tables(db):
    def create(sync):
        Base.metadata.create_all(
            sync.connection(),
            tables=[
                YansiV2ConversationDraft.__table__,
                BusinessCoverAiProposal.__table__,
                BusinessCoverAiUsage.__table__,
            ],
        )

    await db.run_sync(create)


class BoundFakeImageProvider:
    def __init__(self, snapshot, blob: bytes, *, fail_code=None):
        self.snapshot = snapshot
        self.blob = blob
        self.fail_code = fail_code
        self.calls = 0
        self.last_body = None

    async def complete(self, request):
        self.calls += 1
        if self.fail_code:
            if request.dispatch is not None:
                request.dispatch.mark_dispatched()
            raise CoverAiProviderError(self.fail_code)

        async def generate(body, *, dispatch=None):
            self.last_body = body
            if dispatch is not None:
                dispatch.mark_dispatched()
            return self.blob

        return await ImageGenerationProvider(self.snapshot, generate=generate).complete(request)


async def _v2_draft(sample, *, with_knowledge=True, title="V2 Kapak", approved=False):
    await _ensure_tables(sample.db)
    knowledge = await source(sample) if with_knowledge else None
    pins = None
    if knowledge is not None:
        pins = [{"knowledgeVersionId": str(knowledge.id), "expectedRevision": int(knowledge.revision)}]
    created = await drafts.create_conversation_draft_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.editor.id),
        title=title,
        summary="Kısa özet merak uyandırır.",
        turns=[
            {
                "stepIndex": 1,
                "question": "Atölye bakımı nasıl yapılır?",
                "answer": "Düzenli temizlik ve doğru yağlama ile.",
            }
        ],
        knowledge_sources=pins,
    )
    if approved:
        created = await drafts.transition_conversation_draft_v2(
            sample.db,
            business_id=str(sample.business.id),
            actor_user_id=str(sample.owner.id),
            draft_id=created["id"],
            target="review",
            expected_revision=created["revision"],
        )
        created = await drafts.transition_conversation_draft_v2(
            sample.db,
            business_id=str(sample.business.id),
            actor_user_id=str(sample.owner.id),
            draft_id=created["id"],
            target="approved",
            expected_revision=created["revision"],
        )
    row = await sample.db.get(YansiV2ConversationDraft, uuid.UUID(created["id"]))
    return created, row, knowledge


@pytest.mark.asyncio
async def test_v2_suggest_preview_confirm_binds_cover(sample, monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path)
    created, row, knowledge = await _v2_draft(sample)
    snap = snapshot_v2(row, sample.business.id, visual_direction="sakin atölye ışığı")
    assert snap.draft_kind == DRAFT_KIND
    assert "curiosity" in snap.payload() or snap.curiosity
    provider = BoundFakeImageProvider(snap, _png())
    proposal = await suggest_image_cover_v2(
        sample.db,
        sample.business.id,
        sample.editor.id,
        created["id"],
        "v2-cover-key-1",
        visual_direction="sakin atölye ışığı",
        provider=provider,
    )
    assert provider.calls == 1
    assert proposal.status == "succeeded"
    assert proposal.request_payload["draftKind"] == DRAFT_KIND
    assert proposal.request_payload["visualDirection"]
    assert provider.last_body["model"] == "gpt-image-2.5-sunburst"
    assert provider.last_body["size"] == "1024x1024"
    assert provider.last_body["quality"] == "medium"
    assert provider.last_body["n"] == 1
    assert "SOURCE TEXT" in provider.last_body["prompt"] or "title:" in provider.last_body["prompt"]
    assert knowledge.content not in provider.last_body["prompt"]

    blob, mime = await read_image_preview_v2(
        sample.db, sample.business.id, sample.editor.id, created["id"], proposal.id,
    )
    assert mime == "image/png"
    assert blob.startswith(b"\x89PNG")

    presented = await read_image_suggestion_v2(
        sample.db, sample.business.id, sample.editor.id, created["id"], proposal.id,
    )
    assert presented["previewReady"] is True

    result = await confirm_image_suggestion_v2(
        sample.db,
        sample.business.id,
        sample.editor.id,
        created["id"],
        proposal.id,
        public_allowed=True,
        link_version_ids=[knowledge.id],
        expected_revision=created["revision"],
        bind_cover=True,
    )
    asset = result["asset"]
    draft = result["draft"]
    assert asset.public_allowed is True
    assert asset.status == "published"
    assert draft["coverAssetId"] == str(asset.id).lower()
    assert draft["coverAssetRevision"] == int(asset.revision)
    assert draft["revision"] == created["revision"] + 1
    assert draft["status"] == "draft"
    link = await sample.db.scalar(
        select(BusinessKnowledgeAssetLink).where(BusinessKnowledgeAssetLink.asset_id == asset.id)
    )
    assert link is not None

    # Double confirm is idempotent for the asset.
    again = await confirm_image_suggestion_v2(
        sample.db,
        sample.business.id,
        sample.editor.id,
        created["id"],
        proposal.id,
        public_allowed=True,
        link_version_ids=[knowledge.id],
        bind_cover=False,
    )
    assert again["asset"].id == asset.id


@pytest.mark.asyncio
async def test_v2_confirm_requires_public_allowed(sample, monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path)
    created, row, knowledge = await _v2_draft(sample)
    snap = snapshot_v2(row, sample.business.id)
    proposal = await suggest_image_cover_v2(
        sample.db, sample.business.id, sample.editor.id, created["id"], "v2-cover-public",
        provider=BoundFakeImageProvider(snap, _png()),
    )
    with pytest.raises(HTTPException) as raised:
        await confirm_image_suggestion_v2(
            sample.db,
            sample.business.id,
            sample.editor.id,
            created["id"],
            proposal.id,
            public_allowed=False,
            link_version_ids=[knowledge.id],
        )
    assert raised.value.status_code == 422
    assert raised.value.detail["code"] == "cover_ai_public_required"


@pytest.mark.asyncio
async def test_v2_foreign_business_denied(sample, monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path)
    created, row, knowledge = await _v2_draft(sample)
    snap = snapshot_v2(row, sample.business.id)
    proposal = await suggest_image_cover_v2(
        sample.db, sample.business.id, sample.editor.id, created["id"], "v2-cover-foreign",
        provider=BoundFakeImageProvider(snap, _png()),
    )
    other = await svc.create_business(
        sample.db,
        sample.admin,
        {
            "organizationId": str(sample.other.id),
            "ownerId": str(sample.outsider.id),
            "slug": "other-v2-cover",
            "name": "Other",
        },
    )
    with pytest.raises(HTTPException) as raised:
        await read_image_preview_v2(sample.db, other.id, sample.outsider.id, created["id"], proposal.id)
    assert raised.value.status_code in {403, 404}


@pytest.mark.asyncio
async def test_v2_viewer_cannot_suggest(sample, monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path)
    created, row, _ = await _v2_draft(sample)
    snap = snapshot_v2(row, sample.business.id)
    provider = BoundFakeImageProvider(snap, _png())
    with pytest.raises(HTTPException) as raised:
        await suggest_image_cover_v2(
            sample.db, sample.business.id, sample.viewer.id, created["id"], "v2-cover-viewer",
            provider=provider,
        )
    assert raised.value.status_code == 403
    assert provider.calls == 0


@pytest.mark.asyncio
async def test_v2_flag_disabled(sample, monkeypatch, tmp_path):
    monkeypatch.setenv(FLAG, "false")
    created, _, _ = await _v2_draft(sample)
    with pytest.raises(HTTPException) as raised:
        await suggest_image_cover_v2(
            sample.db, sample.business.id, sample.editor.id, created["id"], "v2-cover-off",
            provider=BoundFakeImageProvider(None, _png()),
        )
    assert raised.value.detail["code"] == "cover_ai_disabled"


@pytest.mark.asyncio
async def test_v2_provider_failure_settles(sample, monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path)
    created, row, _ = await _v2_draft(sample)
    snap = snapshot_v2(row, sample.business.id)
    proposal = await suggest_image_cover_v2(
        sample.db, sample.business.id, sample.editor.id, created["id"], "v2-cover-fail",
        provider=BoundFakeImageProvider(snap, _png(), fail_code="cover_ai_provider_failed"),
    )
    assert proposal.status == "failed"
    usage = await sample.db.scalar(
        select(BusinessCoverAiUsage).where(BusinessCoverAiUsage.proposal_id == proposal.id)
    )
    assert usage is not None


@pytest.mark.asyncio
async def test_v2_stale_draft_blocks_first_confirm(sample, monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path)
    created, row, knowledge = await _v2_draft(sample)
    snap = snapshot_v2(row, sample.business.id)
    proposal = await suggest_image_cover_v2(
        sample.db, sample.business.id, sample.editor.id, created["id"], "v2-cover-stale",
        provider=BoundFakeImageProvider(snap, _png()),
    )
    await drafts.revise_conversation_draft_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.editor.id),
        draft_id=created["id"],
        expected_revision=created["revision"],
        title="Değişti",
        summary=created.get("summary") or "",
        turns=created["turns"],
        knowledge_sources=created.get("knowledgeSourcePins"),
    )
    with pytest.raises(HTTPException) as raised:
        await confirm_image_suggestion_v2(
            sample.db,
            sample.business.id,
            sample.editor.id,
            created["id"],
            proposal.id,
            public_allowed=True,
            link_version_ids=[knowledge.id],
        )
    assert raised.value.detail["code"] == "cover_ai_draft_stale"


@pytest.mark.asyncio
async def test_v2_approval_invalidated_on_cover_bind(sample, monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path)
    created, row, knowledge = await _v2_draft(sample, approved=True)
    assert created["status"] == "approved"
    snap = snapshot_v2(row, sample.business.id)
    # Reload after approve — status approved is editable for cover AI.
    row = await sample.db.get(YansiV2ConversationDraft, uuid.UUID(created["id"]))
    snap = snapshot_v2(row, sample.business.id)
    proposal = await suggest_image_cover_v2(
        sample.db, sample.business.id, sample.editor.id, created["id"], "v2-cover-approve",
        provider=BoundFakeImageProvider(snap, _png()),
    )
    result = await confirm_image_suggestion_v2(
        sample.db,
        sample.business.id,
        sample.editor.id,
        created["id"],
        proposal.id,
        public_allowed=True,
        link_version_ids=[knowledge.id],
        expected_revision=created["revision"],
        bind_cover=True,
    )
    assert result["draft"]["status"] == "draft"
    assert result["draft"]["approvedBy"] is None
    assert result["draft"]["approvedRevision"] is None


@pytest.mark.asyncio
async def test_v2_published_draft_blocked(sample, monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path)
    created, row, _ = await _v2_draft(sample)
    row.status = "published"
    row.published_node_id = uuid.uuid4()
    row.published_version = 1
    sample.db.add(row)
    await sample.db.commit()
    await sample.db.refresh(row)
    with pytest.raises(HTTPException) as raised:
        snapshot_v2(row, sample.business.id)
    assert raised.value.detail["code"] in {"draft_not_editable", "draft_immutable"}
