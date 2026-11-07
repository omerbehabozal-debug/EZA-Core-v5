"""Three Phase 2B Step 2 MEDIUM fixes: lease, model cost, asset revision."""
import asyncio
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import async_sessionmaker

from backend.models.business_cover_ai import BusinessCoverAiProposal, BusinessCoverAiUsage
from backend.models.business_video_cover_jobs import BusinessVideoCoverJob
from backend.services.business_yansi import brand_asset_library as library
from backend.services.business_yansi.cover_ai import (
    FLAG,
    MODEL_ENV,
    CoverAiResult,
    _spent,
    quote_for,
    reconcile_proposal,
    run_proposal,
)
from backend.services.business_yansi.cover_jobs import retarget_cover
from backend.services.business_yansi.cover_video_suggestions import (
    present_suggestion,
    read_cover_suggestion,
    source_matches,
    suggest_video_intervals,
)
from backend.services.business_yansi.video_storage import MemoryVideoStore as Store
from backend.tests.test_business_cover_ai_proposals import FakeProvider, HoldingProvider, _prices
from backend.tests.test_business_video_storage import Upload, VideoQuotaRedis, _mp4
from backend.tests.test_business_yansi import sample


@pytest.fixture(autouse=True)
def _budget_and_probe(monkeypatch):
    quota = VideoQuotaRedis()

    async def client():
        return quota

    monkeypatch.setattr("backend.services.business_yansi.video_ingest._redis", client)

    async def accept(_path: str) -> None:
        return None

    monkeypatch.setattr("backend.services.business_yansi.video_mp4.probe_file", accept)


async def _video(sample, business_id, editor_id, seconds=40):
    from backend.services.business_yansi.video_ingest import ingest_upload

    return await ingest_upload(
        sample.db, business_id, editor_id, store=Store(), upload=Upload(_mp4(seconds=seconds)),
        title="Orijinal film", caption="", purpose="step", public_allowed=True, prepare_cover=False,
    )


# --- FIX 1: cancellation / lease -------------------------------------------------


async def test_cancel_before_provider_releases_the_reservation(sample, monkeypatch):
    _prices(monkeypatch)
    business_id, editor_id = sample.business.id, sample.editor.id
    calls = {"n": 0}

    class Never(FakeProvider):
        async def complete(self, request):
            calls["n"] += 1
            raise AssertionError("provider must not run")

    provider = Never(sample.db)
    real_create = asyncio.create_task

    def boom(_coro):
        raise asyncio.CancelledError()

    monkeypatch.setattr("backend.services.business_yansi.cover_ai.asyncio.create_task", boom)
    try:
        with pytest.raises(asyncio.CancelledError):
            await run_proposal(
                sample.db, business_id, editor_id, kind="video_intervals",
                idempotency_key="lease-key-pre", payload={"mark": "one"}, provider=provider,
            )
    finally:
        monkeypatch.setattr("backend.services.business_yansi.cover_ai.asyncio.create_task", real_create)
    assert calls["n"] == 0
    row = await sample.db.scalar(
        select(BusinessCoverAiProposal).where(BusinessCoverAiProposal.idempotency_key == "lease-key-pre")
    )
    assert row is not None
    await sample.db.refresh(row)
    usage = await sample.db.get(BusinessCoverAiUsage, row.id)
    assert row.status == "failed" and row.error_code == "cover_ai_cancelled"
    assert usage.outcome == "released"
    assert await _spent(sample.db, business_id, row.quota_day) == 0


async def test_cancel_after_provider_start_marks_uncertain(sample, monkeypatch):
    _prices(monkeypatch)
    business_id, editor_id = sample.business.id, sample.editor.id
    # Paid HTTP may have left the process; mark_dispatch simulates that boundary.
    provider = HoldingProvider(sample.db, mark_dispatch=True)

    async def once():
        return await run_proposal(
            sample.db, business_id, editor_id, kind="video_intervals",
            idempotency_key="lease-key-post", payload={"mark": "one"}, provider=provider,
        )

    task = asyncio.create_task(once())
    await asyncio.wait_for(provider.entered.wait(), timeout=5)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    row = await sample.db.scalar(
        select(BusinessCoverAiProposal).where(BusinessCoverAiProposal.idempotency_key == "lease-key-post")
    )
    usage = await sample.db.get(BusinessCoverAiUsage, row.id)
    assert row.status == "expired" and row.error_code == "cover_ai_provider_uncertain"
    assert usage.outcome == "uncertain"
    assert provider.calls == 1
    replay = await run_proposal(
        sample.db, business_id, editor_id, kind="video_intervals",
        idempotency_key="lease-key-post", payload={"mark": "one"}, provider=provider,
    )
    assert replay.id == row.id and provider.calls == 1


