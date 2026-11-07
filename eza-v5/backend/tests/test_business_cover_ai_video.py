"""Video cover suggestions propose intervals. They do not create a cover."""
import json
import os
import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select

from backend.models.business_cover_ai import BusinessCoverAiProposal
from backend.models.business_video_cover_jobs import BusinessVideoCoverJob
from backend.routers import business_yansi as routes
from backend.services.business_yansi import brand_asset_library as library
from backend.services.business_yansi import service as svc
from backend.services.business_yansi.cover_ai import FLAG, CoverAiProviderError, CoverAiResult
from backend.services.business_yansi.cover_jobs import retarget_cover
from backend.services.business_yansi.cover_video_suggestions import (
    VIDEO_MODEL,
    accept_intervals,
    interpret_intervals,
    interval_request,
    present_suggestion,
    suggest_video_intervals,
)
from backend.services.business_yansi.media_observations import enabled as observations_enabled
from backend.services.business_yansi.observation_rank import ranking_enabled
from backend.tests.test_business_cover_ai_proposals import _prices
from backend.tests.test_business_video_cover_policy import _steps
from backend.services.business_yansi.video_storage import MemoryVideoStore as Store
from backend.tests.test_business_video_storage import Upload, VideoQuotaRedis, _mp4
from backend.tests.test_business_yansi import sample, source


@pytest.fixture(autouse=True)
def _budget_and_probe(monkeypatch):
    quota = VideoQuotaRedis()

    async def client():
        return quota

    monkeypatch.setattr("backend.services.business_yansi.video_ingest._redis", client)

    async def accept(_path: str) -> None:
        return None

    monkeypatch.setattr("backend.services.business_yansi.video_mp4.probe_file", accept)


class FakeIntervals:
    def __init__(self, db=None, payload=None, model=None):
        self.db = db
        self.payload = {"intervals": [{"startSeconds": 1, "endSeconds": 6}]} if payload is None else payload
        self.model = model
        self.calls = 0
        self.in_transaction = None

    async def complete(self, request):
        self.calls += 1
        if self.db is not None:
            self.in_transaction = self.db.in_transaction()
        return CoverAiResult(payload=self.payload, model=self.model or request.spec.model)


def _forbid(monkeypatch):
    calls = {"n": 0}

    async def boom(*_args, **_kwargs):
        calls["n"] += 1
        raise AssertionError("cover suggestion ran")

    monkeypatch.setattr("backend.services.business_yansi.cover_video_suggestions.suggest_video_intervals", boom)
    monkeypatch.setattr("backend.services.business_yansi.cover_video_suggestions.post_chat", boom)
    monkeypatch.setattr("backend.services.business_yansi.cover_ai.run_proposal", boom)
    return calls


async def _video(sample, business_id, editor_id, seconds=40):
    from backend.services.business_yansi.video_ingest import ingest_upload

    return await ingest_upload(
        sample.db, business_id, editor_id, store=Store(), upload=Upload(_mp4(seconds=seconds)),
        title="Orijinal film", caption="", purpose="step", public_allowed=True, prepare_cover=False,
    )


def _claims(user_id):
    return {"user_id": str(user_id)}


def test_interval_request_names_timestamps_and_does_not_attach_the_file():
    body = interval_request([(1200, b"\xff\xd8"), (3400, b"\xff")], 40, "fake-cover-model", 400)
    encoded = json.dumps(body)
    assert body["model"] == "fake-cover-model" and body["max_tokens"] == 400
    assert "1200" in encoded and "3400" in encoded
    assert "data:image/jpeg;base64" in encoded
    assert "source.mp4" not in encoded
    assert "Do not return coverAssetId" in body["messages"][0]["content"]


