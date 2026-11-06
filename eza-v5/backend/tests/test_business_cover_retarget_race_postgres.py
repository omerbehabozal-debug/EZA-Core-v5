"""Two-session PostgreSQL races for cover retarget versus encode claim.

SQLite is not evidence for this concurrency claim. The suite skips with BLOCKED
when no disposable local URL is configured. DATABASE_URL is never read.
"""
from __future__ import annotations

import asyncio
import os
import uuid
from contextlib import asynccontextmanager

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.schema import CreateSchema, DropSchema

from backend.core.utils.dependencies import Base
from backend.models.business_brand_assets import BusinessBrandAsset
from backend.models.business_video_cover_jobs import BusinessVideoCoverJob
from backend.models.business_yansi import BusinessMember, BusinessProfile
from backend.models.production import Organization, User
from backend.services.business_yansi import cover_jobs as covers
from backend.services.business_yansi import service as svc


def _raw_url() -> str:
    for name in (
        "BILIGN_COVER_RETARGET_TEST_URL",
        "BILIGN_OBS_FENCE_TEST_URL",
        "BUSINESS_VIDEO_AUTH_TEST_POSTGRES_URL",
    ):
        raw = os.getenv(name, "").strip()
        if raw:
            return raw
    return ""


def _require_url():
    raw = _raw_url()
    if not raw:
        pytest.skip("BLOCKED: disposable PostgreSQL is not configured for cover retarget races")
    if raw.startswith("postgresql://"):
        raw = "postgresql+asyncpg://" + raw[len("postgresql://"):]
    if not raw.startswith("postgresql+asyncpg://"):
        pytest.skip("BLOCKED: disposable PostgreSQL URL must use the postgresql scheme")
    url = make_url(raw)
    assert url.host in {"127.0.0.1", "localhost", "::1"}
    return raw


