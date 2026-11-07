"""Phase 2B Step 3: AI image cover proposals stay private until explicit confirm."""
import io
import json
import uuid
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi import HTTPException
from PIL import Image
from sqlalchemy import select

from backend.models.business_brand_assets import BusinessBrandAsset, BusinessKnowledgeAssetLink
from backend.models.business_cover_ai import BusinessCoverAiProposal, BusinessCoverAiUsage
from backend.services.business_yansi import service as svc
from backend.services.business_yansi.cover_ai import (
    FLAG,
    IMAGE_MODEL_ENV,
    MODEL_ENV,
    PRICES,
    CoverAiProviderError,
    CoverAiResult,
    DispatchGate,
    build_execution_spec,
    enabled,
    load_execution_spec,
    quote_for,
)
from backend.services.business_yansi.cover_ai_preview_store import (
    PREVIEW_DIR_ENV,
    cleanup_expired_previews,
    preview_root,
    store_preview,
)
from backend.services.business_yansi.cover_image_suggestions import (
    ImageGenerationProvider,
    confirm_image_suggestion,
    draft_matches,
    present_image_suggestion,
    read_image_preview,
    read_image_suggestion,
    suggest_image_cover,
)
from backend.tests.test_business_video_cover_policy import _steps
from backend.tests.test_business_yansi import sample, source


def _png(width=128, height=128, color=(30, 90, 140)) -> bytes:
    image = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


def _image_prices(monkeypatch, tmp_path, *, ceiling="1.00", daily="10.00", usd="0.04", model="gpt-image-2.5-sunburst"):
    monkeypatch.setenv(FLAG, "true")
    monkeypatch.setenv(MODEL_ENV, "gpt-4o")
    monkeypatch.setenv(IMAGE_MODEL_ENV, model)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-cover-ai-image-not-paid")
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
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_AI_REQUEST_USD", ceiling)
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_AI_DAILY_USD", daily)


class FakeImageProvider:
    def __init__(self, blob: bytes, *, mark_dispatch=True, fail_code=None):
        self.blob = blob
        self.mark_dispatch = mark_dispatch
        self.fail_code = fail_code
        self.calls = 0
        self.last_request = None

    async def complete(self, request):
        self.calls += 1
        self.last_request = request
        if self.fail_code:
            if self.mark_dispatch and request.dispatch is not None:
                request.dispatch.mark_dispatched()
            raise CoverAiProviderError(self.fail_code)
        gate = request.dispatch or DispatchGate()
        if self.mark_dispatch:
            gate.mark_dispatched()

        async def generate(body, *, dispatch=None):
            if dispatch is not None:
                dispatch.mark_dispatched()
            return self.blob

        return await ImageGenerationProvider(
            _snapshot_from_request(request),
            generate=generate,
        ).complete(request)


def _snapshot_from_request(request):
    from backend.services.business_yansi.cover_image_suggestions import DraftSnapshot

    payload = request.payload if isinstance(request.payload, dict) else {}
    return DraftSnapshot(
        draft_id=str(payload.get("draftId")),
        business_id=str(payload.get("draftId")),  # overwritten by provider store using request
        revision=int(payload.get("draftRevision") or 1),
        source_hash=str(payload.get("sourceHash") or "x"),
        title=str(payload.get("title") or ""),
        summary=str(payload.get("summary") or ""),
        qa_items=list(payload.get("qaItems") or []),
        content_fingerprint=str(payload.get("contentFingerprint") or ""),
        status="draft",
    )


class BoundFakeImageProvider:
    """Stores preview via ImageGenerationProvider using the live draft snapshot."""

    def __init__(self, snapshot, blob: bytes):
        self.snapshot = snapshot
        self.blob = blob
        self.calls = 0

    async def complete(self, request):
        self.calls += 1

        async def generate(body, *, dispatch=None):
            if dispatch is not None:
                dispatch.mark_dispatched()
            return self.blob

        return await ImageGenerationProvider(self.snapshot, generate=generate).complete(request)


