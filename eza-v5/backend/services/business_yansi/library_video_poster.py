"""Lightweight JPEG card posters for stored brand videos.

Posters are sidecar caches under the brand-asset root. Original R2/object keys
and BrandAsset rows stay untouched. Cards never stream the full video.
"""
from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import select

from backend.models.business_brand_assets import BusinessBrandAsset as Asset
from backend.services.business_yansi.brand_asset_library import asset_root
from backend.services.business_yansi.image_observe import ObservationFailure
from backend.services.business_yansi.service import access, fail, uid
from backend.services.business_yansi.video_ingest import STEP_MAX_BYTES
from backend.services.business_yansi.video_observe import extract_frames, spill_video
from backend.services.business_yansi.video_storage import VideoStorageError, assert_brand_key, video_store_from_env

logger = logging.getLogger(__name__)

_POSTER_SUFFIX = ".cardposter.jpg"
_CARD_EDGE = 720
_CARD_JPEG_QUALITY = 72
# Prefer a short prefix when moov is near the front; fall back to a full spill once.
_PROBE_BYTES = 4 * 1024 * 1024
_SEEK_MS = 500
# Cap concurrent ffmpeg/spill work process-wide; per-key locks collapse duplicate misses.
_POSTER_JOBS = asyncio.Semaphore(2)
_POSTER_KEY_LOCKS: dict[str, asyncio.Lock] = {}
_POSTER_KEY_GUARD = asyncio.Lock()


async def _poster_key_lock(cache_key: str) -> asyncio.Lock:
    async with _POSTER_KEY_GUARD:
        lock = _POSTER_KEY_LOCKS.get(cache_key)
        if lock is None:
            lock = asyncio.Lock()
            _POSTER_KEY_LOCKS[cache_key] = lock
        return lock


def _poster_path(business_id, locator: str) -> Path:
    business = str(uid(business_id))
    name = locator.rsplit("/", 1)[-1]
    if not name or ".." in name or "/" in name or "\\" in name:
        fail("asset_file_unavailable", 404)
    root = asset_root().resolve()
    target = (root / business / f"{name}{_POSTER_SUFFIX}").resolve()
    if root != target and root not in target.parents:
        fail("asset_file_unavailable", 404)
    return target


def _encode_card_poster(frame_jpeg: bytes) -> bytes:
    from io import BytesIO

    from PIL import Image, UnidentifiedImageError
    from PIL.Image import DecompressionBombError

    try:
        with Image.open(BytesIO(frame_jpeg)) as raw:
            raw.load()
            image = raw.convert("RGB") if raw.mode != "RGB" else raw
            if max(image.size) > _CARD_EDGE:
                image = image.copy()
                image.thumbnail((_CARD_EDGE, _CARD_EDGE), Image.Resampling.LANCZOS)
            out = BytesIO()
            image.save(out, format="JPEG", quality=_CARD_JPEG_QUALITY, optimize=True)
            return out.getvalue()
    except (UnidentifiedImageError, DecompressionBombError, OSError, ValueError) as exc:
        raise ObservationFailure("observation_video_rejected", retryable=False) from exc


def _seek_ms(duration: int | None, timescale: int | None) -> int:
    if type(duration) is int and type(timescale) is int and duration > 0 and timescale > 0:
        duration_ms = int((duration * 1000) / timescale)
        if duration_ms > 2000:
            return min(1000, max(_SEEK_MS, duration_ms // 10))
        if duration_ms > 0:
            return max(0, min(_SEEK_MS, duration_ms // 2))
    return _SEEK_MS


async def _write_prefix(store, locator: str, dest: str, size: int) -> int:
    limit = min(size, _PROBE_BYTES)
    written = 0
    with open(dest, "wb") as handle:
        offset = 0
        while offset < limit:
            end = min(limit - 1, offset + 65536 - 1)
            piece = await store.get_range(locator, offset, end)
            written += len(piece)
            handle.write(piece)
            offset += len(piece)
    return written


async def _frame_from_path(path: str, stamp_ms: int) -> bytes:
    frames = await extract_frames(path, [stamp_ms])
    if not frames:
        raise ObservationFailure("observation_frames_unavailable", retryable=True)
    return frames[0][1]


async def _generate_poster_jpeg(store, business_id, locator: str, size: int, stamp_ms: int) -> bytes:
    directory = tempfile.mkdtemp(prefix="bilign-poster-")
    try:
        probe = os.path.join(directory, "probe.mp4")
        await _write_prefix(store, locator, probe, size)
        try:
            return _encode_card_poster(await _frame_from_path(probe, stamp_ms))
        except ObservationFailure:
            logger.info("video_poster_prefix_miss locator=%s; spilling full object once", locator)
        full = os.path.join(directory, "full.mp4")
        await spill_video(store, business_id, locator, full, size)
        return _encode_card_poster(await _frame_from_path(full, stamp_ms))
    finally:
        import shutil

        shutil.rmtree(directory, ignore_errors=True)


async def stored_video_poster(db, business_id, user_id, asset_id):
    """Auth-gated JPEG for Content Library video cards. Caches beside brand assets."""
    await access(db, business_id, user_id, "viewer")
    row = await db.scalar(
        select(Asset).where(Asset.id == asset_id, Asset.business_id == business_id)
    )
    if row is None:
        fail("asset_not_found", 404)
    if row.asset_type != "video" or row.locator_kind != "storage" or not row.locator:
        fail("asset_file_unavailable", 404)
    if row.status == "archived":
        fail("archived_asset", 409)
    size = row.verified_size_bytes
    if type(size) is not int or size <= 0 or size > STEP_MAX_BYTES:
        fail("asset_file_unavailable", 404)

    cache = _poster_path(row.business_id, row.locator)
    if cache.is_file():
        try:
            if cache.stat().st_size > 0:
                return cache.read_bytes(), "image/jpeg"
        except OSError:
            pass

    try:
        assert_brand_key(row.business_id, row.locator)
    except HTTPException:
        fail("asset_file_unavailable", 404)

    lock = await _poster_key_lock(str(cache))
    async with lock:
        if cache.is_file():
            try:
                if cache.stat().st_size > 0:
                    return cache.read_bytes(), "image/jpeg"
            except OSError:
                pass

        store = video_store_from_env()
        try:
            async with _POSTER_JOBS:
                try:
                    jpeg = await _generate_poster_jpeg(
                        store,
                        row.business_id,
                        row.locator,
                        size,
                        _seek_ms(row.verified_duration, row.verified_timescale),
                    )
                except ObservationFailure:
                    fail("asset_file_unavailable", 404)
                except VideoStorageError:
                    fail("asset_file_unavailable", 404)
                except HTTPException:
                    fail("asset_file_unavailable", 404)
        finally:
            await store.aclose()

        try:
            cache.parent.mkdir(parents=True, exist_ok=True)
            tmp = cache.with_suffix(cache.suffix + ".tmp")
            tmp.write_bytes(jpeg)
            tmp.replace(cache)
        except OSError:
            logger.warning("video poster cache write failed for asset %s", asset_id)
        return jpeg, "image/jpeg"