def test_invalid_intervals_are_discarded_and_foreign_fields_are_ignored():
    kept = accept_intervals(
        {
            "coverAssetId": "asset",
            "jobId": "job",
            "approved": True,
            "intervals": [
                {"startSeconds": 1, "endSeconds": 6},
                {"startSeconds": 0, "endSeconds": 30},
                {"startSeconds": float("nan"), "endSeconds": 2},
                {"startSeconds": float("inf"), "endSeconds": 3},
                {"startSeconds": True, "endSeconds": 4},
                {"startSeconds": -1, "endSeconds": 2},
                {"startSeconds": 8, "endSeconds": 8},
                {"startSeconds": 8, "endSeconds": 12},
                {"startSeconds": 14, "endSeconds": 16},
                {"startSeconds": 18, "endSeconds": 19},
            ],
        },
        40,
    )
    assert kept == [
        {"startSeconds": 1.0, "endSeconds": 6.0},
        {"startSeconds": 8.0, "endSeconds": 12.0},
        {"startSeconds": 14.0, "endSeconds": 16.0},
    ]
    with pytest.raises(CoverAiProviderError) as rejected:
        accept_intervals({"coverAssetId": "asset"}, 40)
    assert rejected.value.code == "cover_ai_intervals_rejected"


async def test_unconfigured_adapter_does_not_call_the_provider(monkeypatch):
    from backend.services.business_yansi.cover_ai import CoverAiRequest, CoverAiExecutionSpec, DispatchGate
    from decimal import Decimal

    calls = {"n": 0}

    async def boom(*_args, **_kwargs):
        calls["n"] += 1
        raise AssertionError("provider ran")

    monkeypatch.setattr("backend.services.business_yansi.cover_video_suggestions.post_chat", boom)
    empty = CoverAiRequest(
        kind="video_intervals",
        payload={},
        spec=CoverAiExecutionSpec(
            model="",
            pricing_version="v1",
            image_detail="low",
            max_frames=4,
            max_input_tokens=12000,
            max_output_tokens=400,
            tokens_per_image=85,
            prompt_tokens=500,
            calculated_input_tokens=840,
            input_usd_per_1k=Decimal("0.01"),
            output_usd_per_1k=Decimal("0.02"),
            estimated_max_usd=Decimal("0.0164"),
        ),
        dispatch=DispatchGate(),
    )
    with pytest.raises(CoverAiProviderError) as missing:
        await interpret_intervals([(0, b"\xff")], 10, request=empty)
    assert missing.value.code == "cover_ai_provider_not_configured"
    assert calls["n"] == 0


async def test_upload_does_not_call_the_provider(sample, monkeypatch):
    calls = _forbid(monkeypatch)
    _prices(monkeypatch)
    business_id, editor_id = sample.business.id, sample.editor.id
    original = await _video(sample, business_id, editor_id, seconds=8)
    assert original.id is not None and calls["n"] == 0
    assert await sample.db.scalar(select(func.count()).select_from(BusinessCoverAiProposal)) == 0
    assert await sample.db.scalar(select(func.count()).select_from(BusinessVideoCoverJob)) == 0


async def test_draft_save_does_not_call_the_provider(sample, monkeypatch):
    calls = _forbid(monkeypatch)
    _prices(monkeypatch)
    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Taslak", "Atolye", _steps(knowledge),
    )
    assert draft.status == "draft" and calls["n"] == 0
    assert await sample.db.scalar(select(func.count()).select_from(BusinessCoverAiProposal)) == 0


async def test_availability_does_not_call_the_provider(sample, monkeypatch):
    calls = _forbid(monkeypatch)
    business_id, editor_id, viewer_id, outsider_id = (
        sample.business.id, sample.editor.id, sample.viewer.id, sample.outsider.id,
    )
    hidden = await routes.cover_ai_availability(business_id, sample.db, _claims(viewer_id))
    assert hidden == {"enabled": False}
    _prices(monkeypatch)
    shown = await routes.cover_ai_availability(business_id, sample.db, _claims(editor_id))
    assert shown == {"enabled": True} and calls["n"] == 0
    with pytest.raises(HTTPException) as outsider:
        await routes.cover_ai_availability(business_id, sample.db, _claims(outsider_id))
    assert outsider.value.status_code == 403 and calls["n"] == 0