async def _draft(sample, *, title="Atölye kapak", summary="Özet metin"):
    knowledge = await source(sample)
    steps = _steps(knowledge)
    draft = await svc.create_draft(
        sample.db,
        sample.business.id,
        sample.editor.id,
        title,
        summary,
        steps,
    )
    return draft, knowledge


@pytest.mark.asyncio
async def test_image_quote_uses_reserved_ceiling_not_measured_usage(monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path, usd="0.05")
    spec = quote_for("image_cover")
    assert spec.generation_kind == "image"
    assert spec.model == "gpt-image-2.5-sunburst"
    assert spec.reserved_max_usd_per_image == Decimal("0.05000000")
    assert spec.estimated_max_usd == Decimal("0.05000000")
    assert spec.image_size == "1024x1024"
    assert spec.image_output_format == "png"
    assert "usdPerImage" not in spec.as_payload()
    assert spec.as_payload()["outputFormat"] == "png"
    loaded = load_execution_spec(spec.as_payload())
    assert loaded == spec


@pytest.mark.asyncio
async def test_image_quote_fails_closed_for_unknown_model(monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path)
    monkeypatch.setenv(IMAGE_MODEL_ENV, "gpt-image-1")
    with pytest.raises(HTTPException) as raised:
        build_execution_spec("image_cover")
    assert raised.value.status_code == 422


@pytest.mark.asyncio
async def test_flag_disabled_blocks_image_suggestion(sample, monkeypatch, tmp_path):
    monkeypatch.setenv(FLAG, "false")
    draft, knowledge = await _draft(sample)
    with pytest.raises(HTTPException) as raised:
        await suggest_image_cover(
            sample.db, sample.business.id, sample.editor.id, draft.id, "cover-image-key-disabled",
            provider=BoundFakeImageProvider(None, _png()),
        )
    assert raised.value.status_code == 403
    assert raised.value.detail["code"] == "cover_ai_disabled"


@pytest.mark.asyncio
async def test_viewer_cannot_request_image_suggestion(sample, monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path)
    draft, knowledge = await _draft(sample)
    from backend.services.business_yansi.cover_image_suggestions import _snapshot

    snap = _snapshot(draft, sample.business.id)
    provider = BoundFakeImageProvider(snap, _png())
    with pytest.raises(HTTPException) as raised:
        await suggest_image_cover(
            sample.db, sample.business.id, sample.viewer.id, draft.id, "cover-image-key-viewer",
            provider=provider,
        )
    assert raised.value.status_code == 403
    assert provider.calls == 0


@pytest.mark.asyncio
async def test_image_suggestion_idempotent_same_key(sample, monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path)
    draft, knowledge = await _draft(sample)
    from backend.services.business_yansi.cover_image_suggestions import _snapshot

    snap = _snapshot(draft, sample.business.id)
    provider = BoundFakeImageProvider(snap, _png())
    first = await suggest_image_cover(
        sample.db, sample.business.id, sample.editor.id, draft.id, "cover-image-key-same",
        provider=provider,
    )
    second = await suggest_image_cover(
        sample.db, sample.business.id, sample.editor.id, draft.id, "cover-image-key-same",
        provider=provider,
    )
    assert first.id == second.id
    assert provider.calls == 1
    assert first.status == "succeeded"
    assert first.result_payload["sha256"]


@pytest.mark.asyncio
async def test_image_suggestion_conflict_on_different_payload(sample, monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path)
    draft, knowledge = await _draft(sample, title="Bir")
    from backend.services.business_yansi.cover_image_suggestions import _snapshot

    snap = _snapshot(draft, sample.business.id)
    provider = BoundFakeImageProvider(snap, _png())
    await suggest_image_cover(
        sample.db, sample.business.id, sample.editor.id, draft.id, "cover-image-key-conflict",
        provider=provider,
    )
    draft.title = "İki"
    draft.revision = 2
    draft.source_hash = "changed-hash"
    sample.db.add(draft)
    await sample.db.commit()
    await sample.db.refresh(draft)
    with pytest.raises(HTTPException) as raised:
        await suggest_image_cover(
            sample.db, sample.business.id, sample.editor.id, draft.id, "cover-image-key-conflict",
            provider=BoundFakeImageProvider(_snapshot(draft, sample.business.id), _png(color=(1, 2, 3))),
        )
    assert raised.value.status_code == 409
    assert raised.value.detail["code"] == "cover_ai_idempotency_conflict"


