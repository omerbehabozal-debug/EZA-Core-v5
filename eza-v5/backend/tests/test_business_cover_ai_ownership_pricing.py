"""Two remaining MEDIUM fixes: cancel ownership and complete pricing persistence."""
import asyncio
import json
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from backend.models.business_cover_ai import BusinessCoverAiProposal, BusinessCoverAiUsage
from backend.services.business_yansi.cover_ai import (
    CoverAiResult,
    _spent,
    bind_spec,
    build_execution_spec,
    load_execution_spec,
    request_hash,
    run_proposal,
)
from backend.tests.test_business_cover_ai_proposals import FakeProvider, HoldingProvider, _prices
from backend.tests.test_business_yansi import sample


# --- FIX A: state-scoped cancellation ownership -----------------------------------


async def test_creator_cancel_after_other_claim_does_not_release_runner(sample, monkeypatch):
    """A reserves and pauses; B claims and runs; A cancel must not touch B."""
    _prices(monkeypatch)
    business_id, editor_id = sample.business.id, sample.editor.id
    provider = HoldingProvider(sample.db, mark_dispatch=True)
    import backend.services.business_yansi.cover_ai as cover_ai
    from sqlalchemy.ext.asyncio import async_sessionmaker

    gate = asyncio.Event()
    real_reload = cover_ai._reload
    creator_id = {"id": None}
    hits = {"n": 0}

    async def pause_first_reload(db, proposal_id):
        hits["n"] += 1
        row = await real_reload(db, proposal_id)
        if hits["n"] == 1:
            creator_id["id"] = proposal_id
            await gate.wait()
            return await real_reload(db, proposal_id)
        return row

    monkeypatch.setattr(cover_ai, "_reload", pause_first_reload)

    async def creator():
        return await run_proposal(
            sample.db, business_id, editor_id, kind="video_intervals",
            idempotency_key="scope-key-1", payload={"mark": "one"}, provider=provider,
        )

    creator_task = asyncio.create_task(creator())
    for _ in range(50):
        if creator_id["id"] is not None:
            break
        await asyncio.sleep(0.02)
    assert creator_id["id"] is not None

    async def claimer():
        async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as other:
            return await run_proposal(
                other, business_id, editor_id, kind="video_intervals",
                idempotency_key="scope-key-1", payload={"mark": "one"}, provider=provider,
            )

    claimer_task = asyncio.create_task(claimer())
    await asyncio.wait_for(provider.entered.wait(), timeout=5)
    running = await sample.db.get(BusinessCoverAiProposal, creator_id["id"])
    await sample.db.refresh(running)
    assert running.status == "running"

    creator_task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await creator_task

    await sample.db.refresh(running)
    usage_mid = await sample.db.get(BusinessCoverAiUsage, running.id)
    await sample.db.refresh(usage_mid)
    assert running.status == "running"
    assert usage_mid.outcome == "reserved"

    provider.gate.set()
    finished = await asyncio.wait_for(claimer_task, timeout=5)
    assert finished.status == "succeeded"
    assert provider.calls == 1
    usage = await sample.db.get(BusinessCoverAiUsage, finished.id)
    await sample.db.refresh(usage)
    assert usage.outcome == "succeeded"
    assert await _spent(sample.db, business_id, finished.quota_day) == Decimal(str(finished.reserved_cost_usd))


