"""Cover AI reservations stay off the cover job and off the provider until claimed."""
import asyncio
import importlib.util
import json
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from backend.models.business_cover_ai import BusinessCoverAiProposal, BusinessCoverAiUsage
from backend.models.business_video_cover_jobs import BusinessVideoCoverJob
from backend.services.business_yansi import service as svc
from backend.services.business_yansi.cover_ai import (
    FLAG,
    MODEL_ENV,
    PRICES,
    CoverAiProviderError,
    CoverAiResult,
    enabled,
    quote_for,
    run_proposal,
)
from backend.services.business_yansi.media_observations import enabled as observations_enabled
from backend.services.business_yansi.observation_rank import ranking_enabled
from backend.tests.test_business_video_cover_policy import _steps
from backend.tests.test_business_yansi import sample, source


class FakeProvider:
    def __init__(self, db=None, payload=None, model=None, usage_usd=None, *, mark_dispatch=False):
        self.db = db
        self.payload = {"ok": True} if payload is None else payload
        self.model = model
        self.usage_usd = usage_usd
        self.mark_dispatch = mark_dispatch
        self.calls = 0
        self.in_transaction = None
        self.last_request = None

    async def complete(self, request):
        self.calls += 1
        self.last_request = request
        if self.db is not None:
            self.in_transaction = self.db.in_transaction()
        if self.mark_dispatch and getattr(request, "dispatch", None) is not None:
            request.dispatch.mark_dispatched()
        model = self.model or request.spec.model
        return CoverAiResult(payload=self.payload, model=model, usage_usd=self.usage_usd)


class HoldingProvider(FakeProvider):
    """Holds inside complete(). mark_dispatch=True simulates paid HTTP already sent."""

    def __init__(self, db, *, mark_dispatch=False):
        super().__init__(db, mark_dispatch=mark_dispatch)
        self.entered = asyncio.Event()
        self.gate = asyncio.Event()

    async def complete(self, request):
        self.calls += 1
        self.last_request = request
        self.in_transaction = self.db.in_transaction()
        if self.mark_dispatch and getattr(request, "dispatch", None) is not None:
            request.dispatch.mark_dispatched()
        self.entered.set()
        await self.gate.wait()
        model = self.model or request.spec.model
        return CoverAiResult(payload=self.payload, model=model, usage_usd=self.usage_usd)


