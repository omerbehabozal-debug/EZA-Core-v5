"""Build a silent H.264 cover without rewriting the original.

The window comes from the job. first_span is the first 20 seconds. A later
strategy can replace segment_seconds and leave the encoder, the size check,
and the storage path alone. An unverified file is never copied to a final key.
"""
from __future__ import annotations

import asyncio
import hashlib
import os
import tempfile
import uuid

from fastapi import HTTPException

from backend.models.business_brand_assets import BusinessBrandAsset as Asset
from backend.services.business_yansi.brand_asset_library import _apply_fields
from backend.services.business_yansi.brand_assets import normalize_asset
from backend.services.business_yansi.service import uid
from backend.services.business_yansi.video_ingest import COVER_MAX_BYTES, COVER_MAX_SECONDS
from backend.services.business_yansi.video_mp4 import Mp4Source, _tool_path, inspect_mp4
from backend.services.business_yansi.video_storage import (
    MemoryVideoStore,
    VideoObjectImmutable,
    VideoStorageError,
    assert_brand_key,
    staging_object_key,
    video_object_key,
)

ENCODE_TIMEOUT_SECONDS = 60
_READ = 64 * 1024


class CoverEncodeError(Exception):
    def __init__(self, code: str, *, retryable: bool = False):
        super().__init__(code)
        self.code = code
        self.retryable = retryable


def segment_seconds(strategy: str, start_ticks: int, end_ticks: int, timescale: int) -> tuple[float, float]:
    """Turn the stored window into seconds. This is the replaceable strategy."""
    from backend.services.business_yansi.cover_jobs import SPAN_STRATEGIES

    if strategy not in SPAN_STRATEGIES:
        raise CoverEncodeError("cover_strategy_unavailable")
    if type(start_ticks) is not int or type(end_ticks) is not int or type(timescale) is not int:
        raise CoverEncodeError("cover_derivative_rejected")
    if timescale <= 0 or end_ticks <= start_ticks:
        raise CoverEncodeError("cover_derivative_rejected")
    start = start_ticks / timescale
    duration = (end_ticks - start_ticks) / timescale
    if start < 0 or duration <= 0 or duration > COVER_MAX_SECONDS:
        raise CoverEncodeError("cover_derivative_rejected")
    return start, duration


def fit_bitrate(duration_seconds: float) -> int:
    """One lower target that fits under the cover byte limit with some headroom."""
    seconds = duration_seconds if duration_seconds > 0 else 1.0
    return max(64_000, int((COVER_MAX_BYTES * 8 * 0.75) / seconds))


async def encode_window(source_path: str, dest_path: str, *, start: float, duration: float, bitrate: int | None = None) -> None:
    """Write a silent H.264 clip. The source file is opened read-only by ffmpeg."""
    try:
        binary = _tool_path("EZA_BUSINESS_VIDEO_FFMPEG", "ffmpeg")
    except HTTPException as exc:
        raise CoverEncodeError("video_probe_unavailable") from exc
    args = [
        binary,
        "-hide_banner",
        "-nostdin",
        "-y",
        "-ss",
        f"{start:.3f}",
        "-i",
        source_path,
        "-t",
        f"{duration:.3f}",
        "-map",
        "0:v:0",
        "-an",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-preset",
        "veryfast",
        "-movflags",
        "+faststart",
    ]
    if bitrate is None:
        args.extend(["-crf", "28"])
    else:
        rate = str(int(bitrate))
        args.extend(["-b:v", rate, "-maxrate", rate, "-bufsize", str(int(bitrate) * 2)])
    args.append(dest_path)
    process = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
        stdin=asyncio.subprocess.DEVNULL,
    )
    try:
        code = await asyncio.wait_for(process.wait(), ENCODE_TIMEOUT_SECONDS)
    except TimeoutError:
        if process.returncode is None:
            process.kill()
        await process.wait()
        raise CoverEncodeError("cover_encode_timeout", retryable=True)
    if code != 0:
        raise CoverEncodeError("cover_encode_failed", retryable=True)


async def render_cover(store, source, job) -> tuple[bytes, object]:
    """Encode the job window, retry bitrate once, and inspect before any final copy."""
    if getattr(source, "locator_kind", None) != "storage" or not source.locator or "/staging/" in source.locator:
        raise CoverEncodeError("cover_source_not_stored")
    if str(source.locator).startswith("http://") or str(source.locator).startswith("https://"):
        raise CoverEncodeError("cover_source_not_stored")
    stat = await store.head(source.locator)
    recorded = getattr(source, "verified_size_bytes", None)
    if stat is None or type(recorded) is not int or stat.size != recorded:
        raise CoverEncodeError("cover_source_missing")
    if not str(source.locator).endswith(f"/{stat.sha256}.mp4"):
        raise CoverEncodeError("cover_derivative_rejected")
    start, duration = segment_seconds(job.strategy, job.start_ticks, job.end_ticks, source.verified_timescale)
    spilled = _temp_path()
    produced: list[str] = []
    try:
        await _spill(store, source.locator, stat.size, spilled)
        first = _temp_path()
        produced.append(first)
        await encode_window(spilled, first, start=start, duration=duration, bitrate=None)
        data = _small_enough(first)
        if data is None:
            second = _temp_path()
            produced.append(second)
            await encode_window(spilled, second, start=start, duration=duration, bitrate=fit_bitrate(duration))
            data = _small_enough(second)
            if data is None:
                raise CoverEncodeError("cover_derivative_too_large")
        info = await _inspect(data)
        if info.has_audio or info.duration > COVER_MAX_SECONDS * info.timescale or len(data) > COVER_MAX_BYTES:
            raise CoverEncodeError("cover_derivative_rejected")
        return data, info
    finally:
        _unlink(spilled)
        for path in produced:
            _unlink(path)


