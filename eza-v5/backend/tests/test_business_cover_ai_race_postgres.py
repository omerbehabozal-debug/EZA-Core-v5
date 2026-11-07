"""Two-session PostgreSQL races for Business Cover AI reservation and billing.

SQLite is not evidence for this concurrency claim. The suite skips with BLOCKED
when no disposable local URL is configured. DATABASE_URL is never read.
"""
from __future__ import annotations

import asyncio
import json
import os
import uuid
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import func, select, update
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.schema import CreateSchema, DropSchema

from backend.core.utils.dependencies import Base
from backend.models.business_brand_assets import BusinessBrandAsset
from backend.models.business_cover_ai import BusinessCoverAiProposal, BusinessCoverAiUsage
from backend.models.business_yansi import BusinessMember, BusinessProfile
from backend.models.production import Organization, User
from backend.services.business_yansi import service as svc
from backend.services.business_yansi.cover_ai import (
    FLAG,
    MODEL_ENV,
    PRICES,
    CoverAiResult,
    _spent,
    bind_spec,
    build_execution_spec,
    load_execution_spec,
    request_hash,
    run_proposal,
)
from backend.services.business_yansi.cover_video_suggestions import (
    present_suggestion,
    read_cover_suggestion,
    source_matches,
    suggest_video_intervals,
)
from backend.tests.test_business_cover_ai_proposals import FakeProvider, HoldingProvider


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
        pytest.skip("BLOCKED: disposable PostgreSQL is not configured for cover AI races")
    if raw.startswith("postgresql://"):
        raw = "postgresql+asyncpg://" + raw[len("postgresql://"):]
    if not raw.startswith("postgresql+asyncpg://"):
        pytest.skip("BLOCKED: disposable PostgreSQL URL must use the postgresql scheme")
    url = make_url(raw)
    assert url.host in {"127.0.0.1", "localhost", "::1"}
    return raw


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
):
    monkeypatch.setenv(FLAG, "true")
    monkeypatch.setenv(MODEL_ENV, model)
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
        }),
    )
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_AI_REQUEST_USD", ceiling)
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_AI_DAILY_USD", daily)


