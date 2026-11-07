"""Phase 2B Step 2 final corrections: orphan reserve, immutable spec, dispatch gate."""
import asyncio
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import async_sessionmaker

from backend.models.business_cover_ai import BusinessCoverAiProposal, BusinessCoverAiUsage
from backend.services.business_yansi.cover_ai import (
    FLAG,
    MODEL_ENV,
    CoverAiResult,
    _spent,
    build_execution_spec,
    quote_for,
    reconcile_proposal,
    run_proposal,
    verified_image_tokens,
)
from backend.tests.test_business_cover_ai_proposals import FakeProvider, HoldingProvider, _prices
from backend.tests.test_business_yansi import sample


# --- FIX A: reservation / cancel / reconcile ------------------------------------


async def test_cancel_immediately_after_reservation_releases_with_deadline(sample, monkeypatch):
    _prices(monkeypatch)
    business_id, editor_id = sample.business.id, sample.editor.id
    calls = {"n": 0}
    captured = {}

    async def boom_reload(db, proposal_id):
        row = await db.get(BusinessCoverAiProposal, proposal_id)
        captured["deadline"] = row.deadline_at
        captured["status"] = row.status
        raise asyncio.CancelledError()

    monkeypatch.setattr("backend.services.business_yansi.cover_ai._reload", boom_reload)

    class Never(FakeProvider):
        async def complete(self, request):
            calls["n"] += 1
            raise AssertionError("provider must not run")

    with pytest.raises(asyncio.CancelledError):
        await run_proposal(
            sample.db, business_id, editor_id, kind="video_intervals",
            idempotency_key="fix-a-after-reserve", payload={"mark": "one"}, provider=Never(sample.db),
        )
    assert calls["n"] == 0
    assert captured["status"] == "reserved"
    assert captured["deadline"] is not None
    row = await sample.db.scalar(
        select(BusinessCoverAiProposal).where(BusinessCoverAiProposal.idempotency_key == "fix-a-after-reserve")
    )
    usage = await sample.db.get(BusinessCoverAiUsage, row.id)
    assert row.status == "failed" and row.error_code == "cover_ai_cancelled"
    assert row.deadline_at is None
    assert usage.outcome == "released"
    assert await _spent(sample.db, business_id, row.quota_day) == 0


async def test_cancel_during_first_reload_releases(sample, monkeypatch):
    _prices(monkeypatch)
    business_id, editor_id = sample.business.id, sample.editor.id
    real_reload = None
    import backend.services.business_yansi.cover_ai as cover_ai

    real_reload = cover_ai._reload
    hits = {"n": 0}

    async def flaky(db, proposal_id):
        hits["n"] += 1
        if hits["n"] == 1:
            raise asyncio.CancelledError()
        return await real_reload(db, proposal_id)

    monkeypatch.setattr(cover_ai, "_reload", flaky)
    with pytest.raises(asyncio.CancelledError):
        await run_proposal(
            sample.db, business_id, editor_id, kind="video_intervals",
            idempotency_key="fix-a-reload", payload={"mark": "one"}, provider=FakeProvider(sample.db),
        )
    row = await sample.db.scalar(
        select(BusinessCoverAiProposal).where(BusinessCoverAiProposal.idempotency_key == "fix-a-reload")
    )
    usage = await sample.db.get(BusinessCoverAiUsage, row.id)
    assert row.status == "failed" and usage.outcome == "released"


async def test_cancel_during_frame_extraction_releases_without_dispatch(sample, monkeypatch):
    _prices(monkeypatch)
    business_id, editor_id = sample.business.id, sample.editor.id
    entered = asyncio.Event()

    class FramesOnly(FakeProvider):
        async def complete(self, request):
            self.calls += 1
            entered.set()
            await asyncio.sleep(30)
            return CoverAiResult(payload=self.payload, model=request.spec.model)

    provider = FramesOnly(sample.db)
    task = asyncio.create_task(run_proposal(
        sample.db, business_id, editor_id, kind="video_intervals",
        idempotency_key="fix-a-frames", payload={"mark": "one"}, provider=provider,
    ))
    await asyncio.wait_for(entered.wait(), timeout=5)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    row = await sample.db.scalar(
        select(BusinessCoverAiProposal).where(BusinessCoverAiProposal.idempotency_key == "fix-a-frames")
    )
    usage = await sample.db.get(BusinessCoverAiUsage, row.id)
    assert row.status == "failed" and row.error_code == "cover_ai_cancelled"
    assert usage.outcome == "released"
    assert await _spent(sample.db, business_id, row.quota_day) == 0


