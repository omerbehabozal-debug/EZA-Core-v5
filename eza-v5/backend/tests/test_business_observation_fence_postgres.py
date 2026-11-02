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