async def test_duplicate_cancel_during_reload_does_not_release_owner(sample, monkeypatch):
    _prices(monkeypatch)
    business_id, editor_id = sample.business.id, sample.editor.id
    provider = HoldingProvider(sample.db, mark_dispatch=True)

    async def once(session):
        return await run_proposal(
            session, business_id, editor_id, kind="video_intervals",
            idempotency_key="own-key-1", payload={"mark": "one"}, provider=provider,
        )

    owner_task = asyncio.create_task(once(sample.db))
    await asyncio.wait_for(provider.entered.wait(), timeout=5)
    owner_row = await sample.db.scalar(
        select(BusinessCoverAiProposal).where(BusinessCoverAiProposal.idempotency_key == "own-key-1")
    )
    assert owner_row.status == "running"
    usage_before = await sample.db.get(BusinessCoverAiUsage, owner_row.id)
    assert usage_before.outcome == "reserved"

    from sqlalchemy.ext.asyncio import async_sessionmaker
    import backend.services.business_yansi.cover_ai as cover_ai

    real_reload = cover_ai._reload
    hits = {"n": 0}

    async def flaky(db, proposal_id):
        hits["n"] += 1
        if hits["n"] == 1:
            raise asyncio.CancelledError()
        return await real_reload(db, proposal_id)

    monkeypatch.setattr(cover_ai, "_reload", flaky)

    async def duplicate():
        async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as other:
            return await once(other)

    dup_task = asyncio.create_task(duplicate())
    with pytest.raises(asyncio.CancelledError):
        await dup_task

    monkeypatch.setattr(cover_ai, "_reload", real_reload)
    await sample.db.refresh(owner_row)
    usage_mid = await sample.db.get(BusinessCoverAiUsage, owner_row.id)
    assert owner_row.status == "running"
    assert usage_mid.outcome == "reserved"

    provider.gate.set()
    finished = await asyncio.wait_for(owner_task, timeout=5)
    assert finished.status == "succeeded"
    assert provider.calls == 1
    usage = await sample.db.get(BusinessCoverAiUsage, finished.id)
    await sample.db.refresh(usage)
    assert usage.outcome == "succeeded"


async def test_duplicate_cancel_after_success_does_not_alter_terminal(sample, monkeypatch):
    _prices(monkeypatch)
    business_id, editor_id = sample.business.id, sample.editor.id
    provider = FakeProvider(sample.db)
    first = await run_proposal(
        sample.db, business_id, editor_id, kind="video_intervals",
        idempotency_key="own-key-done", payload={"mark": "one"}, provider=provider,
    )
    assert first.status == "succeeded" and provider.calls == 1

    import backend.services.business_yansi.cover_ai as cover_ai

    async def boom(_db, _id):
        raise asyncio.CancelledError()

    monkeypatch.setattr(cover_ai, "_reload", boom)
    with pytest.raises(asyncio.CancelledError):
        await run_proposal(
            sample.db, business_id, editor_id, kind="video_intervals",
            idempotency_key="own-key-done", payload={"mark": "one"}, provider=provider,
        )
    row = await sample.db.get(BusinessCoverAiProposal, first.id)
    usage = await sample.db.get(BusinessCoverAiUsage, first.id)
    assert row.status == "succeeded"
    assert usage.outcome == "succeeded"
    assert provider.calls == 1


async def test_owner_pre_claim_cancel_still_releases(sample, monkeypatch):
    _prices(monkeypatch)
    business_id, editor_id = sample.business.id, sample.editor.id
    calls = {"n": 0}

    class Never(FakeProvider):
        async def complete(self, request):
            calls["n"] += 1
            raise AssertionError("provider must not run")

    import backend.services.business_yansi.cover_ai as cover_ai

    async def boom(db, proposal_id):
        row = await db.get(BusinessCoverAiProposal, proposal_id)
        assert row.status == "reserved" and row.deadline_at is not None
        raise asyncio.CancelledError()

    monkeypatch.setattr(cover_ai, "_reload", boom)
    with pytest.raises(asyncio.CancelledError):
        await run_proposal(
            sample.db, business_id, editor_id, kind="video_intervals",
            idempotency_key="own-key-preclaim", payload={"mark": "one"}, provider=Never(sample.db),
        )
    assert calls["n"] == 0
    row = await sample.db.scalar(
        select(BusinessCoverAiProposal).where(BusinessCoverAiProposal.idempotency_key == "own-key-preclaim")
    )
    usage = await sample.db.get(BusinessCoverAiUsage, row.id)
    assert row.status == "failed" and usage.outcome == "released"
    assert await _spent(sample.db, business_id, row.quota_day) == 0