async def store_cover(db, store, source, user_id, data: bytes, info) -> Asset:
    """Copy a verified derivative to an immutable key and link it to the original.

    Staging is removed. The original key and the final key are not deleted.
    """
    if info.has_audio or len(data) > COVER_MAX_BYTES or len(data) <= 0:
        raise CoverEncodeError("cover_derivative_rejected")
    staging = staging_object_key(source.business_id, uuid.uuid4())
    assert_brand_key(source.business_id, staging)
    published = False
    final = None
    try:
        stat = await store.write_stream(staging, _once(data))
        if stat.size != len(data) or stat.sha256 != hashlib.sha256(data).hexdigest():
            raise CoverEncodeError("video_storage_failed", retryable=True)
        final = video_object_key(source.business_id, stat.sha256)
        assert_brand_key(source.business_id, final)
        if final == source.locator:
            raise CoverEncodeError("cover_derivative_rejected")
        try:
            await store.copy_if_absent(staging, final, stat.sha256, size=stat.size)
        except VideoObjectImmutable as exc:
            raise CoverEncodeError("video_object_immutable", retryable=False) from exc
        except VideoStorageError as exc:
            raise CoverEncodeError("video_storage_failed", retryable=True) from exc
        confirmed = await store.head(final)
        if confirmed is None or confirmed.size != stat.size or confirmed.sha256 != stat.sha256:
            raise CoverEncodeError("video_storage_failed", retryable=True)
        published = True
    except VideoStorageError as exc:
        raise CoverEncodeError("video_storage_failed", retryable=True) from exc
    finally:
        if "/staging/" in staging and staging != source.locator and staging != final:
            try:
                await store.delete(staging)
            except Exception:
                pass
    if not published or final is None:
        raise CoverEncodeError("video_storage_failed", retryable=True)
    row = Asset(business_id=uid(source.business_id), created_by=uid(user_id), revision=1)
    fields = normalize_asset(
        business_id=source.business_id,
        asset_type="video",
        title=source.title,
        caption=source.caption,
        locator_kind="storage",
        locator=final,
    )
    _apply_fields(row, fields, user_id, bool(source.public_allowed))
    row.verified_duration = info.duration
    row.verified_timescale = info.timescale
    row.verified_size_bytes = len(data)
    row.verified_has_audio = False
    row.source_asset_id = source.id
    db.add(row)
    await db.flush()
    return row


async def _inspect(data: bytes):
    digest = hashlib.sha256(data).hexdigest()
    local = MemoryVideoStore()
    local.objects["inspect"] = (data, digest)
    try:
        info = await inspect_mp4(Mp4Source(local, "inspect", len(data)), max_seconds=COVER_MAX_SECONDS)
    except HTTPException as exc:
        raise CoverEncodeError("cover_derivative_rejected") from exc
    if info.has_audio:
        raise CoverEncodeError("cover_derivative_rejected")
    return info


def _small_enough(path: str) -> bytes | None:
    size = os.path.getsize(path)
    if size <= 0:
        raise CoverEncodeError("cover_derivative_rejected")
    if size > COVER_MAX_BYTES:
        return None
    with open(path, "rb") as handle:
        return handle.read()


def _temp_path() -> str:
    handle, path = tempfile.mkstemp(prefix="bilign-cover-", suffix=".mp4")
    os.close(handle)
    return path


def _unlink(path: str) -> None:
    for _attempt in range(8):
        try:
            os.remove(path)
            return
        except FileNotFoundError:
            return
        except OSError:
            continue


async def _spill(store, key: str, size: int, dest: str) -> None:
    reader = getattr(store, "read_chunks", None)
    written = 0
    with open(dest, "wb") as handle:
        if reader is not None:
            async for chunk in reader(key, size):
                written += len(chunk)
                if written > size:
                    raise CoverEncodeError("cover_source_missing")
                handle.write(chunk)
        else:
            offset = 0
            while offset < size:
                end = min(size - 1, offset + _READ - 1)
                piece = await store.get_range(key, offset, end)
                written += len(piece)
                if written > size:
                    raise CoverEncodeError("cover_source_missing")
                handle.write(piece)
                offset += len(piece)
    if written != size:
        raise CoverEncodeError("cover_source_missing")


async def _once(data: bytes):
    yield data