async def test_provider_timeout_expires_without_a_second_call(sample, monkeypatch):
    _prices(monkeypatch)
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_AI_LEASE_SECONDS", "6")
    business_id, editor_id = sample.business.id, sample.editor.id

    class Slow(FakeProvider):
        async def complete(self, request):
            self.calls += 1
            request.dispatch.mark_dispatched()
            await asyncio.sleep(30)
            return CoverAiResult(payload=self.payload, model=request.spec.model)

    provider = Slow(sample.db)
    row = await run_proposal(
        sample.db, business_id, editor_id, kind="video_intervals",
        idempotency_key="lease-key-timeout", payload={"mark": "one"}, provider=provider,
    )
    assert row.status == "expired" and row.error_code == "cover_ai_provider_timeout"
    usage = await sample.db.get(BusinessCoverAiUsage, row.id)
    assert usage.outcome == "uncertain" and provider.calls == 1
    again = await run_proposal(
        sample.db, business_id, editor_id, kind="video_intervals",
        idempotency_key="lease-key-timeout", payload={"mark": "one"}, provider=provider,
    )
    assert again.id == row.id and provider.calls == 1


async def test_expired_lease_reconciles_on_read_and_keeps_uncertain_budget(sample, monkeypatch):
    _prices(monkeypatch, daily="10.00")
    business_id, editor_id = sample.business.id, sample.editor.id
    provider = FakeProvider(sample.db)
    first = await run_proposal(
        sample.db, business_id, editor_id, kind="video_intervals",
        idempotency_key="lease-key-ok", payload={"mark": "one"}, provider=provider,
    )
    reserved = Decimal(str(first.reserved_cost_usd))
    holding = HoldingProvider(sample.db)
    task = asyncio.create_task(run_proposal(
        sample.db, business_id, editor_id, kind="video_intervals",
        idempotency_key="lease-key-abandon", payload={"mark": "two"}, provider=holding,
    ))
    await asyncio.wait_for(holding.entered.wait(), timeout=5)
    running = await sample.db.scalar(
        select(BusinessCoverAiProposal).where(BusinessCoverAiProposal.idempotency_key == "lease-key-abandon")
    )
    running_id = running.id
    await sample.db.execute(
        update(BusinessCoverAiProposal)
        .where(BusinessCoverAiProposal.id == running_id)
        .values(deadline_at=datetime.now(timezone.utc) - timedelta(seconds=1))
    )
    await sample.db.commit()
    async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as other:
        row = await other.get(BusinessCoverAiProposal, running_id)
        closed = await reconcile_proposal(other, row)
    assert closed.status == "expired" and closed.error_code == "cover_ai_lease_expired"
    usage = await sample.db.get(BusinessCoverAiUsage, running_id)
    assert usage.outcome == "uncertain"
    holding.gate.set()
    finished = await asyncio.wait_for(task, timeout=5)
    # First task settle is a no-op once expired; status stays expired.
    assert finished.status == "expired"
    assert holding.calls == 1
    spent = await _spent(sample.db, business_id, closed.quota_day)
    assert spent >= reserved + reserved  # first success + uncertain abandon
    again = await run_proposal(
        sample.db, business_id, editor_id, kind="video_intervals",
        idempotency_key="lease-key-abandon", payload={"mark": "two"}, provider=holding,
    )
    assert again.id == running_id and holding.calls == 1
    assert Decimal(str(first.reserved_cost_usd)) == reserved


# --- FIX 2: model-specific max cost ----------------------------------------------