async def test_owner_cancel_after_dispatch_is_uncertain(sample, monkeypatch):
    _prices(monkeypatch)
    business_id, editor_id = sample.business.id, sample.editor.id
    provider = HoldingProvider(sample.db, mark_dispatch=True)
    task = asyncio.create_task(run_proposal(
        sample.db, business_id, editor_id, kind="video_intervals",
        idempotency_key="scope-key-dispatch", payload={"mark": "one"}, provider=provider,
    ))
    await asyncio.wait_for(provider.entered.wait(), timeout=5)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    row = await sample.db.scalar(
        select(BusinessCoverAiProposal).where(BusinessCoverAiProposal.idempotency_key == "scope-key-dispatch")
    )
    usage = await sample.db.get(BusinessCoverAiUsage, row.id)
    assert row.status == "expired" and usage.outcome == "uncertain"
    assert provider.calls == 1


async def test_terminal_settlement_cannot_be_overwritten(sample, monkeypatch):
    _prices(monkeypatch)
    provider = FakeProvider(sample.db)
    first = await run_proposal(
        sample.db, sample.business.id, sample.editor.id, kind="video_intervals",
        idempotency_key="scope-key-terminal", payload={"mark": "one"}, provider=provider,
    )
    assert first.status == "succeeded"
    from backend.services.business_yansi.cover_ai import _abandon

    await _abandon(
        sample.db, sample.business.id, first.id,
        dispatched=True, from_statuses=("running", "reserved"),
    )
    row = await sample.db.get(BusinessCoverAiProposal, first.id)
    usage = await sample.db.get(BusinessCoverAiUsage, first.id)
    assert row.status == "succeeded"
    assert usage.outcome == "succeeded"


# --- FIX B: hash validation + complete pricing persistence ------------------------


async def test_mutated_persisted_tariff_rejected_before_provider(sample, monkeypatch):
    """Payload stays internally consistent but diverges from stored request_hash."""
    _prices(monkeypatch, input_rate="0.01", output_rate="0.02", version="prices-v1")
    business_id, editor_id = sample.business.id, sample.editor.id
    provider = FakeProvider(sample.db)
    from datetime import date, datetime, timedelta, timezone
    from backend.models.business_cover_ai import BusinessCoverAiProposal as Proposal
    from backend.models.business_cover_ai import BusinessCoverAiUsage as Usage

    quote = build_execution_spec("video_intervals")
    good = bind_spec({"mark": "mutate"}, quote)
    digest = request_hash("video_intervals", good)
    # Same estimated total, different unit prices — load_execution_spec still accepts.
    mutated = dict(good)
    mutated["inputUsdPer1k"] = "0.02000000"
    mutated["outputUsdPer1k"] = "0.00100000"
    # 840*0.02/1000 + 400*0.001/1000 = 0.0168+0.0004 = 0.0172 ≠ 0.0164 — adjust estimated too
    # so the spec stays self-consistent while diverging from the reserved hash.
    mutated["estimatedMaxUsd"] = "0.01720000"
    assert load_execution_spec(mutated) is not None
    assert request_hash("video_intervals", mutated) != digest

    orphan = Proposal(
        business_id=business_id,
        actor_id=editor_id,
        idempotency_key="hash-key-mutate",
        request_hash=digest,
        kind="video_intervals",
        status="reserved",
        request_payload=mutated,
        provider_model="gpt-4o",
        reserved_cost_usd=quote.estimated_max_usd,
        cost_usd=0,
        cost_known=False,
        cost_limit_usd=Decimal("1.00"),
        quota_day=date.today(),
        attempts=0,
        max_attempts=1,
        deadline_at=datetime.now(timezone.utc) + timedelta(seconds=60),
    )
    sample.db.add(orphan)
    await sample.db.flush()
    sample.db.add(Usage(
        proposal_id=orphan.id, business_id=business_id, quota_day=orphan.quota_day,
        cost_usd=quote.estimated_max_usd, outcome="reserved",
    ))
    await sample.db.commit()
    closed = await run_proposal(
        sample.db, business_id, editor_id, kind="video_intervals",
        idempotency_key="hash-key-mutate", payload={"mark": "mutate"}, provider=provider,
    )
    assert closed.status == "failed" and closed.error_code == "cover_ai_spec_corrupt"
    usage = await sample.db.get(BusinessCoverAiUsage, closed.id)
    assert usage.outcome == "released"
    assert provider.calls == 0