@pytest.mark.asyncio
async def test_private_preview_tenant_isolation(sample, monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path)
    draft, knowledge = await _draft(sample)
    from backend.services.business_yansi.cover_image_suggestions import _snapshot

    snap = _snapshot(draft, sample.business.id)
    row = await suggest_image_cover(
        sample.db, sample.business.id, sample.editor.id, draft.id, "cover-image-key-preview",
        provider=BoundFakeImageProvider(snap, _png()),
    )
    blob, mime = await read_image_preview(sample.db, sample.business.id, sample.editor.id, draft.id, row.id)
    assert mime == "image/png"
    assert blob.startswith(b"\x89PNG")
    other = await svc.create_business(
        sample.db,
        sample.admin,
        {
            "organizationId": str(sample.other.id),
            "ownerId": str(sample.outsider.id),
            "slug": "other-brand",
            "name": "Other",
        },
    )
    with pytest.raises(HTTPException) as raised:
        await read_image_preview(sample.db, other.id, sample.outsider.id, draft.id, row.id)
    assert raised.value.status_code in {403, 404}


@pytest.mark.asyncio
async def test_stale_draft_blocks_confirm(sample, monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path)
    draft, knowledge = await _draft(sample)
    from backend.services.business_yansi.cover_image_suggestions import _snapshot

    snap = _snapshot(draft, sample.business.id)
    row = await suggest_image_cover(
        sample.db, sample.business.id, sample.editor.id, draft.id, "cover-image-key-stale",
        provider=BoundFakeImageProvider(snap, _png()),
    )
    draft.title = "Değişti"
    draft.revision = draft.revision + 1
    sample.db.add(draft)
    await sample.db.commit()
    await sample.db.refresh(draft)
    assert draft_matches(row, draft) is False
    with pytest.raises(HTTPException) as raised:
        await confirm_image_suggestion(
            sample.db, sample.business.id, sample.editor.id, draft.id, row.id,
            link_version_ids=[knowledge.id],
        )
    assert raised.value.detail["code"] == "cover_ai_draft_stale"
    assets = (await sample.db.scalars(select(BusinessBrandAsset).where(BusinessBrandAsset.business_id == sample.business.id))).all()
    assert assets == []


@pytest.mark.asyncio
async def test_confirm_promotes_once_and_is_idempotent(sample, monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path)
    monkeypatch.setenv("EZA_BRAND_ASSET_DIR", str(tmp_path / "assets"))
    draft, knowledge = await _draft(sample)
    from backend.services.business_yansi.cover_image_suggestions import _snapshot
    from backend.services.business_yansi.studio_media import bind_media_plan

    snap = _snapshot(draft, sample.business.id)
    row = await suggest_image_cover(
        sample.db, sample.business.id, sample.editor.id, draft.id, "cover-image-key-confirm",
        provider=BoundFakeImageProvider(snap, _png()),
    )
    first = await confirm_image_suggestion(
        sample.db, sample.business.id, sample.editor.id, draft.id, row.id,
        link_version_ids=[knowledge.id],
    )
    second = await confirm_image_suggestion(
        sample.db, sample.business.id, sample.editor.id, draft.id, row.id,
        link_version_ids=[knowledge.id],
    )
    assert str(first.id) == str(second.id)
    assets = (await sample.db.scalars(select(BusinessBrandAsset).where(BusinessBrandAsset.business_id == sample.business.id))).all()
    assert len(assets) == 1
    assert assets[0].asset_type == "image"
    assert assets[0].status == "published"
    assert assets[0].public_allowed is True
    reloaded = await sample.db.get(BusinessCoverAiProposal, row.id)
    assert reloaded.result_payload["confirmedAssetId"] == str(first.id)
    links = (await sample.db.scalars(select(BusinessKnowledgeAssetLink).where(BusinessKnowledgeAssetLink.asset_id == first.id))).all()
    assert len(links) == 1
    assert links[0].status == "active"
    assert links[0].confirmed_version_id == knowledge.id
    plan = await bind_media_plan(
        sample.db,
        sample.business.id,
        draft.title,
        draft.summary,
        draft.steps,
        cover_asset_id=first.id,
        cover_kind="image",
    )
    assert plan["coverAssetId"] == str(first.id)