async def test_model_and_credential_gates_fail_closed(sample, monkeypatch):
    provider = FakeProvider(sample.db)
    business_id, editor_id = sample.business.id, sample.editor.id
    monkeypatch.setenv(FLAG, "true")
    monkeypatch.delenv(MODEL_ENV, raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    with pytest.raises(HTTPException) as missing_model:
        await run_proposal(
            sample.db, business_id, editor_id, kind="video_intervals",
            idempotency_key="cost-key-1", payload={"mark": "one"}, provider=provider,
        )
    assert missing_model.value.detail["code"] == "cover_ai_provider_not_configured"
    monkeypatch.setenv(MODEL_ENV, "gpt-4o")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setattr("backend.services.business_yansi.cover_ai.credentials_ready", lambda: False)
    with pytest.raises(HTTPException) as missing_creds:
        await run_proposal(
            sample.db, business_id, editor_id, kind="video_intervals",
            idempotency_key="cost-key-1", payload={"mark": "one"}, provider=provider,
        )
    assert missing_creds.value.detail["code"] == "cover_ai_credentials_missing"
    monkeypatch.setattr("backend.services.business_yansi.cover_ai.credentials_ready", lambda: True)
    # Price entry alone is insufficient when image-token accounting is unverified.
    monkeypatch.setenv(
        "BILIGN_BUSINESS_COVER_AI_PRICES_JSON",
        json.dumps({"version": "cover-ai-prices-v1", "models": {"gpt-4-turbo": {
            "inputUsdPer1k": "0.01", "outputUsdPer1k": "0.02", "maxInputTokens": 12000, "maxOutputTokens": 400,
        }}}),
    )
    monkeypatch.setenv(MODEL_ENV, "gpt-4-turbo")
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_AI_REQUEST_USD", "1.00")
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_AI_DAILY_USD", "10.00")
    with pytest.raises(HTTPException) as unsupported:
        await run_proposal(
            sample.db, business_id, editor_id, kind="video_intervals",
            idempotency_key="cost-key-1", payload={"mark": "one"}, provider=provider,
        )
    assert unsupported.value.detail["code"] == "cover_ai_model_unsupported"
    monkeypatch.setenv(MODEL_ENV, "gpt-4o")
    monkeypatch.setenv(
        "BILIGN_BUSINESS_COVER_AI_PRICES_JSON",
        json.dumps({"version": "cover-ai-prices-v1", "models": {"gpt-4o": {"inputUsdPer1k": "0.01"}}}),
    )
    with pytest.raises(HTTPException) as missing_model_price:
        await run_proposal(
            sample.db, business_id, editor_id, kind="video_intervals",
            idempotency_key="cost-key-1", payload={"mark": "one"}, provider=provider,
        )
    assert missing_model_price.value.detail["code"] == "cover_ai_model_pricing_missing"
    assert provider.calls == 0
    assert await sample.db.scalar(select(func.count()).select_from(BusinessCoverAiProposal)) == 0


async def test_reserves_upper_bound_and_keeps_actual_usage_separate(sample, monkeypatch):
    _prices(monkeypatch, input_rate="0.01", output_rate="0.02", ceiling="1.00", daily="10.00")
    quote = quote_for("video_intervals")
    assert quote.max_frames == 4 and quote.max_output_tokens == 400
    provider = FakeProvider(sample.db, usage_usd=Decimal("0.00100000"))
    business_id, editor_id = sample.business.id, sample.editor.id
    row = await run_proposal(
        sample.db, business_id, editor_id, kind="video_intervals",
        idempotency_key="cost-key-ok", payload={"mark": "one"}, provider=provider,
    )
    assert Decimal(str(row.reserved_cost_usd)) == quote.estimated_max_usd
    assert row.cost_known is True and Decimal(str(row.cost_usd)) == Decimal("0.00100000")
    assert Decimal(str(row.cost_usd)) < Decimal(str(row.reserved_cost_usd))
    usage = await sample.db.get(BusinessCoverAiUsage, row.id)
    assert usage.outcome == "succeeded" and Decimal(str(usage.cost_usd)) == quote.estimated_max_usd
    unknown = FakeProvider(sample.db, usage_usd=None)
    blank = await run_proposal(
        sample.db, business_id, editor_id, kind="video_intervals",
        idempotency_key="cost-key-unknown", payload={"mark": "two"}, provider=unknown,
    )
    assert blank.cost_known is False and Decimal(str(blank.cost_usd)) == 0
    assert Decimal(str(blank.reserved_cost_usd)) == quote.estimated_max_usd


# --- FIX 3: revision binding -----------------------------------------------------


async def test_archived_or_changed_asset_hides_selectable_intervals(sample, monkeypatch):
    _prices(monkeypatch)
    business_id, editor_id, viewer_id = sample.business.id, sample.editor.id, sample.viewer.id
    original = await _video(sample, business_id, editor_id)
    asset_id = original.id
    provider = FakeProvider(
        sample.db,
        payload={"intervals": [{"startSeconds": 1, "endSeconds": 6}]},
    )
    row = await suggest_video_intervals(
        sample.db, business_id, editor_id, asset_id, "rev-key-1", provider=provider,
    )
    assert row.status == "succeeded"
    assert source_matches(row, await sample.db.get(library.Asset, asset_id))
    view = present_suggestion(row, asset_id, source_current=True)
    assert view["intervals"] == [{"startSeconds": 1.0, "endSeconds": 6.0}]
    assert view["assetRevision"] == original.revision

    asset = await sample.db.get(library.Asset, asset_id)
    asset.revision = asset.revision + 1
    await sample.db.commit()
    stale = await read_cover_suggestion(sample.db, business_id, viewer_id, asset_id, row.id)
    assert stale["sourceCurrent"] is False and stale["intervals"] == []

    asset = await sample.db.get(library.Asset, asset_id)
    asset.revision = original.revision
    asset.status = "archived"
    await sample.db.commit()
    archived = await read_cover_suggestion(sample.db, business_id, viewer_id, asset_id, row.id)
    assert archived["sourceCurrent"] is False and archived["intervals"] == []

    with pytest.raises(HTTPException) as blocked:
        await suggest_video_intervals(
            sample.db, business_id, editor_id, asset_id, "rev-key-2", provider=provider,
        )
    assert blocked.value.detail["code"] == "archived_asset"
    assert provider.calls == 1


async def test_replaced_content_conflicts_and_manual_confirm_stays_secure(sample, monkeypatch):
    _prices(monkeypatch)
    business_id, editor_id = sample.business.id, sample.editor.id
    original = await _video(sample, business_id, editor_id)
    asset_id = original.id
    provider = FakeProvider(
        sample.db,
        payload={"intervals": [{"startSeconds": 1, "endSeconds": 6}]},
    )
    first = await suggest_video_intervals(
        sample.db, business_id, editor_id, asset_id, "rev-key-same", provider=provider,
    )
    first_id, first_status = first.id, first.status
    assert first_status == "succeeded" and provider.calls == 1
    again = await suggest_video_intervals(
        sample.db, business_id, editor_id, asset_id, "rev-key-same", provider=provider,
    )
    assert again.id == first_id and provider.calls == 1
    asset = await sample.db.get(library.Asset, asset_id)
    asset.verified_size_bytes = int(asset.verified_size_bytes) + 1
    asset.revision = int(asset.revision) + 1
    await sample.db.commit()
    with pytest.raises(HTTPException) as conflict:
        await suggest_video_intervals(
            sample.db, business_id, editor_id, asset_id, "rev-key-same", provider=provider,
        )
    assert conflict.value.detail["code"] == "cover_ai_idempotency_conflict"
    assert provider.calls == 1
    fresh = await suggest_video_intervals(
        sample.db, business_id, editor_id, asset_id, "rev-key-new", provider=provider,
    )
    fresh_id = fresh.id
    assert fresh_id != first_id and provider.calls == 2
    job = await retarget_cover(sample.db, business_id, editor_id, asset_id, 1, 6)
    assert job.strategy == "chosen_span"
    ready = await sample.db.scalar(
        select(func.count()).select_from(BusinessVideoCoverJob).where(
            BusinessVideoCoverJob.status == "ready",
            BusinessVideoCoverJob.strategy == "chosen_span",
        )
    )
    assert ready == 0