async def test_viewer_cross_tenant_and_remote_video_do_not_call_the_provider(sample, monkeypatch):
    _prices(monkeypatch)
    provider = FakeIntervals(sample.db)
    business_id, editor_id, viewer_id, outsider_id, other_id = (
        sample.business.id, sample.editor.id, sample.viewer.id, sample.outsider.id, sample.other.id,
    )
    original = await _video(sample, business_id, editor_id)
    asset_id = original.id
    remote = await library.create_asset(
        sample.db, business_id, editor_id,
        {"asset_type": "video", "title": "Uzaktan", "locator": "https://cdn.example.test/film.mp4"},
    )
    remote_id = remote.id
    with pytest.raises(HTTPException) as viewer:
        await suggest_video_intervals(
            sample.db, business_id, viewer_id, asset_id, "suggest-key-1", provider=provider,
        )
    assert viewer.value.status_code == 403
    with pytest.raises(HTTPException) as outsider:
        await suggest_video_intervals(
            sample.db, business_id, outsider_id, asset_id, "suggest-key-1", provider=provider,
        )
    assert outsider.value.status_code == 403
    with pytest.raises(HTTPException) as other:
        await suggest_video_intervals(
            sample.db, other_id, editor_id, asset_id, "suggest-key-1", provider=provider,
        )
    assert other.value.status_code == 404
    with pytest.raises(HTTPException) as url:
        await suggest_video_intervals(
            sample.db, business_id, editor_id, remote_id, "suggest-key-1", provider=provider,
        )
    assert url.value.detail["code"] == "cover_source_not_stored"
    assert provider.calls == 0
    assert await sample.db.scalar(select(func.count()).select_from(BusinessCoverAiProposal)) == 0


async def test_missing_price_and_budgets_fail_before_a_call(sample, monkeypatch):
    provider = FakeIntervals(sample.db)
    business_id, editor_id = sample.business.id, sample.editor.id
    original = await _video(sample, business_id, editor_id)
    asset_id = original.id
    monkeypatch.setenv(FLAG, "true")
    monkeypatch.setenv(VIDEO_MODEL, "gpt-4o")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-cover-ai-not-paid")
    monkeypatch.delenv("BILIGN_BUSINESS_COVER_AI_PRICES_JSON", raising=False)
    with pytest.raises(HTTPException) as missing:
        await suggest_video_intervals(
            sample.db, business_id, editor_id, asset_id, "suggest-key-1", provider=provider,
        )
    assert missing.value.detail["code"] == "cover_ai_pricing_not_configured"
    _prices(monkeypatch, input_rate="1.00", output_rate="1.00", ceiling="0.01", daily="10.00")
    with pytest.raises(HTTPException) as ceiling:
        await suggest_video_intervals(
            sample.db, business_id, editor_id, asset_id, "suggest-key-1", provider=provider,
        )
    assert ceiling.value.detail["code"] == "cover_ai_request_ceiling"
    _prices(monkeypatch, input_rate="0.01", output_rate="0.02", ceiling="1.00", daily="0.001")
    with pytest.raises(HTTPException) as daily:
        await suggest_video_intervals(
            sample.db, business_id, editor_id, asset_id, "suggest-key-1", provider=provider,
        )
    assert daily.value.detail["code"] == "cover_ai_daily_budget"
    assert provider.calls == 0
    assert await sample.db.scalar(select(func.count()).select_from(BusinessCoverAiProposal)) == 0


