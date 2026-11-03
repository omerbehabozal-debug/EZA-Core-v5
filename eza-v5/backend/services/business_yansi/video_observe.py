"""One vision call for a stored video, using local JPEG frames.

The original file is never attached to the request. A silent derivative does
not get its own call: its cover window can use only frames already stored for
the original. When those frames do not cover the window's own duration bucket,
the window stays undescribed. This module does not extract more frames and
does not make a second provider call.
"""
import asyncio
import json
import logging
import os
import shutil
import tempfile

from fastapi import HTTPException
from sqlalchemy import select

from backend.models.business_media_observations import BusinessMediaObservation as Observation
from backend.services.business_yansi.image_observe import (
    ObservationFailure,
    _content,
    _usage,
    default_completer,
    parse_visual_observation,
    resize_for_vision,
    vision_model,
)

logger = logging.getLogger(__name__)

MAX_FRAMES = 4
_FRAME_TIMEOUT = 10
_MAX_FRAME_BYTES = 2 * 1024 * 1024
_PROMPT = (
    "Describe stored video frames for a private library. Return only JSON with keys "
    "summary, tags, visibleText, and frames. summary is one Turkish sentence of at most "
    "400 characters about what is visible across the frames. tags is an array of 1 to 12 "
    "short Turkish phrases, each at most 32 characters. visibleText is text readable in "
    "the frames, or null. frames has one object per given timestamp, with timestampMs, "
    "note, and tags. note is one Turkish phrase of at most 160 characters. tags on a "
    "frame has at most 4 short phrases. Use only the given timestamps. Do not invent a "
    "brand, price, address, certification, or product claim."
)


def frame_timestamps(duration_ms: int) -> list[int]:
    """Sample inside the measured duration. The result never exceeds four stamps."""
    if type(duration_ms) is not int or duration_ms <= 0 or duration_ms > 86_400_000:
        raise ObservationFailure("observation_video_rejected", retryable=False)
    if duration_ms < 4_000:
        ratios = ((1, 2),)
    elif duration_ms < 12_000:
        ratios = ((30, 100), (70, 100))
    else:
        ratios = ((12, 100), (37, 100), (62, 100), (87, 100))
    stamps = []
    for numerator, denominator in ratios:
        stamp = (duration_ms * numerator) // denominator
        if stamp >= duration_ms:
            stamp = duration_ms - 1
        if stamp < 0:
            stamp = 0
        if stamp not in stamps:
            stamps.append(stamp)
        if len(stamps) >= MAX_FRAMES:
            break
    if not stamps:
        raise ObservationFailure("observation_video_rejected", retryable=False)
    return stamps


def duration_ms(asset) -> int:
    duration = getattr(asset, "verified_duration", None)
    scale = getattr(asset, "verified_timescale", None)
    if type(duration) is not int or type(scale) is not int or scale <= 0 or duration <= 0:
        raise ObservationFailure("observation_video_rejected", retryable=False)
    if duration > 2**31 or scale > 2**31:
        raise ObservationFailure("observation_video_rejected", retryable=False)
    measured = (duration * 1000) // scale
    frame_timestamps(measured)
    return measured


def span_evidence(frames, start_ms: int, end_ms: int) -> dict:
    """Frames that already fall inside a cover window.

    The whole-video summary is not an argument and cannot be returned. The
    window is sufficient only when it contains at least as many stored frames
    as its own duration bucket requires. Otherwise summary stays empty and the
    partial frames are withheld, so they are not treated as a description of
    the unseen seconds. No frame is extracted here and no provider is called.
    A later explicit request would need its own observation key; this phase
    does not enqueue one.
    """
    empty = {"sufficient": False, "required": 0, "observed": 0, "summary": None, "timestamps": [], "frames": []}
    if type(start_ms) is not int or type(end_ms) is not int or start_ms < 0 or end_ms <= start_ms:
        return empty
    try:
        required = len(frame_timestamps(end_ms - start_ms))
    except ObservationFailure:
        return empty
    included = []
    for frame in frames or []:
        stamp = frame.timestamp_ms if hasattr(frame, "timestamp_ms") else frame.get("timestampMs", frame.get("timestamp_ms"))
        if type(stamp) is not int or stamp < start_ms or stamp >= end_ms:
            continue
        note = frame.note if hasattr(frame, "note") else frame.get("note")
        tags = frame.tags if hasattr(frame, "tags") else frame.get("tags")
        included.append({"timestamp_ms": stamp, "note": note, "tags": list(tags or [])})
    included.sort(key=lambda item: item["timestamp_ms"])
    sufficient = len(included) >= required
    return {
        "sufficient": sufficient,
        "required": required,
        "observed": len(included),
        "summary": None,
        "timestamps": [item["timestamp_ms"] for item in included],
        "frames": included if sufficient else [],
    }


