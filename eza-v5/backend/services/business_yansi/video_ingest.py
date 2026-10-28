"""Store a Business video only after the object is complete and valid.

Object storage and Postgres are not one transaction. A staging object is
removed unless the content-addressed copy exists. The final object is not
deleted when the database insert fails, because the same bytes may already
belong to another asset. Staging keys should also expire by bucket lifecycle.
"""
from __future__ import annotations

import uuid
from typing import AsyncIterator

from backend.models.business_brand_assets import BusinessBrandAsset as Asset
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


def limits_for(purpose: str) -> tuple[int, int]:
    if purpose == "cover":
        return COVER_MAX_BYTES, COVER_MAX_SECONDS
    if purpose == "step":
        return STEP_MAX_BYTES, STEP_MAX_SECONDS
    fail("video_purpose_rejected", 422)


async def ingest_upload(db, business_id, user_id, *, store, upload, title: str, caption: str, purpose: str, public_allowed: bool):
    await access(db, business_id, user_id, "editor")
    max_bytes, max_seconds = limits_for(purpose)

    async def chunks():
        while True:
            piece = await upload.read(CHUNK_BYTES)
            if not piece:
                return
            yield piece

    return await _ingest(db, business_id, user_id, store=store, chunks=chunks(), title=title, caption=caption, public_allowed=public_allowed, max_bytes=max_bytes, max_seconds=max_seconds)


async def ingest_url(db, business_id, user_id, *, store, url: str, title: str, caption: str, purpose: str, public_allowed: bool, resolver=None, exchange=None):
    await access(db, business_id, user_id, "editor")
    max_bytes, max_seconds = limits_for(purpose)
    kwargs = {}
    if resolver is not None:
        kwargs["resolver"] = resolver
    if exchange is not None:
        kwargs["exchange"] = exchange
    return await _ingest(
        db,
        business_id,
        user_id,
        store=store,
        chunks=_bounded(iter_https(url, max_bytes=max_bytes, **kwargs), max_bytes),
        title=title,
        caption=caption,
        public_allowed=public_allowed,
        max_bytes=max_bytes,
        max_seconds=max_seconds,
    )


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
            await store.copy_if_absent(staging, final, stat.sha256)
        except VideoObjectImmutable:
            fail("video_object_immutable", 409)
        published = True
    except VideoStorageError:
        fail("video_storage_failed", 502)
    finally:
        try:
            await store.delete(staging)
        except (VideoStorageError, Exception):
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
