"""Disposable PostgreSQL checks for claim fencing and brand-lock duration.

The suite skips with a BLOCKED message when BILIGN_OBS_FENCE_TEST_URL is unset.
It never reads the application database setting.
"""
import asyncio
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from backend.models.business_media_observations import BusinessMediaObservation as Observation
from backend.models.business_video_cover_jobs import BusinessVideoCoverJob as CoverJob
from backend.services.business_yansi import cover_jobs as covers
from backend.services.business_yansi import media_observations as observe
from backend.services.business_yansi.studio_media import business_media_lock


def _url() -> str:
    raw = os.getenv("BILIGN_OBS_FENCE_TEST_URL", "").strip()
    if not raw:
        pytest.skip("BLOCKED: disposable PostgreSQL is not configured")
    if raw.startswith("postgresql+asyncpg://"):
        return raw
    if raw.startswith("postgresql://"):
        return "postgresql+asyncpg://" + raw[len("postgresql://"):]
    pytest.skip("BLOCKED: disposable PostgreSQL URL must use the postgresql scheme")
    return ""


def _engine(url: str):
    return create_async_engine(url)


async def _prepare(url: str):
    admin = create_async_engine(url)
    async with admin.begin() as connection:
        await connection.execute(text("DROP SCHEMA IF EXISTS fence_test CASCADE"))
        await connection.execute(text("CREATE SCHEMA fence_test"))
        await connection.execute(text("SET search_path TO fence_test"))
        await connection.execute(text(
            """
            CREATE TABLE business_media_observations (
                id UUID PRIMARY KEY,
                business_id UUID NOT NULL,
                asset_id UUID NOT NULL,
                content_sha256 VARCHAR(64) NOT NULL,
                analyzer_profile VARCHAR(64) NOT NULL,
                idempotency_key VARCHAR(64) NOT NULL,
                status VARCHAR(24) NOT NULL,
                attempts INTEGER NOT NULL,
                max_attempts INTEGER NOT NULL,
                deadline_at TIMESTAMPTZ,
                claim_token VARCHAR(64),
                error_code VARCHAR(80),
                summary VARCHAR(400),
                visible_text VARCHAR(200),
                tags JSON,
                provider_model VARCHAR(64),
                input_tokens INTEGER,
                output_tokens INTEGER,
                origin VARCHAR(16) NOT NULL,
                created_by UUID NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        ))
        await connection.execute(text(
            """
            CREATE TABLE business_profiles (
                id UUID PRIMARY KEY,
                slug VARCHAR(64) UNIQUE NOT NULL,
                name VARCHAR(120) NOT NULL,
                logo_url TEXT,
                description VARCHAR(500) NOT NULL,
                owner_id UUID NOT NULL,
                verified BOOLEAN NOT NULL,
                official BOOLEAN NOT NULL,
                status VARCHAR(16) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        ))
        await connection.execute(text(
            """
            CREATE TABLE business_video_cover_jobs (
                id UUID PRIMARY KEY,
                business_id UUID NOT NULL,
                source_asset_id UUID NOT NULL,
                idempotency_key VARCHAR(64) NOT NULL,
                strategy VARCHAR(32) NOT NULL,
                start_ticks INTEGER NOT NULL,
                end_ticks INTEGER NOT NULL,
                encoder_profile VARCHAR(64) NOT NULL,
                status VARCHAR(24) NOT NULL,
                attempts INTEGER NOT NULL,
                max_attempts INTEGER NOT NULL,
                deadline_at TIMESTAMPTZ,
                claim_token VARCHAR(64),
                error_code VARCHAR(80),
                result_asset_id UUID,
                created_by UUID NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        ))
        await connection.execute(text(
            """
            CREATE TABLE business_brand_assets (
                id UUID PRIMARY KEY,
                business_id UUID NOT NULL,
                asset_type VARCHAR(16) NOT NULL,
                title VARCHAR(160) NOT NULL,
                caption VARCHAR(500),
                locator_kind VARCHAR(16),
                locator VARCHAR(1000),
                latitude NUMERIC(8, 6),
                longitude NUMERIC(9, 6),
                public_allowed BOOLEAN NOT NULL DEFAULT false,
                status VARCHAR(16) NOT NULL DEFAULT 'draft',
                created_by UUID NOT NULL,
                approved_by UUID,
                revision INTEGER NOT NULL DEFAULT 1,
                verified_duration BIGINT,
                verified_timescale BIGINT,
                verified_size_bytes BIGINT,
                verified_has_audio BOOLEAN,
                source_asset_id UUID,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        ))
    await admin.dispose()


async def _cleanup(url: str):
    admin = create_async_engine(url)
    async with admin.begin() as connection:
        await connection.execute(text("DROP SCHEMA IF EXISTS fence_test CASCADE"))
    await admin.dispose()


@pytest.fixture
async def fence_db():
    url = _url()
    await _prepare(url)
    engine = _engine(url)
    maker = async_sessionmaker(engine, expire_on_commit=False)

    @asynccontextmanager
    async def session():
        async with maker() as db:
            await db.execute(text("SET search_path TO fence_test"))
            yield db

    try:
        yield session
    finally:
        await engine.dispose()
        await _cleanup(url)


@pytest.mark.asyncio
async def test_postgres_stale_worker_cannot_complete(fence_db):
    job_id = uuid.uuid4()
    business_id = uuid.uuid4()
    old_token = "o" + "a" * 32
    new_token = "o" + "b" * 32
    async with fence_db() as db:
        db.add(Observation(
            id=job_id, business_id=business_id, asset_id=uuid.uuid4(),
            content_sha256="d" * 64, analyzer_profile=observe.PROFILE, idempotency_key="e" * 64,
            status="running", attempts=1, max_attempts=3, origin="upload", created_by=uuid.uuid4(),
            claim_token=old_token, deadline_at=datetime.now(timezone.utc) + timedelta(seconds=60),
        ))
        await db.commit()
    async with fence_db() as writer:
        row = await writer.get(Observation, job_id)
        row.claim_token = new_token
        row.deadline_at = datetime.now(timezone.utc) + timedelta(seconds=60)
        await writer.commit()
    async with fence_db() as stale:
        wrote = await observe.complete_owned(
            stale, (job_id, old_token, business_id),
            summary="Eski isci yazdi", tags=["eski"], visible_text=None,
            provider_model=None, input_tokens=None, output_tokens=None,
        )
        await stale.commit()
        assert wrote is False
    async with fence_db() as db:
        row = await db.get(Observation, job_id)
        assert row.status == "running" and row.claim_token == new_token and row.summary is None


@pytest.mark.asyncio
async def test_postgres_brand_lock_waits_until_commit(fence_db):
    business_id = uuid.uuid4()
    async with fence_db() as db:
        await db.execute(text(
            """
            INSERT INTO business_profiles
                (id, slug, name, description, owner_id, verified, official, status)
            VALUES
                (:id, :slug, 'Marka', '', :owner, false, false, 'active')
            """
        ), {"id": business_id, "slug": "fence-brand", "owner": uuid.uuid4()})
        await db.commit()
    started = asyncio.Event()
    release = asyncio.Event()

    async def hold():
        async with fence_db() as first:
            async with business_media_lock(first, business_id):
                started.set()
                await release.wait()
            await first.commit()

    async def blocked():
        await started.wait()
        async with fence_db() as second:
            await second.execute(text("SET lock_timeout = '300ms'"))
            with pytest.raises(DBAPIError):
                async with business_media_lock(second, business_id):
                    pass
        release.set()

    await asyncio.gather(hold(), blocked())
    async with fence_db() as third:
        async with business_media_lock(third, business_id):
            pass
        await third.commit()


@pytest.mark.asyncio
async def test_postgres_stale_cover_worker_cannot_fail_or_recover(fence_db):
    job_id = uuid.uuid4()
    business_id = uuid.uuid4()
    old_token = "e" + "a" * 32
    new_token = "e" + "b" * 32
    async with fence_db() as db:
        db.add(CoverJob(
            id=job_id, business_id=business_id, source_asset_id=uuid.uuid4(),
            idempotency_key="f" * 64, strategy="first_span", start_ticks=0, end_ticks=1000,
            encoder_profile="silent-derivative-v1", status="running", attempts=1, max_attempts=3,
            claim_token=old_token, deadline_at=datetime.now(timezone.utc) + timedelta(seconds=60),
            created_by=uuid.uuid4(),
        ))
        await db.commit()
    async with fence_db() as writer:
        row = await writer.get(CoverJob, job_id)
        row.claim_token = new_token
        row.deadline_at = datetime.now(timezone.utc) + timedelta(seconds=60)
        await writer.commit()
    async with fence_db() as stale:
        assert await covers.fail_owned(
            stale, job_id, business_id, old_token, "cover_authority_lost", retryable=False,
        ) is False
        await stale.commit()
    async with fence_db() as expired:
        row = await expired.get(CoverJob, job_id)
        row.deadline_at = datetime.now(timezone.utc) - timedelta(seconds=5)
        await expired.commit()
        # A newer live claim must not be recovered by a stale token's deadline rewrite.
        row = await expired.get(CoverJob, job_id)
        row.claim_token = new_token
        row.deadline_at = datetime.now(timezone.utc) + timedelta(seconds=60)
        await expired.commit()
        assert await covers.recover_stale(expired) == 0
        await expired.commit()
    async with fence_db() as db:
        row = await db.get(CoverJob, job_id)
        assert row.status == "running" and row.claim_token == new_token and row.error_code is None


@pytest.mark.asyncio
async def test_postgres_observation_fail_owned_respects_newer_claim(fence_db):
    job_id = uuid.uuid4()
    business_id = uuid.uuid4()
    old_token = "o" + "c" * 32
    new_token = "o" + "d" * 32
    async with fence_db() as db:
        db.add(Observation(
            id=job_id, business_id=business_id, asset_id=uuid.uuid4(),
            content_sha256="a" * 64, analyzer_profile=observe.PROFILE, idempotency_key="b" * 64,
            status="running", attempts=1, max_attempts=3, origin="upload", created_by=uuid.uuid4(),
            claim_token=old_token, deadline_at=datetime.now(timezone.utc) + timedelta(seconds=60),
        ))
        await db.commit()
    async with fence_db() as writer:
        row = await writer.get(Observation, job_id)
        row.claim_token = new_token
        await writer.commit()
    async with fence_db() as stale:
        assert await observe.fail_owned(
            stale, (job_id, old_token, business_id), "observation_authority_lost", retryable=False,
        ) is False
        await stale.commit()
    async with fence_db() as db:
        row = await db.get(Observation, job_id)
        assert row.status == "running" and row.claim_token == new_token


@pytest.mark.asyncio
async def test_postgres_stale_cover_worker_cannot_complete(fence_db):
    job_id = uuid.uuid4()
    business_id = uuid.uuid4()
    old_token = "e" + "c" * 32
    new_token = "e" + "d" * 32
    async with fence_db() as db:
        db.add(CoverJob(
            id=job_id, business_id=business_id, source_asset_id=uuid.uuid4(),
            idempotency_key="1" * 64, strategy="first_span", start_ticks=0, end_ticks=1000,
            encoder_profile="silent-derivative-v1", status="running", attempts=1, max_attempts=3,
            claim_token=old_token, deadline_at=datetime.now(timezone.utc) + timedelta(seconds=60),
            created_by=uuid.uuid4(),
        ))
        await db.commit()
    async with fence_db() as writer:
        row = await writer.get(CoverJob, job_id)
        row.claim_token = new_token
        row.deadline_at = datetime.now(timezone.utc) + timedelta(seconds=60)
        await writer.commit()
    async with fence_db() as stale:
        wrote = await covers.complete_owned(
            stale, job_id, business_id, old_token,
            values={"status": "ready", "result_asset_id": uuid.uuid4()},
        )
        await stale.commit()
        assert wrote is False
    async with fence_db() as db:
        row = await db.get(CoverJob, job_id)
        assert row.status == "running" and row.claim_token == new_token and row.result_asset_id is None


@pytest.mark.asyncio
async def test_postgres_cover_authority_rejection_leaves_newer_claim(fence_db):
    """Two sessions: an authority-loss fail from the old token cannot clear a live claim."""
    job_id = uuid.uuid4()
    business_id = uuid.uuid4()
    old_token = "e" + "e" * 32
    new_token = "e" + "f" * 32
    async with fence_db() as first:
        db_job = CoverJob(
            id=job_id, business_id=business_id, source_asset_id=uuid.uuid4(),
            idempotency_key="2" * 64, strategy="first_span", start_ticks=0, end_ticks=1000,
            encoder_profile="silent-derivative-v1", status="running", attempts=1, max_attempts=3,
            claim_token=old_token, deadline_at=datetime.now(timezone.utc) + timedelta(seconds=60),
            created_by=uuid.uuid4(),
        )
        first.add(db_job)
        await first.commit()
    async with fence_db() as second:
        row = await second.get(CoverJob, job_id)
        row.claim_token = new_token
        row.deadline_at = datetime.now(timezone.utc) + timedelta(seconds=180)
        await second.commit()
    async with fence_db() as stale:
        assert await covers.fail_owned(
            stale, job_id, business_id, old_token, "cover_authority_lost", retryable=False,
        ) is False
        await stale.commit()
    async with fence_db() as check:
        row = await check.get(CoverJob, job_id)
        assert row.status == "running" and row.claim_token == new_token and row.error_code is None


@pytest.mark.asyncio
async def test_postgres_claim_recovery_restores_only_expired_token(fence_db):
    expired_id = uuid.uuid4()
    live_id = uuid.uuid4()
    business_id = uuid.uuid4()
    expired_token = "e" + "1" * 32
    live_token = "e" + "2" * 32
    async with fence_db() as db:
        db.add(CoverJob(
            id=expired_id, business_id=business_id, source_asset_id=uuid.uuid4(),
            idempotency_key="3" * 64, strategy="first_span", start_ticks=0, end_ticks=1000,
            encoder_profile="silent-derivative-v1", status="running", attempts=1, max_attempts=3,
            claim_token=expired_token,
            deadline_at=datetime.now(timezone.utc) - timedelta(seconds=5),
            created_by=uuid.uuid4(),
        ))
        db.add(CoverJob(
            id=live_id, business_id=business_id, source_asset_id=uuid.uuid4(),
            idempotency_key="4" * 64, strategy="first_span", start_ticks=0, end_ticks=1000,
            encoder_profile="silent-derivative-v1", status="running", attempts=1, max_attempts=3,
            claim_token=live_token,
            deadline_at=datetime.now(timezone.utc) + timedelta(seconds=60),
            created_by=uuid.uuid4(),
        ))
        await db.commit()
    async with fence_db() as worker:
        assert await covers.recover_stale(worker) == 1
        await worker.commit()
    async with fence_db() as db:
        expired = await db.get(CoverJob, expired_id)
        live = await db.get(CoverJob, live_id)
        assert expired.status == "awaiting_encode" and expired.claim_token is None
        assert live.status == "running" and live.claim_token == live_token


@pytest.mark.asyncio
async def test_postgres_source_locator_change_is_visible_across_sessions(fence_db):
    from backend.models.business_brand_assets import BusinessBrandAsset as Asset

    asset_id = uuid.uuid4()
    business_id = uuid.uuid4()
    old_digest = "a" * 64
    new_digest = "b" * 64
    async with fence_db() as db:
        db.add(Asset(
            id=asset_id, business_id=business_id, asset_type="image", title="Kaynak",
            locator_kind="storage", locator=f"brands/{business_id}/objects/{old_digest}.png",
            public_allowed=False, status="draft", created_by=uuid.uuid4(),
        ))
        await db.commit()
    async with fence_db() as reader:
        cached = await observe.current_asset(reader, asset_id, business_id)
        assert observe.asset_matches(cached, business_id, asset_id, old_digest, old_digest)
        async with fence_db() as writer:
            row = await writer.get(Asset, asset_id)
            row.locator = f"brands/{business_id}/objects/{new_digest}.png"
            await writer.commit()
        fresh = await observe.current_asset(reader, asset_id, business_id)
        assert fresh.locator.endswith(f"{new_digest}.png")
        assert observe.asset_matches(fresh, business_id, asset_id, old_digest, old_digest) is False
        assert observe.asset_matches(fresh, business_id, asset_id, new_digest, new_digest) is True


@pytest.mark.asyncio
async def test_postgres_brand_lock_held_during_external_work_blocks_peer(fence_db):
    """Provider/FFmpeg windows must not hold a transaction; brand locks do and must block peers."""
    business_id = uuid.uuid4()
    async with fence_db() as db:
        await db.execute(text(
            """
            INSERT INTO business_profiles
                (id, slug, name, description, owner_id, verified, official, status)
            VALUES
                (:id, :slug, 'Marka', '', :owner, false, false, 'active')
            """
        ), {"id": business_id, "slug": "fence-external", "owner": uuid.uuid4()})
        await db.commit()
    started = asyncio.Event()
    release = asyncio.Event()
    peer_blocked = asyncio.Event()

    async def hold_like_finalize():
        async with fence_db() as first:
            async with business_media_lock(first, business_id):
                started.set()
                await release.wait()
            await first.commit()

    async def peer_during_external():
        await started.wait()
        async with fence_db() as second:
            await second.execute(text("SET lock_timeout = '200ms'"))
            with pytest.raises(DBAPIError):
                async with business_media_lock(second, business_id):
                    pass
            peer_blocked.set()
        release.set()

    await asyncio.gather(hold_like_finalize(), peer_during_external())
    assert peer_blocked.is_set()