async def test_explicit_request_samples_frames_once_and_confirmation_owns_the_job(sample, monkeypatch):
    _prices(monkeypatch)
    business_id, editor_id, viewer_id = sample.business.id, sample.editor.id, sample.viewer.id
    original = await _video(sample, business_id, editor_id)
    asset_id = original.id
    assert original.verified_duration / original.verified_timescale == 40
    seen = {"chat": 0, "extra": "", "transaction": None}

    def factory():
        return Store()

    async def spill(_store, _business_id, _locator, dest, _size):
        seen["transaction"] = sample.db.in_transaction()
        with open(dest, "wb") as handle:
            handle.write(b"stored-video")

    async def extract(path, stamps):
        assert os.path.isfile(path)
        assert len(stamps) == 4
        extra = os.path.join(os.path.dirname(path), "0.jpg")
        with open(extra, "wb") as handle:
            handle.write(b"frame")
        seen["extra"] = extra
        return [(stamps[0], b"\xff\xd8\xff")]

    async def chat(payload, *, dispatch=None):
        seen["chat"] += 1
        assert sample.db.in_transaction() is False
        assert payload["model"] == "gpt-4o"
        if dispatch is not None:
            dispatch.mark_dispatched()
        encoded = json.dumps(payload)
        assert "data:image/jpeg;base64" in encoded
        return {
            "content": json.dumps({
                "coverAssetId": "not-a-cover",
                "jobId": "not-a-job",
                "approved": True,
                "intervals": [
                    {"startSeconds": 1, "endSeconds": 6},
                    {"startSeconds": 0, "endSeconds": 30},
                    {"startSeconds": float("nan"), "endSeconds": 2},
                    {"startSeconds": 8, "endSeconds": 12},
                    {"startSeconds": 14, "endSeconds": 16},
                    {"startSeconds": 18, "endSeconds": 19},
                ],
            }),
            "usage": None,
        }

    monkeypatch.setattr("backend.services.business_yansi.video_storage.video_store_from_env", factory)
    monkeypatch.setattr("backend.services.business_yansi.cover_video_suggestions.spill_video", spill)
    monkeypatch.setattr("backend.services.business_yansi.cover_video_suggestions.extract_frames", extract)
    monkeypatch.setattr("backend.services.business_yansi.cover_video_suggestions.post_chat", chat)
    before_jobs = await sample.db.scalar(select(func.count()).select_from(BusinessVideoCoverJob))
    view = await routes.create_cover_suggestion(
        business_id, asset_id, routes.CoverSuggestion(idempotencyKey="suggest-key-1"),
        sample.db, _claims(editor_id),
    )
    assert seen["chat"] == 1 and seen["transaction"] is False
    assert seen["extra"] and not os.path.exists(seen["extra"])
    assert view["status"] == "succeeded" and view["errorCode"] is None
    assert view["assetId"] == str(asset_id) and view["sourceCurrent"] is True
    assert view["assetRevision"] == original.revision
    assert view["intervals"] == [
        {"startSeconds": 1.0, "endSeconds": 6.0},
        {"startSeconds": 8.0, "endSeconds": 12.0},
        {"startSeconds": 14.0, "endSeconds": 16.0},
    ]
    assert "jobId" not in view and "coverAssetId" not in view
    proposal = await sample.db.get(BusinessCoverAiProposal, uuid.UUID(view["proposalId"]))
    assert {
        "assetId", "assetRevision", "contentKey", "durationTicks", "timescale", "sizeBytes",
        "modelId", "pricingVersion", "maxFrames", "maxOutputTokens",
        "inputUsdPer1k", "outputUsdPer1k", "estimatedMaxUsd",
    } <= set(proposal.request_payload)
    assert proposal.result_payload == {"intervals": view["intervals"]}
    assert "not-a-cover" not in json.dumps(proposal.result_payload)
    again = await routes.create_cover_suggestion(
        business_id, asset_id, routes.CoverSuggestion(idempotencyKey="suggest-key-1"),
        sample.db, _claims(editor_id),
    )
    assert again["proposalId"] == view["proposalId"] and seen["chat"] == 1
    polled = await routes.cover_suggestion(
        business_id, asset_id, view["proposalId"], sample.db, _claims(viewer_id),
    )
    assert polled["intervals"] == view["intervals"] and polled["sourceCurrent"] is True
    asset = await sample.db.get(library.Asset, asset_id)
    asset.verified_size_bytes = asset.verified_size_bytes + 1
    asset.revision = asset.revision + 1
    await sample.db.commit()
    with pytest.raises(HTTPException) as conflict:
        await routes.create_cover_suggestion(
            business_id, asset_id, routes.CoverSuggestion(idempotencyKey="suggest-key-1"),
            sample.db, _claims(editor_id),
        )
    assert conflict.value.detail["code"] == "cover_ai_idempotency_conflict" and seen["chat"] == 1
    stale = await routes.cover_suggestion(
        business_id, asset_id, view["proposalId"], sample.db, _claims(viewer_id),
    )
    assert stale["sourceCurrent"] is False and stale["intervals"] == []
    assert await sample.db.scalar(select(func.count()).select_from(BusinessVideoCoverJob)) == before_jobs
    first = await retarget_cover(sample.db, business_id, editor_id, asset_id, 1, 6)
    same = await retarget_cover(sample.db, business_id, editor_id, asset_id, 1, 6)
    second = await retarget_cover(sample.db, business_id, editor_id, asset_id, 8, 12)
    assert first.id == same.id and first.id != second.id
    assert first.status == "awaiting_encode" and first.strategy == "chosen_span"
    assert second.strategy == "chosen_span"
    ready = await sample.db.scalar(
        select(func.count()).select_from(BusinessVideoCoverJob).where(
            BusinessVideoCoverJob.status == "ready",
            BusinessVideoCoverJob.strategy == "chosen_span",
        )
    )
    assert ready == 0
    assert observations_enabled() is False and ranking_enabled() is False