@pytest.mark.asyncio
async def test_empty_link_version_ids_rejected_before_asset(sample, monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path)
    monkeypatch.setenv("EZA_BRAND_ASSET_DIR", str(tmp_path / "assets"))
    draft, _knowledge = await _draft(sample)
    from backend.services.business_yansi.cover_image_suggestions import _snapshot

    snap = _snapshot(draft, sample.business.id)
    row = await suggest_image_cover(
        sample.db, sample.business.id, sample.editor.id, draft.id, "cover-image-key-empty-links",
        provider=BoundFakeImageProvider(snap, _png()),
    )
    with pytest.raises(HTTPException) as raised:
        await confirm_image_suggestion(
            sample.db, sample.business.id, sample.editor.id, draft.id, row.id,
            link_version_ids=[],
        )
    assert raised.value.detail["code"] == "cover_ai_links_required"
    reloaded = await sample.db.get(BusinessCoverAiProposal, row.id)
    assert not (reloaded.result_payload or {}).get("confirmedAssetId")
    assets = (await sample.db.scalars(select(BusinessBrandAsset).where(BusinessBrandAsset.business_id == sample.business.id))).all()
    assert assets == []
    links = (await sample.db.scalars(select(BusinessKnowledgeAssetLink))).all()
    assert links == []


@pytest.mark.asyncio
async def test_unrelated_or_inactive_knowledge_rejected(sample, monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path)
    monkeypatch.setenv("EZA_BRAND_ASSET_DIR", str(tmp_path / "assets"))
    draft, knowledge = await _draft(sample)
    unrelated = await svc.create_knowledge(
        sample.db,
        sample.business.id,
        sample.editor.id,
        {
            "title": "Baska bilgi",
            "content": "Bu surum taslak kaynaklarinda yok.",
            "source": "Dahili not",
            "publicAllowed": True,
        },
    )
    inactive = await svc.create_knowledge(
        sample.db,
        sample.business.id,
        sample.editor.id,
        {
            "title": "Gizli bilgi",
            "content": "Yayinlanmayan bilgi surumu.",
            "source": "Dahili not",
            "publicAllowed": False,
        },
    )
    from backend.services.business_yansi.cover_image_suggestions import _snapshot

    snap = _snapshot(draft, sample.business.id)
    row = await suggest_image_cover(
        sample.db, sample.business.id, sample.editor.id, draft.id, "cover-image-key-bad-scope",
        provider=BoundFakeImageProvider(snap, _png()),
    )
    with pytest.raises(HTTPException) as raised:
        await confirm_image_suggestion(
            sample.db, sample.business.id, sample.editor.id, draft.id, row.id,
            link_version_ids=[unrelated.id],
        )
    assert raised.value.detail["code"] == "cover_ai_link_not_in_draft"
    with pytest.raises(HTTPException) as raised_inactive:
        await confirm_image_suggestion(
            sample.db, sample.business.id, sample.editor.id, draft.id, row.id,
            link_version_ids=[inactive.id],
        )
    assert raised_inactive.value.detail["code"] == "published_knowledge_required"
    # Draft-linked active knowledge still succeeds after failed attempts.
    asset = await confirm_image_suggestion(
        sample.db, sample.business.id, sample.editor.id, draft.id, row.id,
        link_version_ids=[knowledge.id],
    )
    assert asset.public_allowed is True
    reloaded = await sample.db.get(BusinessCoverAiProposal, row.id)
    assert reloaded.result_payload["confirmedAssetId"] == str(asset.id)