async def test_cancel_immediately_before_paid_dispatch_releases(sample, monkeypatch):
    _prices(monkeypatch)
    business_id, editor_id = sample.business.id, sample.editor.id
    entered = asyncio.Event()

    class PreDispatch(FakeProvider):
        async def complete(self, request):
            self.calls += 1
            entered.set()
            # Still before mark_dispatched — local work only.
            await asyncio.Event().wait()
            request.dispatch.mark_dispatched()
            return CoverAiResult(payload=self.payload, model=request.spec.model)

    provider = PreDispatch(sample.db)
    task = asyncio.create_task(run_proposal(
        sample.db, business_id, editor_id, kind="video_intervals",
        idempotency_key="fix-a-pre-http", payload={"mark": "one"}, provider=provider,
    ))
    await asyncio.wait_for(entered.wait(), timeout=5)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    row = await sample.db.scalar(
        select(BusinessCoverAiProposal).where(BusinessCoverAiProposal.idempotency_key == "fix-a-pre-http")
    )
    usage = await sample.db.get(BusinessCoverAiUsage, row.id)
    assert usage.outcome == "released" and row.status == "failed"


async def test_cancel_after_dispatch_is_uncertain_and_not_retried(sample, monkeypatch):
    _prices(monkeypatch)
    business_id, editor_id = sample.business.id, sample.editor.id
    provider = HoldingProvider(sample.db, mark_dispatch=True)
    task = asyncio.create_task(run_proposal(
        sample.db, business_id, editor_id, kind="video_intervals",
        idempotency_key="fix-a-post-http", payload={"mark": "one"}, provider=provider,
    ))
    await asyncio.wait_for(provider.entered.wait(), timeout=5)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    row = await sample.db.scalar(
        select(BusinessCoverAiProposal).where(BusinessCoverAiProposal.idempotency_key == "fix-a-post-http")
    )
    usage = await sample.db.get(BusinessCoverAiUsage, row.id)
    assert row.status == "expired" and usage.outcome == "uncertain"
    spent = await _spent(sample.db, business_id, row.quota_day)
    assert spent == Decimal(str(row.reserved_cost_usd))
    again = await run_proposal(
        sample.db, business_id, editor_id, kind="video_intervals",
        idempotency_key="fix-a-post-http", payload={"mark": "one"}, provider=provider,
    )
    assert again.id == row.id and provider.calls == 1


async def test_expired_reserved_proposal_reconciles_to_released(sample, monkeypatch):
    _prices(monkeypatch)
    business_id, editor_id = sample.business.id, sample.editor.id
    provider = FakeProvider(sample.db)
    # Force cancel path mid-reserve lifecycle by creating reserved row with past deadline.
    first = await run_proposal(
        sample.db, business_id, editor_id, kind="video_intervals",
        idempotency_key="fix-a-seed", payload={"mark": "seed"}, provider=provider,
    )
    reserved_cost = Decimal(str(first.reserved_cost_usd))
    # Insert a reserved orphan with expired deadline (simulates abandoned post-reserve).
    from backend.models.business_cover_ai import BusinessCoverAiProposal as Proposal
    from backend.models.business_cover_ai import BusinessCoverAiUsage as Usage
    from datetime import date

    orphan = Proposal(
        business_id=business_id,
        actor_id=editor_id,
        idempotency_key="fix-a-orphan-reserved",
        request_hash="a" * 64,
        kind="video_intervals",
        status="reserved",
        request_payload={"mark": "orphan"},
        provider_model="gpt-4o",
        reserved_cost_usd=reserved_cost,
        cost_usd=0,
        cost_known=False,
        cost_limit_usd=Decimal("1.00"),
        quota_day=date.today(),
        attempts=0,
        max_attempts=1,
        deadline_at=datetime.now(timezone.utc) - timedelta(seconds=1),
    )
    sample.db.add(orphan)
    await sample.db.flush()
    sample.db.add(Usage(
        proposal_id=orphan.id, business_id=business_id, quota_day=orphan.quota_day,
        cost_usd=reserved_cost, outcome="reserved",
    ))
    await sample.db.commit()
    orphan_id = orphan.id
    closed = await reconcile_proposal(sample.db, await sample.db.get(Proposal, orphan_id))
    assert closed.status == "failed" and closed.error_code == "cover_ai_lease_expired"
    usage = await sample.db.get(Usage, orphan_id)
    assert usage.outcome == "released"
    assert await _spent(sample.db, business_id, closed.quota_day) == reserved_cost  # only first success