def _tags(value, limit: int) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list) or len(value) > limit:
        raise ObservationFailure("observation_output_invalid", retryable=True)
    cleaned = []
    for tag in value:
        if not isinstance(tag, str):
            raise ObservationFailure("observation_output_invalid", retryable=True)
        text = " ".join(tag.split())
        if not text or len(text) > 32:
            raise ObservationFailure("observation_output_invalid", retryable=True)
        cleaned.append(text)
    return cleaned


def parse_video_observation(raw, expected: list[int]) -> dict:
    """Accept the image fields plus one note for every sampled timestamp."""
    if isinstance(raw, str):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ObservationFailure("observation_output_invalid", retryable=True) from exc
    else:
        data = raw
    if not isinstance(data, dict) or set(data) - {"summary", "tags", "visibleText", "frames"}:
        raise ObservationFailure("observation_output_invalid", retryable=True)
    if "frames" not in data or not isinstance(data.get("frames"), list):
        raise ObservationFailure("observation_output_invalid", retryable=True)
    visual = parse_visual_observation({key: data[key] for key in ("summary", "tags") if key in data} | (
        {"visibleText": data["visibleText"]} if "visibleText" in data else {}
    ))
    found = []
    seen = set()
    for item in data["frames"]:
        if not isinstance(item, dict) or set(item) - {"timestampMs", "note", "tags"} or "timestampMs" not in item or "note" not in item:
            raise ObservationFailure("observation_output_invalid", retryable=True)
        stamp = item["timestampMs"]
        note = item["note"]
        if type(stamp) is not int or stamp not in expected or stamp in seen or not isinstance(note, str):
            raise ObservationFailure("observation_output_invalid", retryable=True)
        note = " ".join(note.split())
        if not note or len(note) > 160:
            raise ObservationFailure("observation_output_invalid", retryable=True)
        seen.add(stamp)
        found.append({"timestamp_ms": stamp, "note": note, "tags": _tags(item.get("tags"), 4)})
    if seen != set(expected):
        raise ObservationFailure("observation_output_invalid", retryable=True)
    found.sort(key=lambda item: item["timestamp_ms"])
    visual["frames"] = found
    return visual


def video_request(frames: list[tuple[int, bytes]], model: str) -> dict:
    """JPEG data URLs only. The source file is not part of the payload."""
    import base64

    content = [{
        "type": "text",
        "text": "Zaman damgaları milisaniyedir: " + ", ".join(str(stamp) for stamp, _image in frames),
    }]
    for stamp, image in frames:
        encoded = base64.b64encode(image).decode("ascii")
        content.append({"type": "text", "text": str(stamp)})
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{encoded}", "detail": "low"},
        })
    return {
        "model": model,
        "temperature": 0,
        "max_tokens": 800,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": _PROMPT},
            {"role": "user", "content": content},
        ],
    }


async def _grab(binary: str, source: str, stamp: int, dest: str) -> None:
    process = await asyncio.create_subprocess_exec(
        binary,
        "-hide_banner",
        "-nostdin",
        "-y",
        "-i",
        source,
        "-ss",
        f"{stamp / 1000:.3f}",
        "-frames:v",
        "1",
        "-q:v",
        "5",
        dest,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
        stdin=asyncio.subprocess.DEVNULL,
    )
    from backend.services.business_yansi.video_mp4 import _kill_and_reap, _reap_cancelled

    try:
        code = await asyncio.wait_for(process.wait(), _FRAME_TIMEOUT)
    except TimeoutError:
        await _kill_and_reap(process)
        raise ObservationFailure("observation_frames_unavailable", retryable=True)
    except asyncio.CancelledError:
        await _reap_cancelled(process)
        raise
    if code != 0 or not os.path.isfile(dest):
        raise ObservationFailure("observation_frames_unavailable", retryable=True)