@pytest.mark.asyncio
async def test_confirm_preserves_previous_cover_on_failure(sample, monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path)
    monkeypatch.setenv("EZA_BRAND_ASSET_DIR", str(tmp_path / "assets"))
    from backend.services.business_yansi.brand_asset_library import create_asset

    previous = await create_asset(
        sample.db,
        sample.business.id,
        sample.editor.id,
        {"asset_type": "image", "title": "Eski kapak", "caption": "", "public_allowed": False},
        image_bytes=_png(color=(200, 20, 20)),
    )
    draft, knowledge = await _draft(sample)
    from backend.services.business_yansi.cover_image_suggestions import _snapshot

    snap = _snapshot(draft, sample.business.id)
    row = await suggest_image_cover(
        sample.db, sample.business.id, sample.editor.id, draft.id, "cover-image-key-keep",
        provider=BoundFakeImageProvider(snap, _png()),
    )
    # Corrupt preview so confirm fails after proposal succeeded.
    store_path = Path(preview_root()) / str(sample.business.id) / str(row.id) / "image.bin"
    store_path.write_bytes(b"not-an-image")
    with pytest.raises(HTTPException):
        await confirm_image_suggestion(
            sample.db, sample.business.id, sample.editor.id, draft.id, row.id,
            link_version_ids=[knowledge.id],
        )
    kept = await sample.db.get(BusinessBrandAsset, previous.id)
    assert kept is not None
    assert kept.title == "Eski kapak"
    reloaded = await sample.db.get(BusinessCoverAiProposal, row.id)
    assert not (reloaded.result_payload or {}).get("confirmedAssetId")


@pytest.mark.asyncio
async def test_preview_cleanup_removes_owned_expired(sample, monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path)
    draft, _knowledge = await _draft(sample)
    from backend.services.business_yansi.cover_image_suggestions import _snapshot

    snap = _snapshot(draft, sample.business.id)
    row = await suggest_image_cover(
        sample.db, sample.business.id, sample.editor.id, draft.id, "cover-image-key-expire",
        provider=BoundFakeImageProvider(snap, _png()),
    )
    meta_path = Path(preview_root()) / str(sample.business.id) / str(row.id) / "meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    meta["expiresAt"] = "2000-01-01T00:00:00Z"
    meta_path.write_text(json.dumps(meta), encoding="utf-8")
    removed = await cleanup_expired_previews(sample.db, limit=10)
    assert removed == 1
    assert not (Path(preview_root()) / str(sample.business.id) / str(row.id)).exists()


@pytest.mark.asyncio
async def test_image_budget_enforced(sample, monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path, ceiling="0.01", usd="0.04")
    draft, knowledge = await _draft(sample)
    from backend.services.business_yansi.cover_image_suggestions import _snapshot

    snap = _snapshot(draft, sample.business.id)
    with pytest.raises(HTTPException) as raised:
        await suggest_image_cover(
            sample.db, sample.business.id, sample.editor.id, draft.id, "cover-image-key-budget",
            provider=BoundFakeImageProvider(snap, _png()),
        )
    assert raised.value.status_code == 429
    assert raised.value.detail["code"] == "cover_ai_request_ceiling"


@pytest.mark.asyncio
async def test_corrupt_image_execution_spec_rejected(monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path)
    spec = quote_for("image_cover").as_payload()
    spec["reservedMaxUsdPerImage"] = "0.01"
    assert load_execution_spec(spec) is None
    spec = quote_for("image_cover").as_payload()
    spec["imageCount"] = 2
    assert load_execution_spec(spec) is None
    spec = quote_for("image_cover").as_payload()
    del spec["outputFormat"]
    assert load_execution_spec(spec) is None


def test_cover_ai_flag_defaults_off_for_image_path(monkeypatch):
    monkeypatch.delenv(FLAG, raising=False)
    assert enabled() is False