@asynccontextmanager
async def _database():
    url = _require_url()
    schema = "cover_retarget_" + uuid.uuid4().hex
    engine = create_async_engine(
        url,
        connect_args={
            "server_settings": {
                "search_path": schema,
                "lock_timeout": "3s",
                "statement_timeout": "8s",
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
                        BusinessVideoCoverJob.__table__,
                    ],
                )

            await connection.run_sync(setup)
        maker = async_sessionmaker(engine, expire_on_commit=False)
        async with maker() as db:
            owner = User(id=uuid.uuid4(), email=f"owner-{uuid.uuid4().hex[:8]}@example.test", role="user", is_active=True)
            editor = User(id=uuid.uuid4(), email=f"editor-{uuid.uuid4().hex[:8]}@example.test", role="user", is_active=True)
            outsider = User(id=uuid.uuid4(), email=f"out-{uuid.uuid4().hex[:8]}@example.test", role="user", is_active=True)
            org = Organization(id=uuid.uuid4(), name="Retarget", status="active")
            other_org = Organization(id=uuid.uuid4(), name="Other", status="active")
            db.add_all([owner, editor, outsider, org, other_org])
            await db.commit()
            business = await svc.create_business(
                db, owner,
                {
                    "organizationId": str(org.id),
                    "ownerId": str(owner.id),
                    "slug": "retarget-" + uuid.uuid4().hex[:8],
                    "name": "Retarget",
                },
            )
            other = await svc.create_business(
                db, outsider,
                {
                    "organizationId": str(other_org.id),
                    "ownerId": str(outsider.id),
                    "slug": "other-" + uuid.uuid4().hex[:8],
                    "name": "Other",
                },
            )
            db.add(BusinessMember(business_id=business.id, user_id=editor.id, role="editor"))
            await db.commit()
            yield maker, business, other, editor, outsider
    finally:
        if made:
            async with engine.begin() as connection:
                await connection.execute(DropSchema(schema, cascade=True))
        await engine.dispose()


async def _video(db, business_id, user_id, *, duration_ms=40_000, scale=1000, audio=True):
    digest = "a" * 64
    asset = BusinessBrandAsset(
        id=uuid.uuid4(),
        business_id=business_id,
        asset_type="video",
        title="Atolye filmi",
        caption="",
        locator_kind="storage",
        locator=f"brand-videos/{business_id}/{digest}.mp4",
        public_allowed=False,
        status="draft",
        created_by=user_id,
        verified_duration=duration_ms,
        verified_timescale=scale,
        verified_size_bytes=1024,
        verified_has_audio=audio,
    )
    db.add(asset)
    await db.flush()
    job = await covers.ensure_cover_job(db, asset, user_id)
    job.status = "awaiting_encode"
    job.strategy = covers.CHOSEN_STRATEGY
    job.encoder_profile = covers.DERIVATIVE_PROFILE
    job.start_ticks = 0
    job.end_ticks = min(duration_ms, 20 * scale)
    job.result_asset_id = None
    job.claim_token = None
    job.deadline_at = None
    await db.commit()
    await db.refresh(asset)
    await db.refresh(job)
    return asset, job


@pytest.mark.asyncio
async def test_postgres_other_interval_leaves_running_claim():
    async with _database() as (maker, business, _other, editor, _outsider):
        async with maker() as seed:
            asset, job = await _video(seed, business.id, editor.id)
            job_id = job.id
            asset_id = asset.id
            start_before = job.start_ticks
            end_before = job.end_ticks

        async with maker() as worker:
            claimed = await covers.claim_encode(worker)
            await worker.commit()
            assert claimed is not None and claimed.id == job_id
            token = claimed.claim_token
            assert token and claimed.status == "running"

        async with maker() as editor_session:
            changed = await covers.retarget_cover(editor_session, business.id, editor.id, asset_id, 5, 15)
            assert changed.id != job_id
            assert changed.start_ticks == 5 * 1000 and changed.end_ticks == 15 * 1000

        async with maker() as check:
            row = await check.get(BusinessVideoCoverJob, job_id)
            assert row.status == "running"
            assert row.claim_token == token
            assert row.start_ticks == start_before and row.end_ticks == end_before


@pytest.mark.asyncio
async def test_postgres_new_interval_does_not_replace_claimable_job():
    async with _database() as (maker, business, _other, editor, _outsider):
        async with maker() as seed:
            asset, job = await _video(seed, business.id, editor.id)
            job_id = job.id
            asset_id = asset.id
            scale = asset.verified_timescale

        async with maker() as editor_session:
            changed = await covers.retarget_cover(
                editor_session, business.id, editor.id, asset_id, 5, 15,
            )
            assert changed.id != job_id
            assert changed.status == "awaiting_encode"
            assert changed.start_ticks == 5 * scale
            assert changed.end_ticks == 15 * scale
            assert changed.strategy == covers.CHOSEN_STRATEGY
            assert changed.claim_token is None
            changed_id = changed.id

        async with maker() as worker:
            claimed = await covers.claim_encode(worker)
            await worker.commit()
            assert claimed is not None and claimed.id == job_id
            assert claimed.start_ticks != 5 * scale
            assert claimed.status == "running" and claimed.claim_token

        async with maker() as check:
            fresh = await check.get(BusinessVideoCoverJob, changed_id)
            assert fresh.status == "awaiting_encode"
            assert fresh.start_ticks == 5 * scale and fresh.end_ticks == 15 * scale


@pytest.mark.asyncio
async def test_postgres_cross_brand_retarget_is_denied():
    async with _database() as (maker, business, other, editor, outsider):
        async with maker() as seed:
            asset, job = await _video(seed, business.id, editor.id)
            asset_id = asset.id
            before = (job.start_ticks, job.end_ticks, job.status)

        async with maker() as foreign:
            with pytest.raises(HTTPException) as caught:
                await covers.retarget_cover(foreign, other.id, outsider.id, asset_id, 5, 15)
            assert caught.value.status_code in {403, 404}

        async with maker() as check:
            row = await check.get(BusinessVideoCoverJob, job.id)
            assert (row.start_ticks, row.end_ticks, row.status) == before


@pytest.mark.asyncio
async def test_postgres_different_intervals_keep_separate_jobs():
    async with _database() as (maker, business, _other, editor, _outsider):
        async with maker() as seed:
            asset, job = await _video(seed, business.id, editor.id)
            job_id = job.id
            asset_id = asset.id
            scale = asset.verified_timescale

        async with maker() as first:
            one = await covers.retarget_cover(first, business.id, editor.id, asset_id, 2, 8)
            assert one.id != job_id and one.start_ticks == 2 * scale
            one_id = one.id

        async with maker() as second:
            two = await covers.retarget_cover(second, business.id, editor.id, asset_id, 6, 16)
            assert two.id != one_id and two.id != job_id
            assert two.start_ticks == 6 * scale and two.end_ticks == 16 * scale
            two_id = two.id

        async with maker() as again:
            repeated = await covers.retarget_cover(again, business.id, editor.id, asset_id, 6, 16)
            assert repeated.id == two_id

        async with maker() as check:
            total = await check.scalar(
                select(func.count()).select_from(BusinessVideoCoverJob).where(
                    BusinessVideoCoverJob.business_id == business.id,
                    BusinessVideoCoverJob.source_asset_id == asset_id,
                )
            )
            assert total == 3
            row = await check.get(BusinessVideoCoverJob, job_id)
            assert row.start_ticks == 0
            fresh = await check.get(BusinessVideoCoverJob, two_id)
            assert fresh.start_ticks == 6 * scale and fresh.end_ticks == 16 * scale


@pytest.mark.asyncio
async def test_postgres_ready_result_survives_a_late_retarget_update():
    async with _database() as (maker, business, _other, editor, _outsider):
        async with maker() as seed:
            asset, job = await _video(seed, business.id, editor.id)
            result = BusinessBrandAsset(
                id=uuid.uuid4(),
                business_id=business.id,
                asset_type="video",
                title="Hazir turev",
                caption="",
                locator_kind="storage",
                locator=f"brand-videos/{business.id}/{'b' * 64}.mp4",
                public_allowed=False,
                status="draft",
                created_by=editor.id,
                source_asset_id=asset.id,
                verified_duration=8000,
                verified_timescale=1000,
                verified_size_bytes=1024,
                verified_has_audio=False,
            )
            seed.add(result)
            await seed.commit()
            job_id, result_id, business_id = job.id, result.id, business.id
            start_before, end_before = job.start_ticks, job.end_ticks

        read_done = asyncio.Event()
        worker_done = asyncio.Event()

        async def editor_update():
            async with maker() as session:
                row = await session.get(BusinessVideoCoverJob, job_id)
                assert row.result_asset_id is None and row.status == "awaiting_encode"
                read_done.set()
                await worker_done.wait()
                outcome = await session.execute(
                    update(BusinessVideoCoverJob)
                    .where(*covers.mutable_window_clause(job_id, business_id))
                    .values(status="awaiting_encode", result_asset_id=None, start_ticks=5000, end_ticks=15000)
                    .execution_options(synchronize_session=False)
                )
                await session.commit()
                return outcome.rowcount

        async def worker():
            await read_done.wait()
            async with maker() as session:
                row = await session.get(BusinessVideoCoverJob, job_id)
                row.status = "ready"
                row.result_asset_id = result_id
                await session.commit()
            worker_done.set()

        rowcount, _done = await asyncio.gather(editor_update(), worker())
        assert rowcount == 0
        async with maker() as check:
            row = await check.get(BusinessVideoCoverJob, job_id)
            assert row.status == "ready"
            assert row.result_asset_id == result_id
            assert row.start_ticks == start_before and row.end_ticks == end_before


@pytest.mark.asyncio
async def test_postgres_same_interval_requests_share_one_job():
    async with _database() as (maker, business, _other, editor, _outsider):
        async with maker() as seed:
            asset, _job = await _video(seed, business.id, editor.id)
            asset_id = asset.id

        async def confirm():
            async with maker() as session:
                return await covers.retarget_cover(session, business.id, editor.id, asset_id, 5, 15)

        first, second = await asyncio.gather(confirm(), confirm())
        assert first.id == second.id
        assert first.start_ticks == second.start_ticks and first.end_ticks == second.end_ticks
        async with maker() as check:
            total = await check.scalar(
                select(func.count()).select_from(BusinessVideoCoverJob).where(
                    BusinessVideoCoverJob.business_id == business.id,
                    BusinessVideoCoverJob.source_asset_id == asset_id,
                    BusinessVideoCoverJob.start_ticks == first.start_ticks,
                    BusinessVideoCoverJob.end_ticks == first.end_ticks,
                )
            )
            assert total == 1
