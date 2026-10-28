"""Store a Business video only after the object is complete and valid.

Object storage and Postgres are not one transaction. A staging object is
removed unless the content-addressed copy exists. The final object is not
deleted when the database insert fails, because the same bytes may already
belong to another asset. Incomplete multipart uploads also need a bucket
lifecycle rule; abort is attempted, and it is not a substitute for that rule.
Rate windows use Redis when it is reachable. Without Redis each process keeps
its own window, which does not cap a multi-worker deployment.
"""
from __future__ import annotations

import asyncio
import uuid
from typing import AsyncIterator

from backend.models.business_brand_assets import BusinessBrandAsset as Asset
from backend.models.production import User
from backend.security.rate_limit import RateLimitError, consume_rate_bucket
from backend.services.business_yansi.brand_asset_library import _apply_fields
from backend.services.business_yansi.brand_assets import normalize_asset
from backend.services.business_yansi.service import access, fail, uid
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
_inflight: dict[str, int] = {}
_inflight_lock = asyncio.Lock()


def limits_for(purpose: str) -> tuple[int, int]:
    if purpose == "cover":
        return COVER_MAX_BYTES, COVER_MAX_SECONDS
    if purpose == "step":
        return STEP_MAX_BYTES, STEP_MAX_SECONDS
    fail("video_purpose_rejected", 422)


def reset_video_budget_for_tests() -> None:
    _inflight.clear()


async def ingest_upload(db, business_id, user_id, *, store, upload, title: str, caption: str, purpose: str, public_allowed: bool):
    await _authorize_start(db, business_id, user_id)
    max_bytes, max_seconds = limits_for(purpose)

    async def chunks():
        while True:
            piece = await upload.read(CHUNK_BYTES)
            if not piece:
                return
            yield piece

    return await _guarded(
        db, business_id, user_id, store=store, chunks=chunks(), title=title, caption=caption,
        public_allowed=public_allowed, max_bytes=max_bytes, max_seconds=max_seconds,
    )


async def ingest_url(db, business_id, user_id, *, store, url: str, title: str, caption: str, purpose: str, public_allowed: bool, resolver=None, exchange=None):
    await _authorize_start(db, business_id, user_id)
    max_bytes, max_seconds = limits_for(purpose)
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
    try:
        await consume_rate_bucket(f"user:{uid(user_id)}", VIDEO_USER_LIMIT, VIDEO_USER_WINDOW, "business_video_user")
        await consume_rate_bucket(f"brand:{uid(business_id)}", VIDEO_BRAND_LIMIT, VIDEO_BRAND_WINDOW, "business_video_brand")
    except RateLimitError:
        fail("video_rate_limited", 429)


async def _guarded(db, business_id, user_id, **work):
    backend = await _acquire_inflight(business_id)
    try:
        try:
            async with asyncio.timeout(VIDEO_DEADLINE_SECONDS):
                return await _ingest(db, business_id, user_id, **work)
        except TimeoutError:
            fail("video_deadline", 408)
    finally:
        await _release_inflight(business_id, backend)


async def _redis():
    from backend.core.utils.dependencies import get_redis
    return await asyncio.wait_for(get_redis(), 0.3)


async def _acquire_inflight(business_id) -> str:
    key = f"business_video_inflight:{uid(business_id)}"
    try:
        backend = await asyncio.wait_for(_try_redis_slot(key), 0.5)
        if backend:
            return backend
    except Exception as exc:
        from fastapi import HTTPException
        if isinstance(exc, HTTPException):
            raise
    async with _inflight_lock:
        count = _inflight.get(key, 0) + 1
        if count > VIDEO_BRAND_INFLIGHT:
            fail("video_busy", 429)
        _inflight[key] = count
    return "memory"


async def _try_redis_slot(key: str) -> str | None:
    redis = await _redis()
    if redis is None:
        return None
    count = int(await redis.incr(key))
    try:
        await redis.expire(key, int(VIDEO_DEADLINE_SECONDS) + 30)
    except Exception:
        pass
    if count > VIDEO_BRAND_INFLIGHT:
        try:
            await redis.decr(key)
        except Exception:
            pass
        fail("video_busy", 429)
    return "redis"


async def _release_inflight(business_id, backend: str) -> None:
    key = f"business_video_inflight:{uid(business_id)}"
    if backend == "redis":
        try:
            redis = await _redis()
            if redis is not None:
                await redis.decr(key)
                return
        except Exception:
            pass
    async with _inflight_lock:
        left = _inflight.get(key, 0) - 1
        if left <= 0:
            _inflight.pop(key, None)
        else:
            _inflight[key] = left


async def _ingest(db, business_id, user_id, *, store, chunks: AsyncIterator[bytes], title, caption, public_allowed, max_bytes, max_seconds):
    staging = staging_object_key(business_id, uuid.uuid4())
    assert_brand_key(business_id, staging)
    published = False
    try:
        stat = await store.write_stream(staging, _bounded(chunks, max_bytes))
        if stat.size <= 0:
            fail("video_file_rejected", 422)
        if stat.size > max_bytes:
            fail("video_too_large", 413)
        await inspect_mp4(Mp4Source(store, staging, stat.size), max_seconds=max_seconds)
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
        try:
            await store.delete(staging)
        except Exception:
            pass
    if not published:
        fail("video_storage_failed", 502)
    return await _insert_asset(db, business_id, user_id, key=final, title=title, caption=caption, public_allowed=public_allowed)


async def _bounded(chunks: AsyncIterator[bytes], max_bytes: int) -> AsyncIterator[bytes]:
    total = 0
    async for chunk in chunks:
        if not chunk:
            continue
        total += len(chunk)
        if total > max_bytes:
            fail("video_too_large", 413)
        yield chunk


async def _insert_asset(db, business_id, user_id, *, key: str, title: str, caption: str, public_allowed: bool):
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
        db.add(row)
        await db.commit()
        await db.refresh(row)
        return row


async def _recheck_editor(db, business_id, user_id) -> None:
    user = await db.get(User, uid(user_id))
    if user is None or not user.is_active:
        fail("business_access_denied", 403)
    await access(db, business_id, user_id, "editor")