@pytest.mark.asyncio
async def test_provider_does_not_label_reservation_as_measured_usage(sample, monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path)
    draft, knowledge = await _draft(sample)
    from backend.services.business_yansi.cover_image_suggestions import _snapshot

    snap = _snapshot(draft, sample.business.id)
    row = await suggest_image_cover(
        sample.db, sample.business.id, sample.editor.id, draft.id, "cover-image-key-unknown-cost",
        provider=BoundFakeImageProvider(snap, _png()),
    )
    assert row.status == "succeeded"
    assert row.cost_known is False
    assert Decimal(str(row.cost_usd)) == 0
    assert Decimal(str(row.reserved_cost_usd)) == Decimal("0.04000000")


@pytest.mark.asyncio
async def test_invalid_knowledge_link_rolls_back_confirmation(sample, monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path)
    monkeypatch.setenv("EZA_BRAND_ASSET_DIR", str(tmp_path / "assets"))
    draft, _knowledge = await _draft(sample)
    from backend.services.business_yansi.cover_image_suggestions import _snapshot

    snap = _snapshot(draft, sample.business.id)
    row = await suggest_image_cover(
        sample.db, sample.business.id, sample.editor.id, draft.id, "cover-image-key-bad-link",
        provider=BoundFakeImageProvider(snap, _png()),
    )
    with pytest.raises(HTTPException) as raised:
        await confirm_image_suggestion(
            sample.db, sample.business.id, sample.editor.id, draft.id, row.id,
            link_version_ids=[uuid.uuid4()],
        )
    assert raised.value.detail["code"] == "published_knowledge_required"
    reloaded = await sample.db.get(BusinessCoverAiProposal, row.id)
    assert not (reloaded.result_payload or {}).get("confirmedAssetId")
    assets = (await sample.db.scalars(select(BusinessBrandAsset).where(BusinessBrandAsset.business_id == sample.business.id))).all()
    assert assets == []
    links = (await sample.db.scalars(select(BusinessKnowledgeAssetLink))).all()
    assert links == []


@pytest.mark.asyncio
async def test_preview_cleanup_preserves_foreign_uuid_directory(sample, monkeypatch, tmp_path):
    """UUID path + expired meta.json alone must not authorize recursive delete."""
    _image_prices(monkeypatch, tmp_path)
    root = Path(preview_root())
    keep = root / "keep"
    keep.mkdir(parents=True)
    sentinel = keep / "sentinel.txt"
    sentinel.write_text("stay", encoding="utf-8")
    old = root / "not-a-uuid-dir"
    old.mkdir()
    (old / "stale.bin").write_bytes(b"x")

    foreign_business = uuid.uuid4()
    foreign_proposal = uuid.uuid4()
    foreign_dir = root / str(foreign_business) / str(foreign_proposal)
    foreign_dir.mkdir(parents=True)
    (foreign_dir / "meta.json").write_text(
        json.dumps({"expiresAt": "2000-01-01T00:00:00Z", "note": "not-a-store-preview"}),
        encoding="utf-8",
    )
    foreign_sentinel = foreign_dir / "sentinel.txt"
    foreign_sentinel.write_text("foreign-owned", encoding="utf-8")

    # Orphan store-shaped preview without proposal ownership must also survive.
    orphan_business = uuid.uuid4()
    orphan_proposal = uuid.uuid4()
    orphan_meta = store_preview(orphan_business, orphan_proposal, _png())
    orphan_path = root / str(orphan_business) / str(orphan_proposal) / "meta.json"
    orphan_expired = dict(orphan_meta)
    orphan_expired["expiresAt"] = "2000-01-01T00:00:00Z"
    orphan_path.write_text(json.dumps(orphan_expired), encoding="utf-8")

    removed = await cleanup_expired_previews(sample.db, limit=50)
    assert removed == 0
    assert sentinel.read_text(encoding="utf-8") == "stay"
    assert (old / "stale.bin").is_file()
    assert foreign_sentinel.read_text(encoding="utf-8") == "foreign-owned"
    assert orphan_path.is_file()