async def test_reconcile_completion_race_keeps_terminal_state(sample, monkeypatch):
    _prices(monkeypatch)
    business_id, editor_id = sample.business.id, sample.editor.id
    provider = HoldingProvider(sample.db, mark_dispatch=True)
    task = asyncio.create_task(run_proposal(
        sample.db, business_id, editor_id, kind="video_intervals",
        idempotency_key="fix-a-race", payload={"mark": "one"}, provider=provider,
    ))
    await asyncio.wait_for(provider.entered.wait(), timeout=5)
    running = await sample.db.scalar(
        select(BusinessCoverAiProposal).where(BusinessCoverAiProposal.idempotency_key == "fix-a-race")
    )
    running_id = running.id
    await sample.db.execute(
        update(BusinessCoverAiProposal)
        .where(BusinessCoverAiProposal.id == running_id)
        .values(deadline_at=datetime.now(timezone.utc) - timedelta(seconds=1))
    )
    await sample.db.commit()
    async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as other:
        closed = await reconcile_proposal(other, await other.get(BusinessCoverAiProposal, running_id))
    assert closed.status == "expired"
    provider.gate.set()
    finished = await asyncio.wait_for(task, timeout=5)
    assert finished.status == "expired"
    usage = await sample.db.get(BusinessCoverAiUsage, running_id)
    assert usage.outcome == "uncertain"


async def test_duplicate_request_after_cancellation_does_not_recharge(sample, monkeypatch):
    _prices(monkeypatch)
    business_id, editor_id = sample.business.id, sample.editor.id
    provider = HoldingProvider(sample.db, mark_dispatch=True)
    task = asyncio.create_task(run_proposal(
        sample.db, business_id, editor_id, kind="video_intervals",
        idempotency_key="fix-a-dup", payload={"mark": "one"}, provider=provider,
    ))
    await asyncio.wait_for(provider.entered.wait(), timeout=5)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    spent_before = await _spent(
        sample.db, business_id,
        (await sample.db.scalar(
            select(BusinessCoverAiProposal).where(BusinessCoverAiProposal.idempotency_key == "fix-a-dup")
        )).quota_day,
    )
    again = await run_proposal(
        sample.db, business_id, editor_id, kind="video_intervals",
        idempotency_key="fix-a-dup", payload={"mark": "one"}, provider=provider,
    )
    assert again.status == "expired" and provider.calls == 1
    spent_after = await _spent(sample.db, business_id, again.quota_day)
    assert spent_after == spent_before


# --- FIX B: immutable execution spec --------------------------------------------


def test_gpt4o_mini_image_tokens_are_not_underestimated():
    assert verified_image_tokens("gpt-4o", "low") == 85
    assert verified_image_tokens("gpt-4o-mini", "low") == 2833
    # The old 85-token-per-frame assumption under-reserves mini by ~110× per image.
    assert 4 * 85 < 4 * 2833


async def test_unsupported_model_with_price_entry_rejects_before_reserve(sample, monkeypatch):
    provider = FakeProvider(sample.db)
    monkeypatch.setenv(FLAG, "true")
    monkeypatch.setenv(MODEL_ENV, "gpt-4-turbo")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setenv(
        "BILIGN_BUSINESS_COVER_AI_PRICES_JSON",
        json.dumps({
            "version": "cover-ai-prices-v1",
            "models": {
                "gpt-4-turbo": {
                    "inputUsdPer1k": "0.01",
                    "outputUsdPer1k": "0.02",
                    "maxInputTokens": 12000,
                    "maxOutputTokens": 400,
                }
            },
        }),
    )
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_AI_REQUEST_USD", "1.00")
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_AI_DAILY_USD", "10.00")
    with pytest.raises(HTTPException) as rejected:
        await run_proposal(
            sample.db, sample.business.id, sample.editor.id, kind="video_intervals",
            idempotency_key="fix-b-unsupported", payload={"mark": "one"}, provider=provider,
        )
    assert rejected.value.detail["code"] == "cover_ai_model_unsupported"
    assert provider.calls == 0


async def test_model_env_changed_after_reservation_keeps_bound_model(sample, monkeypatch):
    _prices(monkeypatch, model="gpt-4o")
    business_id, editor_id = sample.business.id, sample.editor.id
    seen = {}

    class Capture(FakeProvider):
        async def complete(self, request):
            self.calls += 1
            seen["model"] = request.spec.model
            monkeypatch.setenv(MODEL_ENV, "gpt-4o-mini")
            return CoverAiResult(payload=self.payload, model=request.spec.model)

    provider = Capture(sample.db)
    row = await run_proposal(
        sample.db, business_id, editor_id, kind="video_intervals",
        idempotency_key="fix-b-bound", payload={"mark": "one"}, provider=provider,
    )
    assert row.status == "succeeded" and seen["model"] == "gpt-4o"
    assert row.provider_model == "gpt-4o"
    assert row.request_payload["modelId"] == "gpt-4o"