async def test_unchanged_persisted_payload_succeeds(sample, monkeypatch):
    _prices(monkeypatch)
    provider = FakeProvider(sample.db)
    row = await run_proposal(
        sample.db, sample.business.id, sample.editor.id, kind="video_intervals",
        idempotency_key="hash-key-ok", payload={"mark": "one"}, provider=provider,
    )
    assert row.status == "succeeded" and provider.calls == 1
    again = await run_proposal(
        sample.db, sample.business.id, sample.editor.id, kind="video_intervals",
        idempotency_key="hash-key-ok", payload={"mark": "one"}, provider=provider,
    )
    assert again.id == row.id and provider.calls == 1


def test_different_tariffs_same_total_produce_different_hashes(monkeypatch):
    # 840*0.02/1000 + 400*0.001/1000 = 0.0168 + 0.0004 = 0.0172
    _prices(monkeypatch, input_rate="0.02", output_rate="0.001", version="prices-v1")
    a = bind_spec({"mark": "x"}, build_execution_spec("video_intervals"))
    hash_a = request_hash("video_intervals", a)
    # 840*0.01/1000 + 400*0.022/1000 = 0.0084 + 0.0088 = 0.0172
    _prices(monkeypatch, input_rate="0.01", output_rate="0.022", version="prices-v1")
    b = bind_spec({"mark": "x"}, build_execution_spec("video_intervals"))
    hash_b = request_hash("video_intervals", b)
    assert Decimal(a["estimatedMaxUsd"]) == Decimal(b["estimatedMaxUsd"])
    assert a["pricingVersion"] == b["pricingVersion"]
    assert a["inputUsdPer1k"] != b["inputUsdPer1k"]
    assert a["outputUsdPer1k"] != b["outputUsdPer1k"]
    assert hash_a != hash_b


async def test_changed_unit_prices_conflict_with_existing_reservation(sample, monkeypatch):
    _prices(monkeypatch, input_rate="0.01", output_rate="0.02", version="prices-v1")
    provider = FakeProvider(sample.db)
    first = await run_proposal(
        sample.db, sample.business.id, sample.editor.id, kind="video_intervals",
        idempotency_key="price-key-1", payload={"mark": "one"}, provider=provider,
    )
    assert first.status == "succeeded"
    original = first.request_payload
    assert original["inputUsdPer1k"] == "0.01000000"
    assert original["outputUsdPer1k"] == "0.02000000"
    _prices(monkeypatch, input_rate="0.02", output_rate="0.01", version="prices-v1")
    with pytest.raises(HTTPException) as conflict:
        await run_proposal(
            sample.db, sample.business.id, sample.editor.id, kind="video_intervals",
            idempotency_key="price-key-1", payload={"mark": "one"}, provider=provider,
        )
    assert conflict.value.detail["code"] == "cover_ai_idempotency_conflict"
    assert provider.calls == 1