@asynccontextmanager
async def _database():
    url = _require_url()
    schema = "cover_ai_" + uuid.uuid4().hex
    engine = create_async_engine(
        url,
        connect_args={
            "server_settings": {
                "search_path": schema,
                "lock_timeout": "3s",
                "statement_timeout": "15s",
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
                        BusinessProfile.__table__,
                        BusinessMember.__table__,
                        BusinessBrandAsset.__table__,
                        BusinessCoverAiProposal.__table__,
                        BusinessCoverAiUsage.__table__,
                    ],
                )

            await connection.run_sync(setup)
        maker = async_sessionmaker(engine, expire_on_commit=False)
        async with maker() as db:
            owner = User(id=uuid.uuid4(), email=f"owner-{uuid.uuid4().hex[:8]}@example.test", role="user", is_active=True)
            editor = User(id=uuid.uuid4(), email=f"editor-{uuid.uuid4().hex[:8]}@example.test", role="user", is_active=True)
            org = Organization(id=uuid.uuid4(), name="CoverAI", status="active")
            db.add_all([owner, editor, org])
            await db.commit()
            business = await svc.create_business(
                db, owner,
                {
                    "organizationId": str(org.id),
                    "ownerId": str(owner.id),
                    "slug": "cover-ai-" + uuid.uuid4().hex[:8],
                    "name": "Cover AI",
                },
            )
            db.add(BusinessMember(business_id=business.id, user_id=editor.id, role="editor"))
            await db.commit()
            yield maker, business, editor
    finally:
        if made:
            async with engine.begin() as connection:
                await connection.execute(DropSchema(schema, cascade=True))
        await engine.dispose()


async def _video(db, business_id, user_id, *, seconds=40, revision=1):
    digest = uuid.uuid4().hex + uuid.uuid4().hex[:32]
    digest = (digest + "a" * 64)[:64]
    asset = BusinessBrandAsset(
        id=uuid.uuid4(),
        business_id=business_id,
        asset_type="video",
        title="Atolye filmi",
        caption="",
        locator_kind="storage",
        locator=f"brand-videos/{business_id}/{digest}.mp4",
        public_allowed=False,
        status="approved",
        created_by=user_id,
        verified_duration=seconds * 1000,
        verified_timescale=1000,
        verified_size_bytes=2048,
        verified_has_audio=True,
        revision=revision,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


# --- A: same idempotency key -----------------------------------------------------


@pytest.mark.asyncio
async def test_postgres_same_key_one_proposal_one_provider(monkeypatch):
    _prices(monkeypatch)
    provider = HoldingProvider(None, mark_dispatch=False)
    # HoldingProvider needs .db for in_transaction probe; use None-safe path.
    provider.db = type("S", (), {"in_transaction": staticmethod(lambda: False)})()

    async with _database() as (maker, business, editor):
        async def once(session, key="race-same-key"):
            return await run_proposal(
                session, business.id, editor.id, kind="video_intervals",
                idempotency_key=key, payload={"mark": "one"}, provider=provider,
            )

        async with maker() as first_db, maker() as second_db:
            first_task = asyncio.create_task(once(first_db))
            await asyncio.wait_for(provider.entered.wait(), timeout=8)
            second = await asyncio.wait_for(once(second_db), timeout=8)
            assert second.status == "running"
            provider.gate.set()
            first = await asyncio.wait_for(first_task, timeout=8)
            assert first.id == second.id
            assert first.status == "succeeded"
            assert provider.calls == 1
            async with maker() as check:
                count = await check.scalar(select(func.count()).select_from(BusinessCoverAiProposal))
                usage = await check.get(BusinessCoverAiUsage, first.id)
                assert count == 1
                assert usage.outcome == "succeeded"


# --- B: creator loses claim ------------------------------------------------------


@pytest.mark.asyncio
async def test_postgres_creator_cancel_cannot_release_claimer(monkeypatch):
    _prices(monkeypatch)
    import backend.services.business_yansi.cover_ai as cover_ai

    provider = HoldingProvider(type("S", (), {"in_transaction": staticmethod(lambda: False)})(), mark_dispatch=True)
    gate = asyncio.Event()
    real_reload = cover_ai._reload
    hits = {"n": 0}
    proposal_id = {"id": None}

    async def pause_first(db, pid):
        hits["n"] += 1
        row = await real_reload(db, pid)
        if hits["n"] == 1:
            proposal_id["id"] = pid
            await gate.wait()
            return await real_reload(db, pid)
        return row

    monkeypatch.setattr(cover_ai, "_reload", pause_first)

    async with _database() as (maker, business, editor):
        async def creator():
            async with maker() as session:
                return await run_proposal(
                    session, business.id, editor.id, kind="video_intervals",
                    idempotency_key="race-claim-loss", payload={"mark": "one"}, provider=provider,
                )

        creator_task = asyncio.create_task(creator())
        for _ in range(100):
            if proposal_id["id"] is not None:
                break
            await asyncio.sleep(0.02)
        assert proposal_id["id"] is not None

        async def claimer():
            async with maker() as session:
                return await run_proposal(
                    session, business.id, editor.id, kind="video_intervals",
                    idempotency_key="race-claim-loss", payload={"mark": "one"}, provider=provider,
                )

        claimer_task = asyncio.create_task(claimer())
        await asyncio.wait_for(provider.entered.wait(), timeout=8)

        async with maker() as check:
            running = await check.get(BusinessCoverAiProposal, proposal_id["id"])
            assert running.status == "running"
            usage = await check.get(BusinessCoverAiUsage, running.id)
            assert usage.outcome == "reserved"

        creator_task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await creator_task

        async with maker() as check:
            running = await check.get(BusinessCoverAiProposal, proposal_id["id"])
            usage = await check.get(BusinessCoverAiUsage, running.id)
            assert running.status == "running"
            assert usage.outcome == "reserved"

        provider.gate.set()
        finished = await asyncio.wait_for(claimer_task, timeout=8)
        assert finished.status == "succeeded"
        assert provider.calls == 1
        async with maker() as check:
            usage = await check.get(BusinessCoverAiUsage, finished.id)
            assert usage.outcome == "succeeded"


# --- C: duplicate observer cancellation ------------------------------------------


@pytest.mark.asyncio
async def test_postgres_duplicate_cancel_leaves_owner_running(monkeypatch):
    _prices(monkeypatch)
    import backend.services.business_yansi.cover_ai as cover_ai

    provider = HoldingProvider(type("S", (), {"in_transaction": staticmethod(lambda: False)})(), mark_dispatch=True)
    real_reload = cover_ai._reload

    async def boom(_db, _pid):
        raise asyncio.CancelledError()

    async with _database() as (maker, business, editor):
        async def owner():
            async with maker() as session:
                return await run_proposal(
                    session, business.id, editor.id, kind="video_intervals",
                    idempotency_key="race-dup-cancel", payload={"mark": "one"}, provider=provider,
                )

        owner_task = asyncio.create_task(owner())
        await asyncio.wait_for(provider.entered.wait(), timeout=8)
        # Patch only after the owner is inside the provider so the duplicate's first reload cancels.
        monkeypatch.setattr(cover_ai, "_reload", boom)

        async def duplicate():
            async with maker() as session:
                return await run_proposal(
                    session, business.id, editor.id, kind="video_intervals",
                    idempotency_key="race-dup-cancel", payload={"mark": "one"}, provider=provider,
                )

        with pytest.raises(asyncio.CancelledError):
            await duplicate()

        monkeypatch.setattr(cover_ai, "_reload", real_reload)
        async with maker() as check:
            row = await check.scalar(
                select(BusinessCoverAiProposal).where(BusinessCoverAiProposal.idempotency_key == "race-dup-cancel")
            )
            usage = await check.get(BusinessCoverAiUsage, row.id)
            assert row.status == "running"
            assert usage.outcome == "reserved"

        provider.gate.set()
        finished = await asyncio.wait_for(owner_task, timeout=8)
        assert finished.status == "succeeded"
        assert provider.calls == 1


# --- D: cancellation around dispatch ---------------------------------------------


@pytest.mark.asyncio
async def test_postgres_owner_cancel_before_dispatch_releases(monkeypatch):
    _prices(monkeypatch)
    entered = asyncio.Event()

    class PreDispatch:
        def __init__(self):
            self.calls = 0

        async def complete(self, request):
            self.calls += 1
            entered.set()
            await asyncio.Event().wait()
            request.dispatch.mark_dispatched()
            return CoverAiResult(payload={"ok": True}, model=request.spec.model)

    provider = PreDispatch()
    async with _database() as (maker, business, editor):
        async def once():
            async with maker() as session:
                return await run_proposal(
                    session, business.id, editor.id, kind="video_intervals",
                    idempotency_key="race-pre-dispatch", payload={"mark": "one"}, provider=provider,
                )

        task = asyncio.create_task(once())
        await asyncio.wait_for(entered.wait(), timeout=8)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        async with maker() as check:
            row = await check.scalar(
                select(BusinessCoverAiProposal).where(BusinessCoverAiProposal.idempotency_key == "race-pre-dispatch")
            )
            usage = await check.get(BusinessCoverAiUsage, row.id)
            assert row.status == "failed" and row.error_code == "cover_ai_cancelled"
            assert usage.outcome == "released"
            assert await _spent(check, business.id, row.quota_day) == 0


@pytest.mark.asyncio
async def test_postgres_owner_cancel_after_dispatch_uncertain(monkeypatch):
    _prices(monkeypatch)
    provider = HoldingProvider(type("S", (), {"in_transaction": staticmethod(lambda: False)})(), mark_dispatch=True)
    async with _database() as (maker, business, editor):
        async def once():
            async with maker() as session:
                return await run_proposal(
                    session, business.id, editor.id, kind="video_intervals",
                    idempotency_key="race-post-dispatch", payload={"mark": "one"}, provider=provider,
                )

        task = asyncio.create_task(once())
        await asyncio.wait_for(provider.entered.wait(), timeout=8)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        async with maker() as check:
            row = await check.scalar(
                select(BusinessCoverAiProposal).where(BusinessCoverAiProposal.idempotency_key == "race-post-dispatch")
            )
            usage = await check.get(BusinessCoverAiUsage, row.id)
            assert row.status == "expired"
            assert usage.outcome == "uncertain"
            assert await _spent(check, business.id, row.quota_day) == Decimal(str(row.reserved_cost_usd))
            assert provider.calls == 1


# --- E: concurrent daily budget --------------------------------------------------


@pytest.mark.asyncio
async def test_postgres_concurrent_budget_cannot_overspend(monkeypatch):
    # One gpt-4o reservation ≈ 0.0164; daily 0.03 allows one, not two.
    # business_media_lock (FOR UPDATE) must serialize the spent check + insert.
    _prices(monkeypatch, daily="0.03000000", ceiling="1.00")
    provider = FakeProvider()

    async with _database() as (maker, business, editor):
        results = []

        async def once(key):
            async with maker() as session:
                try:
                    row = await run_proposal(
                        session, business.id, editor.id, kind="video_intervals",
                        idempotency_key=key, payload={"mark": key}, provider=provider,
                    )
                    results.append(("ok", row))
                except Exception as exc:
                    results.append(("err", exc))

        await asyncio.wait_for(
            asyncio.gather(once("race-budget-a"), once("race-budget-b")),
            timeout=15,
        )
        oks = [item for item in results if item[0] == "ok"]
        errs = [item for item in results if item[0] == "err"]
        assert len(oks) == 1, results
        assert len(errs) == 1, results
        detail = getattr(errs[0][1], "detail", None)
        code = detail.get("code") if isinstance(detail, dict) else None
        assert code == "cover_ai_daily_budget"
        async with maker() as check:
            count = await check.scalar(select(func.count()).select_from(BusinessCoverAiProposal))
            assert count == 1
            assert provider.calls == 1


# --- F: settlement versus stale cleanup ------------------------------------------


@pytest.mark.asyncio
async def test_postgres_stale_cleanup_cannot_overwrite_success(monkeypatch):
    _prices(monkeypatch)
    from backend.services.business_yansi.cover_ai import _abandon

    provider = FakeProvider()
    async with _database() as (maker, business, editor):
        async with maker() as session:
            row = await run_proposal(
                session, business.id, editor.id, kind="video_intervals",
                idempotency_key="race-stale-cleanup", payload={"mark": "one"}, provider=provider,
            )
            assert row.status == "succeeded"
            proposal_id = row.id

        async with maker() as cleanup:
            await _abandon(
                cleanup, business.id, proposal_id,
                dispatched=True, from_statuses=("running", "reserved"),
            )

        async with maker() as check:
            final = await check.get(BusinessCoverAiProposal, proposal_id)
            usage = await check.get(BusinessCoverAiUsage, proposal_id)
            assert final.status == "succeeded"
            assert usage.outcome == "succeeded"
            assert provider.calls == 1


@pytest.mark.asyncio
async def test_postgres_settle_wins_over_overlapping_cancel(monkeypatch):
    _prices(monkeypatch)
    provider = HoldingProvider(type("S", (), {"in_transaction": staticmethod(lambda: False)})(), mark_dispatch=True)

    async with _database() as (maker, business, editor):
        async def owner():
            async with maker() as session:
                return await run_proposal(
                    session, business.id, editor.id, kind="video_intervals",
                    idempotency_key="race-settle-cancel", payload={"mark": "one"}, provider=provider,
                )

        task = asyncio.create_task(owner())
        await asyncio.wait_for(provider.entered.wait(), timeout=8)
        provider.gate.set()
        # Overlap: cancel shortly after release so settle and abandon race.
        await asyncio.sleep(0)
        task.cancel()
        try:
            finished = await asyncio.wait_for(asyncio.shield(task), timeout=8)
        except asyncio.CancelledError:
            async with maker() as check:
                row = await check.scalar(
                    select(BusinessCoverAiProposal).where(
                        BusinessCoverAiProposal.idempotency_key == "race-settle-cancel"
                    )
                )
                usage = await check.get(BusinessCoverAiUsage, row.id)
                assert row.status in {"succeeded", "expired"}
                if row.status == "succeeded":
                    assert usage.outcome == "succeeded"
                else:
                    assert usage.outcome == "uncertain"
                assert provider.calls == 1
            return
        assert finished.status == "succeeded"
        assert provider.calls == 1


# --- G: persisted pricing integrity ----------------------------------------------


@pytest.mark.asyncio
async def test_postgres_mutated_payload_blocks_provider(monkeypatch):
    _prices(monkeypatch, input_rate="0.01", output_rate="0.02", version="prices-v1")
    provider = FakeProvider()
    async with _database() as (maker, business, editor):
        quote = build_execution_spec("video_intervals")
        good = bind_spec({"mark": "mutate"}, quote)
        digest = request_hash("video_intervals", good)
        mutated = dict(good)
        mutated["inputUsdPer1k"] = "0.02000000"
        mutated["outputUsdPer1k"] = "0.00100000"
        mutated["estimatedMaxUsd"] = "0.01720000"
        assert load_execution_spec(mutated) is not None
        assert request_hash("video_intervals", mutated) != digest

        async with maker() as seed:
            orphan = BusinessCoverAiProposal(
                business_id=business.id,
                actor_id=editor.id,
                idempotency_key="race-hash-mutate",
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
            seed.add(orphan)
            await seed.flush()
            seed.add(BusinessCoverAiUsage(
                proposal_id=orphan.id,
                business_id=business.id,
                quota_day=orphan.quota_day,
                cost_usd=quote.estimated_max_usd,
                outcome="reserved",
            ))
            await seed.commit()
            orphan_id = orphan.id

        async with maker() as session:
            closed = await run_proposal(
                session, business.id, editor.id, kind="video_intervals",
                idempotency_key="race-hash-mutate", payload={"mark": "mutate"}, provider=provider,
            )
            assert closed.id == orphan_id
            assert closed.status == "failed"
            assert closed.error_code == "cover_ai_spec_corrupt"
        assert provider.calls == 0
        async with maker() as check:
            usage = await check.get(BusinessCoverAiUsage, orphan_id)
            assert usage.outcome == "released"


# --- H: source revision integrity ------------------------------------------------


@pytest.mark.asyncio
async def test_postgres_archived_source_hides_selectable_intervals(monkeypatch):
    _prices(monkeypatch)
    provider = FakeProvider(payload={"intervals": [{"startSeconds": 1, "endSeconds": 6}]})
    async with _database() as (maker, business, editor):
        async with maker() as seed:
            asset = await _video(seed, business.id, editor.id)
            asset_id = asset.id

        async with maker() as session:
            row = await suggest_video_intervals(
                session, business.id, editor.id, asset_id, "race-rev-1", provider=provider,
            )
            assert row.status == "succeeded"
            proposal_id = row.id

        async with maker() as mutate:
            asset = await mutate.get(BusinessBrandAsset, asset_id)
            asset.status = "archived"
            await mutate.commit()

        async with maker() as session:
            view = await read_cover_suggestion(session, business.id, editor.id, asset_id, proposal_id)
            assert view["sourceCurrent"] is False
            assert view["intervals"] == []
            asset = await session.get(BusinessBrandAsset, asset_id)
            assert source_matches(await session.get(BusinessCoverAiProposal, proposal_id), asset) is False


@pytest.mark.asyncio
async def test_postgres_revision_change_during_hold_hides_intervals(monkeypatch):
    _prices(monkeypatch)
    provider = HoldingProvider(type("S", (), {"in_transaction": staticmethod(lambda: False)})(), mark_dispatch=False)
    provider.payload = {"intervals": [{"startSeconds": 1, "endSeconds": 6}]}

    async with _database() as (maker, business, editor):
        async with maker() as seed:
            asset = await _video(seed, business.id, editor.id)
            asset_id = asset.id
            original_revision = asset.revision

        async def once():
            async with maker() as session:
                return await suggest_video_intervals(
                    session, business.id, editor.id, asset_id, "race-rev-hold", provider=provider,
                )

        task = asyncio.create_task(once())
        await asyncio.wait_for(provider.entered.wait(), timeout=8)
        async with maker() as mutate:
            asset = await mutate.get(BusinessBrandAsset, asset_id)
            asset.revision = original_revision + 1
            asset.verified_size_bytes = int(asset.verified_size_bytes) + 1
            await mutate.commit()
        provider.gate.set()
        row = await asyncio.wait_for(task, timeout=8)
        assert row.status == "succeeded"
        assert provider.calls == 1
        async with maker() as session:
            view = present_suggestion(row, asset_id, source_current=False)
            assert view["intervals"] == []
            live = await read_cover_suggestion(session, business.id, editor.id, asset_id, row.id)
            assert live["sourceCurrent"] is False
            assert live["intervals"] == []