async def test_input_allowance_below_calculated_rejects(sample, monkeypatch):
    provider = FakeProvider(sample.db)
    # gpt-4o-mini needs 500 + 4*2833 = 11832 input tokens.
    _prices(monkeypatch, model="gpt-4o-mini", max_input=1000, ceiling="10.00", daily="10.00")
    with pytest.raises(HTTPException) as rejected:
        await run_proposal(
            sample.db, sample.business.id, sample.editor.id, kind="video_intervals",
            idempotency_key="fix-b-input", payload={"mark": "one"}, provider=provider,
        )
    assert rejected.value.detail["code"] == "cover_ai_input_allowance"
    assert provider.calls == 0


async def test_output_allowance_and_missing_pricing_version_fail_closed(sample, monkeypatch):
    provider = FakeProvider(sample.db)
    monkeypatch.setenv(FLAG, "true")
    monkeypatch.setenv(MODEL_ENV, "gpt-4o")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setenv(
        "BILIGN_BUSINESS_COVER_AI_PRICES_JSON",
        json.dumps({
            "models": {
                "gpt-4o": {
                    "inputUsdPer1k": "0.01",
                    "outputUsdPer1k": "0.02",
                    "maxInputTokens": 12000,
                    "maxOutputTokens": 400,
                }
            },
        }),
    )
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_AI_REQUEST_USD", "1.00")
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_AI_DAILY_USD", "10.00")
    with pytest.raises(HTTPException) as missing_version:
        await run_proposal(
            sample.db, sample.business.id, sample.editor.id, kind="video_intervals",
            idempotency_key="fix-b-version", payload={"mark": "one"}, provider=provider,
        )
    assert missing_version.value.detail["code"] == "cover_ai_pricing_not_configured"
    _prices(monkeypatch, max_output=50)
    spec = build_execution_spec("video_intervals")
    assert spec.max_output_tokens == 50
    assert provider.calls == 0


async def test_measured_cost_overrun_is_visible_and_budgeted(sample, monkeypatch):
    _prices(monkeypatch, input_rate="0.01", output_rate="0.02", ceiling="1.00", daily="10.00")
    quote = quote_for("video_intervals")
    overrun = quote.estimated_max_usd + Decimal("0.05000000")
    provider = FakeProvider(sample.db, usage_usd=overrun)
    row = await run_proposal(
        sample.db, sample.business.id, sample.editor.id, kind="video_intervals",
        idempotency_key="fix-b-overrun", payload={"mark": "one"}, provider=provider,
    )
    assert row.cost_known is True
    assert Decimal(str(row.cost_usd)) == overrun
    assert Decimal(str(row.cost_usd)) > Decimal(str(row.reserved_cost_usd))
    usage = await sample.db.get(BusinessCoverAiUsage, row.id)
    assert usage.outcome == "succeeded" and Decimal(str(usage.cost_usd)) == overrun
    assert await _spent(sample.db, sample.business.id, row.quota_day) == overrun


async def test_unknown_actual_usage_keeps_reservation_charge(sample, monkeypatch):
    _prices(monkeypatch)
    quote = quote_for("video_intervals")
    provider = FakeProvider(sample.db, usage_usd=None)
    row = await run_proposal(
        sample.db, sample.business.id, sample.editor.id, kind="video_intervals",
        idempotency_key="fix-b-unknown", payload={"mark": "one"}, provider=provider,
    )
    assert row.cost_known is False and Decimal(str(row.cost_usd)) == 0
    usage = await sample.db.get(BusinessCoverAiUsage, row.id)
    assert usage.outcome == "succeeded" and Decimal(str(usage.cost_usd)) == quote.estimated_max_usd


async def test_invalid_configuration_makes_no_paid_provider_call(sample, monkeypatch):
    provider = FakeProvider(sample.db)
    monkeypatch.setenv(FLAG, "true")
    monkeypatch.setenv(MODEL_ENV, "gpt-4o")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.delenv("BILIGN_BUSINESS_COVER_AI_PRICES_JSON", raising=False)
    with pytest.raises(HTTPException):
        await run_proposal(
            sample.db, sample.business.id, sample.editor.id, kind="video_intervals",
            idempotency_key="fix-b-noconfig", payload={"mark": "one"}, provider=provider,
        )
    assert provider.calls == 0


def test_conservative_max_usd_example_for_gpt4o():
    # Concrete: 500 prompt + 4*85 image = 840 input; 400 output.
    # rates 0.01 / 0.02 → 0.0084 + 0.008 = 0.0164
    assert 500 + 4 * 85 == 840
    expected = (Decimal("840") / Decimal(1000)) * Decimal("0.01") + (
        Decimal("400") / Decimal(1000)
    ) * Decimal("0.02")
    assert expected == Decimal("0.0164")
