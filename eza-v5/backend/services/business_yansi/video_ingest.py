"""Store a Business video only after the object is complete and valid.

Object storage and Postgres are not one transaction. A staging object is
removed unless the content-addressed copy exists. The final object is never
deleted on the request path: another request may already own that hash, and
an asset row may already point at it. Orphan finals are a separate
reference-checked maintenance job. Incomplete multipart uploads also need a
bucket lifecycle rule.

Quota and in-flight leases use Redis EVAL. If Redis cannot be reached, ingest
fails closed. A process-local counter is not a global limit. Each request
uses its own token. Releasing one token does not remove another request's
lease. Expired leases are dropped on the next acquire.
"""
from __future__ import annotations

import asyncio
import time
import uuid
from typing import AsyncIterator

from backend.models.business_brand_assets import BusinessBrandAsset as Asset
from backend.services.business_yansi.brand_asset_library import _apply_fields
from backend.services.business_yansi.brand_assets import normalize_asset
from backend.services.business_yansi.service import access, fail, uid
from backend.services.business_yansi.video_authority import lock_editor_rows
from backend.services.business_yansi.studio_media import business_media_lock
from backend.services.business_yansi.video_mp4 import Mp4Source, inspect_mp4
from backend.services.business_yansi.video_storage import (
    VideoObjectImmutable,
    VideoStorageError,
    assert_brand_key,
    staging_object_key,
    video_object_key,
)
from backend.services.business_yansi.video_url_guard import iter_https


CHUNK_BYTES = 64 * 1024
COVER_MAX_BYTES = 15 * 1024 * 1024
COVER_MAX_SECONDS = 20
STEP_MAX_BYTES = 40 * 1024 * 1024
STEP_MAX_SECONDS = 60
VIDEO_USER_LIMIT = 8
VIDEO_USER_WINDOW = 3600
VIDEO_BRAND_LIMIT = 30
VIDEO_BRAND_WINDOW = 3600
VIDEO_BRAND_INFLIGHT = 2
VIDEO_DEADLINE_SECONDS = 90
VIDEO_LEASE_SECONDS = VIDEO_DEADLINE_SECONDS
_RATE_SCRIPT = """-- video-rate
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local token = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
  return 0
end
redis.call('ZADD', key, now, token)
redis.call('PEXPIRE', key, window)
return 1
"""
_LEASE_ACQUIRE_SCRIPT = """-- video-lease-acquire
local key = KEYS[1]
local now = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local token = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, '-inf', now)
local count = redis.call('ZCARD', key)
if count >= limit then
  return 0
end
redis.call('ZADD', key, now + ttl, token)
redis.call('PEXPIRE', key, ttl)
return 1
"""
_LEASE_RELEASE_SCRIPT = """-- video-lease-release
return redis.call('ZREM', KEYS[1], ARGV[1])
"""


def limits_for(purpose: str) -> tuple[int, int]:
    if purpose == "cover":
        return COVER_MAX_BYTES, COVER_MAX_SECONDS
    if purpose == "step":
        return STEP_MAX_BYTES, STEP_MAX_SECONDS
    fail("video_purpose_rejected", 422)


def reset_video_budget_for_tests() -> None:
    """Kept so older tests can call it. Quotas live in Redis, not this process."""
    return None


def _now_ms() -> int:
    return int(time.time() * 1000)


async def ingest_upload(db, business_id, user_id, *, store, upload, title: str, caption: str, purpose: str, public_allowed: bool, prepare_cover: bool = True):
    await _authorize_start(db, business_id, user_id)
    if purpose not in {"cover", "step"}:
        fail("video_purpose_rejected", 422)
    max_bytes, max_seconds = STEP_MAX_BYTES, STEP_MAX_SECONDS

    async def chunks():
        while True:
            piece = await upload.read(CHUNK_BYTES)
            if not piece:
                return
            yield piece

    return await _guarded(
        db, business_id, user_id, store=store, chunks=chunks(), title=title, caption=caption,
        public_allowed=public_allowed, max_bytes=max_bytes, max_seconds=max_seconds,
        prepare_cover=prepare_cover,
    )