async def extract_frames(path: str, timestamps_ms: list[int]) -> list[tuple[int, bytes]]:
    """Write at most four JPEGs beside the source, then delete them."""
    if len(timestamps_ms) < 1 or len(timestamps_ms) > MAX_FRAMES or len(set(timestamps_ms)) != len(timestamps_ms):
        raise ObservationFailure("observation_video_rejected", retryable=False)
    from backend.services.business_yansi.video_mp4 import _tool_path

    try:
        binary = _tool_path("EZA_BUSINESS_VIDEO_FFMPEG", "ffmpeg")
    except HTTPException as exc:
        raise ObservationFailure("observation_frames_unavailable", retryable=False) from exc
    directory = tempfile.mkdtemp(prefix="bilign-frames-")
    produced = []
    try:
        for index, stamp in enumerate(timestamps_ms):
            dest = os.path.join(directory, f"{index}.jpg")
            await _grab(binary, path, stamp, dest)
            with open(dest, "rb") as handle:
                raw = handle.read()
            if len(raw) > _MAX_FRAME_BYTES:
                raise ObservationFailure("observation_video_rejected", retryable=False)
            try:
                jpeg, _mime = resize_for_vision(raw)
            except ObservationFailure as exc:
                raise ObservationFailure("observation_video_rejected", retryable=False) from exc
            produced.append((stamp, jpeg))
        return produced
    finally:
        shutil.rmtree(directory, ignore_errors=True)


async def spill_video(store, business_id, locator: str, dest: str, size: int) -> None:
    """Copy one brand object to a temp file. Remote URLs are refused."""
    from backend.services.business_yansi.video_ingest import STEP_MAX_BYTES
    from backend.services.business_yansi.video_storage import VideoStorageError, assert_brand_key

    if type(size) is not int or size <= 0 or size > STEP_MAX_BYTES:
        raise ObservationFailure("observation_video_rejected", retryable=False)
    if not isinstance(locator, str) or "://" in locator or locator.lower().startswith("http") or "/staging/" in locator:
        raise ObservationFailure("observation_not_stored", retryable=False)
    try:
        assert_brand_key(business_id, locator)
        stat = await store.head(locator)
    except HTTPException as exc:
        raise ObservationFailure("observation_not_stored", retryable=False) from exc
    except VideoStorageError as exc:
        raise ObservationFailure("observation_source_missing", retryable=False) from exc
    if stat is None or stat.size != size:
        raise ObservationFailure("observation_source_missing", retryable=False)
    written = 0
    try:
        with open(dest, "wb") as handle:
            reader = getattr(store, "read_chunks", None)
            if reader is not None:
                async for chunk in reader(locator, size):
                    written += len(chunk)
                    if written > size:
                        raise ObservationFailure("observation_source_missing", retryable=False)
                    handle.write(chunk)
            else:
                offset = 0
                while offset < size:
                    end = min(size - 1, offset + 65536 - 1)
                    piece = await store.get_range(locator, offset, end)
                    written += len(piece)
                    if written > size:
                        raise ObservationFailure("observation_source_missing", retryable=False)
                    handle.write(piece)
                    offset += len(piece)
    except VideoStorageError as exc:
        raise ObservationFailure("observation_source_missing", retryable=False) from exc
    if written != size:
        raise ObservationFailure("observation_source_missing", retryable=False)


def _stored_video(locator) -> bool:
    return isinstance(locator, str) and "://" not in locator and not locator.lower().startswith("http") and "/staging/" not in locator


async def _fail(db, held, code: str, *, retryable: bool):
    from backend.services.business_yansi.media_observations import fail_owned

    logger.info("video_observation_failed code=%s", code)
    await fail_owned(db, held, code, retryable=retryable)
    if db.in_transaction():
        await db.commit()