@pytest.mark.asyncio
async def test_preview_cleanup_keeps_non_expired_and_rejects_malformed_meta(sample, monkeypatch, tmp_path):
    _image_prices(monkeypatch, tmp_path)
    draft, _knowledge = await _draft(sample)
    from backend.services.business_yansi.cover_image_suggestions import _snapshot

    snap = _snapshot(draft, sample.business.id)
    live = await suggest_image_cover(
        sample.db, sample.business.id, sample.editor.id, draft.id, "cover-image-key-live-preview",
        provider=BoundFakeImageProvider(snap, _png()),
    )
    live_dir = Path(preview_root()) / str(sample.business.id) / str(live.id)
    assert live_dir.is_dir()

    bad = await suggest_image_cover(
        sample.db, sample.business.id, sample.editor.id, draft.id, "cover-image-key-bad-meta",
        provider=BoundFakeImageProvider(snap, _png(color=(9, 9, 9))),
    )
    bad_meta = Path(preview_root()) / str(sample.business.id) / str(bad.id) / "meta.json"
    bad_meta.write_text("{not-json", encoding="utf-8")

    removed = await cleanup_expired_previews(sample.db, limit=20)
    assert removed == 0
    assert live_dir.is_dir()
    assert bad_meta.is_file()


@pytest.mark.asyncio
async def test_preview_cleanup_rejects_symlink_escape(sample, monkeypatch, tmp_path):
    import os
    import subprocess

    _image_prices(monkeypatch, tmp_path)
    root = Path(preview_root())
    outside = tmp_path / "outside-tenant"
    outside.mkdir()
    victim = outside / "secret.txt"
    victim.write_text("do-not-delete", encoding="utf-8")

    business = uuid.uuid4()
    proposal = uuid.uuid4()
    link_dir = root / str(business)
    link_dir.mkdir(parents=True)
    target = link_dir / str(proposal)
    linked = False
    try:
        target.symlink_to(outside, target_is_directory=True)
        linked = True
    except OSError:
        if os.name == "nt":
            created = subprocess.run(
                ["cmd", "/c", "mklink", "/J", str(target), str(outside)],
                capture_output=True,
                text=True,
            )
            linked = created.returncode == 0 and target.exists()
    if not linked:
        pytest.skip("symlink/junction creation unavailable on this host")

    removed = await cleanup_expired_previews(sample.db, limit=20)
    assert removed == 0
    assert victim.read_text(encoding="utf-8") == "do-not-delete"
    assert outside.is_dir()


@pytest.mark.asyncio
async def test_stale_identity_map_draft_rejected_on_confirm(sample, monkeypatch, tmp_path):
    """Session holds an old Draft instance while another session advances the row."""
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from backend.models.business_yansi import BusinessYansiDraft as Draft
    from backend.services.business_yansi.cover_image_suggestions import _snapshot

    _image_prices(monkeypatch, tmp_path)
    monkeypatch.setenv("EZA_BRAND_ASSET_DIR", str(tmp_path / "assets"))
    draft, knowledge = await _draft(sample)
    snap = _snapshot(draft, sample.business.id)
    row = await suggest_image_cover(
        sample.db, sample.business.id, sample.editor.id, draft.id, "cover-image-key-stale-map",
        provider=BoundFakeImageProvider(snap, _png()),
    )
    stale = await sample.db.get(Draft, draft.id)
    original_title = stale.title
    original_revision = stale.revision
    maker = async_sessionmaker(sample.db.bind, expire_on_commit=False)
    async with maker() as other_db:
        live = await other_db.get(Draft, draft.id)
        live.title = "Yeni baslik"
        live.revision = original_revision + 1
        live.source_hash = "fresh-source-hash"
        other_db.add(live)
        await other_db.commit()
    assert stale.title == original_title
    assert stale.revision == original_revision
    with pytest.raises(HTTPException) as raised:
        await confirm_image_suggestion(
            sample.db, sample.business.id, sample.editor.id, draft.id, row.id,
            link_version_ids=[knowledge.id],
        )
    assert raised.value.detail["code"] == "cover_ai_draft_stale"