async def ingest_url(db, business_id, user_id, *, store, url: str, title: str, caption: str, purpose: str, public_allowed: bool, resolver=None, exchange=None):
    await _authorize_start(db, business_id, user_id)
    if purpose not in {"cover", "step"}:
        fail("video_purpose_rejected", 422)
    max_bytes, max_seconds = STEP_MAX_BYTES, STEP_MAX_SECONDS
    kwargs = {}
    if resolver is not None:
        kwargs["resolver"] = resolver
    if exchange is not None:
        kwargs["exchange"] = exchange
    return await _guarded(
        db, business_id, user_id, store=store,
        chunks=_bounded(iter_https(url, max_bytes=max_bytes, **kwargs), max_bytes),
        title=title, caption=caption, public_allowed=public_allowed, max_bytes=max_bytes, max_seconds=max_seconds,
    )


async def _authorize_start(db, business_id, user_id) -> None:
    await access(db, business_id, user_id, "editor")
    await db.commit()
    await _consume_window(f"user:{uid(user_id)}", VIDEO_USER_LIMIT, VIDEO_USER_WINDOW)
    await _consume_window(f"brand:{uid(business_id)}", VIDEO_BRAND_LIMIT, VIDEO_BRAND_WINDOW)


async def _guarded(db, business_id, user_id, **work):
    token = await _acquire_lease(business_id)
    try:
        try:
            async with asyncio.timeout(VIDEO_DEADLINE_SECONDS):
                return await _ingest(db, business_id, user_id, **work)
        except TimeoutError:
            fail("video_deadline", 408)
    finally:
        await _release_lease(business_id, token)


async def _redis():
    from backend.core.utils.dependencies import get_redis
    try:
        return await asyncio.wait_for(get_redis(), 0.3)
    except Exception:
        return None


async def _eval(script: str, keys: list[str], args: list):
    redis = await _redis()
    if redis is None:
        fail("video_quota_unavailable", 503)
    try:
        return await asyncio.wait_for(redis.eval(script, len(keys), *keys, *args), 0.5)
    except Exception as exc:
        from fastapi import HTTPException
        if isinstance(exc, HTTPException):
            raise
        fail("video_quota_unavailable", 503)


async def _consume_window(bucket: str, limit: int, window_seconds: int) -> None:
    token = uuid.uuid4().hex
    allowed = await _eval(
        _RATE_SCRIPT,
        [f"business_video_quota:{bucket}"],
        [_now_ms(), int(window_seconds * 1000), int(limit), token],
    )
    if int(allowed) != 1:
        fail("video_rate_limited", 429)


async def _acquire_lease(business_id) -> str:
    token = uuid.uuid4().hex
    ttl = int(VIDEO_LEASE_SECONDS * 1000)
    allowed = await _eval(
        _LEASE_ACQUIRE_SCRIPT,
        [f"business_video_lease:{uid(business_id)}"],
        [_now_ms(), ttl, int(VIDEO_BRAND_INFLIGHT), token],
    )
    if int(allowed) != 1:
        fail("video_busy", 429)
    return token


async def _release_lease(business_id, token: str) -> None:
    """Drop only this token. A Redis miss leaves the lease until its score expires."""
    current = asyncio.current_task()
    paused = 0
    if current is not None:
        while current.cancelling():
            current.uncancel()
            paused += 1
    try:
        redis = await _redis()
        if redis is None:
            return
        await asyncio.wait_for(
            redis.eval(_LEASE_RELEASE_SCRIPT, 1, f"business_video_lease:{uid(business_id)}", token),
            0.5,
        )
    except Exception:
        return
    finally:
        if paused:
            raise asyncio.CancelledError()