async def analyze_video_claim(db, held, *, completer=None, materialize=None, extract=None):
    """Describe one original video from local frames. A derivative is not sent.

    Preflight and finalization use short transactions. Spill, ffmpeg, and the
    provider call run with no open database transaction. Finalization reloads
    the asset from the database before storing frames.
    """
    from backend.services.business_yansi.media_observations import (
        asset_matches,
        complete_owned,
        current_asset,
        digest_path,
        finish_authorized,
        note_changed_source,
        owned_observation,
        transaction_idle,
    )

    _job_id, token, business_id = held
    if not token:
        return None
    job = await owned_observation(db, held)
    if job is None:
        return None
    asset = await current_asset(db, job.asset_id, job.business_id)
    if asset is None:
        await _fail(db, held, "observation_source_missing", retryable=False)
        return None
    locator = getattr(asset, "locator", None)
    if (
        asset.asset_type != "video"
        or asset.locator_kind != "storage"
        or asset.source_asset_id is not None
        or not _stored_video(locator)
    ):
        await _fail(db, held, "observation_not_stored", retryable=False)
        return None
    try:
        stamps = frame_timestamps(duration_ms(asset))
        size = asset.verified_size_bytes
        if type(size) is not int:
            raise ObservationFailure("observation_video_rejected", retryable=False)
    except ObservationFailure as exc:
        await _fail(db, held, exc.code, retryable=exc.retryable)
        return None
    expected = job.content_sha256
    created_by = job.created_by
    asset_id = job.asset_id
    await db.commit()
    handle = tempfile.NamedTemporaryFile(prefix="bilign-video-", suffix=".bin", delete=False)
    path = handle.name
    handle.close()
    call = completer or default_completer
    grab = extract or extract_frames
    copy = materialize
    if copy is None:
        async def copy(owner, key, dest, expected_size):
            from backend.services.business_yansi.video_storage import video_store_from_env

            store = video_store_from_env()
            try:
                await spill_video(store, owner, key, dest, expected_size)
            finally:
                await store.aclose()

    try:
        try:
            await copy(business_id, locator, path, size)
            actual = digest_path(path)
            if actual != expected:
                raise ObservationFailure("observation_source_stale", retryable=False)
            if not transaction_idle(db):
                raise ObservationFailure("observation_analysis_failed", retryable=True)
            produced = grab(path, stamps)
            if asyncio.iscoroutine(produced):
                produced = await produced
            if [stamp for stamp, _image in produced] != stamps:
                raise ObservationFailure("observation_frames_unavailable", retryable=True)
            if not transaction_idle(db):
                raise ObservationFailure("observation_analysis_failed", retryable=True)
            payload = await call(video_request(produced, vision_model() or "unconfigured"))
            if not transaction_idle(db):
                raise ObservationFailure("observation_analysis_failed", retryable=True)
            parsed = parse_video_observation(_content(payload), stamps)
            actual = digest_path(path)
        except ObservationFailure as exc:
            if exc.code == "observation_source_stale":
                async def stale():
                    fresh = await current_asset(db, asset_id, business_id)
                    return await note_changed_source(db, held, fresh, created_by, actual)

                await finish_authorized(db, held, business_id, created_by, stale)
                return None
            await _fail(db, held, exc.code, retryable=exc.retryable)
            return None
        except Exception:
            await _fail(db, held, "observation_analysis_failed", retryable=True)
            return None
        provider_model, prompt_tokens, completion_tokens = _usage(payload)

        async def write():
            fresh = await current_asset(db, asset_id, business_id)
            if not asset_matches(fresh, business_id, asset_id, expected, actual):
                return await note_changed_source(db, held, fresh, created_by, actual)
            return await complete_owned(
                db, held,
                summary=parsed["summary"], tags=parsed["tags"], visible_text=parsed["visible_text"],
                provider_model=provider_model, input_tokens=prompt_tokens, output_tokens=completion_tokens,
                frames=parsed["frames"],
            )

        return await finish_authorized(db, held, business_id, created_by, write)
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


async def analyze_media_claim(db, held, *, completer=None, reader=None, materialize=None, extract=None):
    """Keep the image path, and describe an original stored video from frames."""
    from backend.services.business_yansi.image_observe import analyze_image_claim
    from backend.services.business_yansi.media_observations import current_asset

    job_id, _token, business_id = held
    job = await db.scalar(
        select(Observation).where(Observation.id == job_id, Observation.business_id == business_id)
    )
    asset = None if job is None else await current_asset(db, job.asset_id, job.business_id)
    if asset is not None and asset.asset_type == "video":
        return await analyze_video_claim(
            db, held, completer=completer, materialize=materialize, extract=extract,
        )
    return await analyze_image_claim(db, held, completer=completer, reader=reader)