async def test_execution_uses_stored_spec_not_current_env(sample, monkeypatch):
    _prices(monkeypatch, input_rate="0.01", output_rate="0.02", model="gpt-4o")
    business_id, editor_id = sample.business.id, sample.editor.id
    seen = {}

    class Capture(FakeProvider):
        async def complete(self, request):
            self.calls += 1
            seen["model"] = request.spec.model
            seen["input"] = request.spec.input_usd_per_1k
            seen["output"] = request.spec.output_usd_per_1k
            seen["max_out"] = request.spec.max_output_tokens
            # Env changes mid-flight must not affect the bound request.
            monkeypatch.setenv(
                "BILIGN_BUSINESS_COVER_AI_PRICES_JSON",
                json.dumps({
                    "version": "prices-v1",
                    "models": {
                        "gpt-4o": {
                            "inputUsdPer1k": "9.99",
                            "outputUsdPer1k": "9.99",
                            "maxInputTokens": 12000,
                            "maxOutputTokens": 400,
                        }
                    },
                }),
            )
            prompt = 100
            completion = 50
            usage = (
                (Decimal(prompt) / Decimal(1000)) * request.spec.input_usd_per_1k
                + (Decimal(completion) / Decimal(1000)) * request.spec.output_usd_per_1k
            )
            return CoverAiResult(payload=self.payload, model=request.spec.model, usage_usd=usage)

    provider = Capture(sample.db)
    row = await run_proposal(
        sample.db, business_id, editor_id, kind="video_intervals",
        idempotency_key="price-key-bound", payload={"mark": "one"}, provider=provider,
    )
    assert row.status == "succeeded"
    assert seen["model"] == "gpt-4o"
    assert seen["input"] == Decimal("0.01000000")
    assert seen["output"] == Decimal("0.02000000")
    assert Decimal(str(row.cost_usd)) == Decimal("0.00200000")
    assert load_execution_spec(row.request_payload).input_usd_per_1k == Decimal("0.01000000")


async def test_corrupt_persisted_spec_fails_closed(sample, monkeypatch):
    _prices(monkeypatch)
    business_id, editor_id = sample.business.id, sample.editor.id
    provider = FakeProvider(sample.db)
    assert load_execution_spec({"modelId": "gpt-4o"}) is None
    assert load_execution_spec(None) is None

    from datetime import date, datetime, timedelta, timezone
    from backend.models.business_cover_ai import BusinessCoverAiProposal as Proposal
    from backend.models.business_cover_ai import BusinessCoverAiUsage as Usage

    quote = build_execution_spec("video_intervals")
    good = bind_spec({"mark": "corrupt"}, quote)
    digest = request_hash("video_intervals", good)
    corrupt = dict(good)
    corrupt.pop("inputUsdPer1k")
    assert load_execution_spec(corrupt) is None
    # Hash stays the good digest so a duplicate request can claim; payload is corrupt.
    orphan = Proposal(
        business_id=business_id,
        actor_id=editor_id,
        idempotency_key="price-key-orphan",
        request_hash=digest,
        kind="video_intervals",
        status="reserved",
        request_payload=corrupt,
        provider_model="gpt-4o",
        reserved_cost_usd=quote.estimated_max_usd,
        cost_usd=0,
        cost_known=False,
        cost_limit_usd=Decimal("1.00"),
        quota_day=date.today(),
        attempts=0,
        max_attempts=1,
        deadline_at=datetime.now(timezone.utc) + timedelta(seconds=60),
    )
    sample.db.add(orphan)
    await sample.db.flush()
    sample.db.add(Usage(
        proposal_id=orphan.id, business_id=business_id, quota_day=orphan.quota_day,
        cost_usd=quote.estimated_max_usd, outcome="reserved",
    ))
    await sample.db.commit()
    closed = await run_proposal(
        sample.db, business_id, editor_id, kind="video_intervals",
        idempotency_key="price-key-orphan", payload={"mark": "corrupt"}, provider=provider,
    )
    assert closed.status == "failed" and closed.error_code == "cover_ai_spec_corrupt"
    usage = await sample.db.get(BusinessCoverAiUsage, closed.id)
    assert usage.outcome == "released"
    assert provider.calls == 0