async def _ingest(db, business_id, user_id, *, store, chunks: AsyncIterator[bytes], title, caption, public_allowed, max_bytes, max_seconds, prepare_cover: bool = True):
    staging = staging_object_key(business_id, uuid.uuid4())
    assert_brand_key(business_id, staging)
    published = False
    try:
        stat = await store.write_stream(staging, _bounded(chunks, max_bytes))
        if stat.size <= 0:
            fail("video_file_rejected", 422)
        if stat.size > max_bytes:
            fail("video_too_large", 413)
        inspected = await inspect_mp4(Mp4Source(store, staging, stat.size), max_seconds=max_seconds)
        final = video_object_key(business_id, stat.sha256)
        assert_brand_key(business_id, final)
        if not final.endswith(f"/{stat.sha256}.mp4"):
            fail("video_file_rejected", 422)
        try:
            await store.copy_if_absent(staging, final, stat.sha256, size=stat.size)
        except VideoObjectImmutable:
            fail("video_object_immutable", 409)
        confirmed = await store.head(final)
        if confirmed is None or confirmed.size != stat.size or confirmed.sha256 != stat.sha256:
            fail("video_storage_failed", 502)
        published = True
    except VideoStorageError:
        fail("video_storage_failed", 502)
    finally:
        if "/staging/" in staging:
            try:
                await store.delete(staging)
            except Exception:
                pass
    if not published:
        fail("video_storage_failed", 502)
    return await _insert_asset(
        db, business_id, user_id, key=final, title=title, caption=caption, public_allowed=public_allowed,
        size_bytes=stat.size, duration=inspected.duration, timescale=inspected.timescale,
        has_audio=inspected.has_audio, prepare_cover=prepare_cover,
    )


async def _bounded(chunks: AsyncIterator[bytes], max_bytes: int) -> AsyncIterator[bytes]:
    total = 0
    async for chunk in chunks:
        if not chunk:
            continue
        total += len(chunk)
        if total > max_bytes:
            fail("video_too_large", 413)
        yield chunk


async def _insert_asset(db, business_id, user_id, *, key: str, title: str, caption: str, public_allowed: bool, size_bytes: int, duration: int, timescale: int, has_audio: bool = True, prepare_cover: bool = True):
    if type(size_bytes) is not int or type(duration) is not int or type(timescale) is not int or type(has_audio) is not bool:
        fail("video_file_rejected", 422)
    if size_bytes <= 0 or duration < 0 or timescale <= 0 or max(size_bytes, duration, timescale) > 2**63 - 1:
        fail("video_file_rejected", 422)
    async with business_media_lock(db, business_id):
        await _recheck_editor(db, business_id, user_id)
        fields = normalize_asset(
            business_id=business_id,
            asset_type="video",
            title=title,
            caption=caption or None,
            locator_kind="storage",
            locator=key,
        )
        row = Asset(business_id=uid(business_id), created_by=uid(user_id), revision=1)
        _apply_fields(row, fields, user_id, public_allowed)
        row.verified_duration = duration
        row.verified_timescale = timescale
        row.verified_size_bytes = size_bytes
        row.verified_has_audio = has_audio
        db.add(row)
        await db.flush()
        if prepare_cover:
            from backend.services.business_yansi.cover_jobs import ensure_cover_job
            await ensure_cover_job(db, row, user_id)
        from sqlalchemy.exc import OperationalError, ProgrammingError
        try:
            from backend.services.business_yansi.media_observations import ensure_observation
            await ensure_observation(db, row, user_id)
        except (OperationalError, ProgrammingError):
            pass
        await db.commit()
        await db.refresh(row)
        return row


async def _recheck_editor(db, business_id, user_id) -> None:
    """Lock organization, user, and membership, then decide from those rows.

    Order is organization, user, membership. access() is not the decision:
    db.get would return a membership that another transaction already deleted.
    """
    await lock_editor_rows(db, business_id, user_id)