async def test_running_proposal_stays_pending_and_failure_leaves_no_ready_cover(sample, monkeypatch):
    import asyncio
    from sqlalchemy.ext.asyncio import async_sessionmaker

    _prices(monkeypatch, daily="1.00")
    business_id, editor_id = sample.business.id, sample.editor.id
    original = await _video(sample, business_id, editor_id)
    asset_id = original.id

    class Holding(FakeIntervals):
        def __init__(self, db):
            super().__init__(db)
            self.entered = asyncio.Event()
            self.gate = asyncio.Event()

        async def complete(self, request):
            self.calls += 1
            self.in_transaction = self.db.in_transaction()
            self.entered.set()
            await self.gate.wait()
            return CoverAiResult(payload=self.payload, model=self.model or request.spec.model)

    provider = Holding(sample.db)

    async def once(session):
        return await suggest_video_intervals(
            session, business_id, editor_id, asset_id, "suggest-key-7", provider=provider,
        )

    first_task = asyncio.create_task(once(sample.db))
    await asyncio.wait_for(provider.entered.wait(), timeout=5)
    async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as other:
        second = await asyncio.wait_for(once(other), timeout=5)
    pending = present_suggestion(second, asset_id)
    assert provider.calls == 1 and provider.in_transaction is False
    assert second.status == "running"
    assert pending["status"] == "running" and pending["intervals"] == [] and pending["errorCode"] is None
    assert "jobId" not in pending
    provider.gate.set()
    first = await asyncio.wait_for(first_task, timeout=5)
    assert first.id == second.id and first.status == "succeeded" and provider.calls == 1
    assert await sample.db.scalar(select(func.count()).select_from(BusinessVideoCoverJob)) == 0

    class Broken(FakeIntervals):
        async def complete(self, request):
            self.calls += 1
            request.dispatch.mark_dispatched()
            raise RuntimeError("sk-live-secret")

    broken = Broken(sample.db)
    failed = await suggest_video_intervals(
        sample.db, business_id, editor_id, asset_id, "suggest-key-8", provider=broken,
    )
    assert failed.status == "expired" and failed.error_code == "cover_ai_provider_failed"
    assert failed.result_payload is None and "sk-live-secret" not in (failed.error_code or "")
    failed_view = present_suggestion(failed, asset_id)
    assert failed_view["intervals"] == [] and failed_view["errorCode"] == "cover_ai_provider_failed"
    replay = await suggest_video_intervals(
        sample.db, business_id, editor_id, asset_id, "suggest-key-8", provider=broken,
    )
    assert replay.id == failed.id and broken.calls == 1
    ready = await sample.db.scalar(
        select(func.count()).select_from(BusinessVideoCoverJob).where(
            BusinessVideoCoverJob.status == "ready",
            BusinessVideoCoverJob.strategy == "chosen_span",
        )
    )
    assert ready == 0 and observations_enabled() is False and ranking_enabled() is False


async def test_missing_model_fails_before_a_paid_call(sample, monkeypatch):
    _prices(monkeypatch)
    monkeypatch.delenv(VIDEO_MODEL, raising=False)
    calls = {"n": 0}

    async def boom(*_args, **_kwargs):
        calls["n"] += 1
        raise AssertionError("provider ran")

    monkeypatch.setattr("backend.services.business_yansi.cover_video_suggestions.post_chat", boom)
    business_id, editor_id = sample.business.id, sample.editor.id
    original = await _video(sample, business_id, editor_id)
    with pytest.raises(HTTPException) as missing:
        await suggest_video_intervals(sample.db, business_id, editor_id, original.id, "suggest-key-1")
    assert missing.value.detail["code"] == "cover_ai_provider_not_configured"
    assert calls["n"] == 0
    assert await sample.db.scalar(select(func.count()).select_from(BusinessCoverAiProposal)) == 0