def _prices(
    monkeypatch,
    *,
    ceiling="1.00",
    daily="10.00",
    model="gpt-4o",
    input_rate="0.01",
    output_rate="0.02",
    max_input=12000,
    max_output=400,
    version="cover-ai-prices-v1",
    image_model="gpt-image-2.5-sunburst",
    usd_per_image="0.04",
):
    from backend.services.business_yansi.cover_ai import IMAGE_MODEL_ENV

    monkeypatch.setenv(FLAG, "true")
    monkeypatch.setenv(MODEL_ENV, model)
    monkeypatch.setenv(IMAGE_MODEL_ENV, image_model)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-cover-ai-not-paid")
    monkeypatch.setenv(
        PRICES,
        json.dumps({
            "version": version,
            "models": {
                model: {
                    "inputUsdPer1k": input_rate,
                    "outputUsdPer1k": output_rate,
                    "maxInputTokens": max_input,
                    "maxOutputTokens": max_output,
                }
            },
            "imageModels": {
                image_model: {
                    "reservedMaxUsdPerImage": usd_per_image,
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


async def _run(sample, provider, *, business_id, actor_id, key="proposal-key-1", kind="video_intervals", payload=None):
    return await run_proposal(
        sample.db, business_id, actor_id, kind=kind, idempotency_key=key,
        payload={"mark": "one"} if payload is None else payload, provider=provider,
    )


def test_cover_ai_flag_defaults_off(monkeypatch):
    monkeypatch.delenv(FLAG, raising=False)
    assert enabled() is False
    assert observations_enabled() is False
    assert ranking_enabled() is False


def test_cover_ai_migration_is_additive_after_observation_usage():
    path = Path(__file__).resolve().parents[1] / "migrations" / "versions" / "add_business_cover_ai_proposals_v1.py"
    spec = importlib.util.spec_from_file_location("cover_ai_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert module.revision == "add_business_cover_ai_proposals_v1"
    assert module.down_revision == "add_observation_usage_v1"
    text = path.read_text(encoding="utf-8")
    assert "business_studio_generations" not in text
    assert "expired" in text and "uncertain" in text and "released" in text
    assert "cost_known" in text and "deadline_at" in text


async def test_disabled_flag_and_unauthorized_callers_do_not_call_the_provider(sample, monkeypatch):
    provider = FakeProvider(sample.db)
    business_id, editor_id, viewer_id, outsider_id = (
        sample.business.id, sample.editor.id, sample.viewer.id, sample.outsider.id,
    )
    with pytest.raises(HTTPException) as disabled:
        await run_proposal(
            sample.db, business_id, editor_id, kind="video_intervals", idempotency_key="proposal-key-1",
            payload={"mark": "one"}, provider=provider,
        )
    assert disabled.value.detail["code"] == "cover_ai_disabled"
    assert provider.calls == 0
    _prices(monkeypatch)
    with pytest.raises(HTTPException) as viewer:
        await _run(sample, provider, business_id=business_id, actor_id=viewer_id)
    assert viewer.value.status_code == 403
    with pytest.raises(HTTPException) as outsider:
        await _run(sample, provider, business_id=business_id, actor_id=outsider_id)
    assert outsider.value.status_code == 403
    missing = await sample.db.scalar(select(func.count()).select_from(BusinessCoverAiProposal))
    assert provider.calls == 0 and missing == 0


async def test_budget_gates_reject_before_a_provider_call(sample, monkeypatch):
    provider = FakeProvider(sample.db)
    business_id, editor_id = sample.business.id, sample.editor.id
    monkeypatch.setenv(FLAG, "true")
    monkeypatch.setenv(MODEL_ENV, "gpt-4o")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-cover-ai-not-paid")
    with pytest.raises(HTTPException) as missing_price:
        await _run(sample, provider, business_id=business_id, actor_id=editor_id)
    assert missing_price.value.detail["code"] == "cover_ai_pricing_not_configured"
    _prices(monkeypatch, input_rate="1.00", output_rate="1.00", ceiling="0.01", daily="10.00")
    with pytest.raises(HTTPException) as ceiling:
        await _run(sample, provider, business_id=business_id, actor_id=editor_id)
    assert ceiling.value.detail["code"] == "cover_ai_request_ceiling"
    _prices(monkeypatch, input_rate="0.01", output_rate="0.02", ceiling="1.00", daily="0.001")
    with pytest.raises(HTTPException) as daily:
        await _run(sample, provider, business_id=business_id, actor_id=editor_id)
    assert daily.value.detail["code"] == "cover_ai_daily_budget"
    assert provider.calls == 0
    assert await sample.db.scalar(select(func.count()).select_from(BusinessCoverAiProposal)) == 0


async def test_one_reservation_survives_retry_conflict_and_failure(sample, monkeypatch):
    # Vision ~0.0164 + flat image 0.04 must fit; a third vision reservation must not.
    _prices(monkeypatch, ceiling="1.00", daily="0.06", usd_per_image="0.04")
    provider = FakeProvider(sample.db)
    editor_id = sample.editor.id
    business_id = sample.business.id
    before_jobs = await sample.db.scalar(select(func.count()).select_from(BusinessVideoCoverJob))
    first = await _run(sample, provider, business_id=business_id, actor_id=editor_id)
    first_id = first.id
    assert first.status == "succeeded" and first.result_payload == {"ok": True}
    assert first.kind == "video_intervals" and provider.calls == 1 and provider.in_transaction is False
    assert first.cost_known is False and Decimal(str(first.cost_usd)) == 0
    assert Decimal(str(first.reserved_cost_usd)) == quote_for("video_intervals").estimated_max_usd
    again = await _run(sample, provider, business_id=business_id, actor_id=editor_id)
    assert again.id == first_id and provider.calls == 1
    with pytest.raises(HTTPException) as conflict:
        await _run(sample, provider, business_id=business_id, actor_id=editor_id, payload={"mark": "other"})
    assert conflict.value.detail["code"] == "cover_ai_idempotency_conflict"
    assert provider.calls == 1
    image = await _run(sample, provider, business_id=business_id, actor_id=editor_id, key="proposal-key-2", kind="image_cover")
    assert image.id != first_id and image.kind == "image_cover" and provider.calls == 2
    with pytest.raises(HTTPException) as daily:
        await _run(sample, provider, business_id=business_id, actor_id=editor_id, key="proposal-key-3")
    assert daily.value.detail["code"] == "cover_ai_daily_budget" and provider.calls == 2
    broken = FakeProvider(sample.db, mark_dispatch=True)
    _prices(monkeypatch, ceiling="1.00", daily="10.00")

    async def explode(request):
        broken.calls += 1
        request.dispatch.mark_dispatched()
        raise RuntimeError("sk-live-secret")

    broken.complete = explode
    failed = await _run(sample, broken, business_id=business_id, actor_id=editor_id, key="proposal-key-4")
    assert failed.status == "expired" and failed.error_code == "cover_ai_provider_failed"
    assert failed.result_payload is None and "sk-live-secret" not in (failed.error_code or "")
    assert broken.calls == 1
    failed_id = failed.id
    replay = await _run(sample, broken, business_id=business_id, actor_id=editor_id, key="proposal-key-4")
    assert replay.id == failed_id and broken.calls == 1
    usage = await sample.db.get(BusinessCoverAiUsage, failed_id)
    assert usage.outcome == "uncertain" and usage.business_id == business_id
    assert await sample.db.scalar(select(func.count()).select_from(BusinessVideoCoverJob)) == before_jobs
    assert observations_enabled() is False and ranking_enabled() is False


async def test_provider_code_is_stored_and_a_second_click_does_not_call_again(sample, monkeypatch):
    _prices(monkeypatch)
    provider = FakeProvider(sample.db)

    async def reject(_request):
        provider.calls += 1
        raise CoverAiProviderError("cover_ai_provider_rejected")

    provider.complete = reject
    business_id, editor_id = sample.business.id, sample.editor.id
    failed = await _run(sample, provider, business_id=business_id, actor_id=editor_id, key="proposal-key-9")
    assert failed.status == "failed" and failed.error_code == "cover_ai_provider_rejected"
    usage = await sample.db.get(BusinessCoverAiUsage, failed.id)
    assert usage.outcome == "failed"
    await _run(sample, provider, business_id=business_id, actor_id=editor_id, key="proposal-key-9")
    assert provider.calls == 1


async def test_overlapping_same_key_calls_the_provider_once(sample, monkeypatch):
    _prices(monkeypatch, daily="10.00")
    provider = HoldingProvider(sample.db)
    editor_id = sample.editor.id
    business_id = sample.business.id

    async def once(session):
        return await run_proposal(
            session, business_id, editor_id, kind="video_intervals", idempotency_key="proposal-key-7",
            payload={"mark": "one"}, provider=provider,
        )

    first_task = asyncio.create_task(once(sample.db))
    await asyncio.wait_for(provider.entered.wait(), timeout=5)
    async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as other:
        second = await asyncio.wait_for(once(other), timeout=5)
    provider.gate.set()
    first = await asyncio.wait_for(first_task, timeout=5)
    assert provider.calls == 1 and provider.in_transaction is False
    assert first.id == second.id
    assert second.status == "running"
    assert first.status == "succeeded"


async def test_draft_save_does_not_run_a_cover_proposal(sample, monkeypatch):
    _prices(monkeypatch)

    async def explode(*_args, **_kwargs):
        raise AssertionError("cover ai ran")

    monkeypatch.setattr("backend.services.business_yansi.cover_ai.run_proposal", explode)
    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Taslak", "Atolye", _steps(knowledge),
    )
    assert draft.status == "draft"
    assert await sample.db.scalar(select(func.count()).select_from(BusinessCoverAiProposal)) == 0
