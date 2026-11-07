"""Suggest cover intervals from one stored video.

The model does not create a video, a cover job, or a publication. Frames are
sampled only after the proposal claim commits, and only from the stored file.
"""
import json
import os
import re
import shutil
import tempfile
from dataclasses import dataclass

from backend.services.business_yansi.cover_ai import (
    CoverAiProviderError,
    CoverAiRequest,
    CoverAiResult,
    configured_model,
    enabled,
    quote_for,
    reconcile_proposal,
    run_proposal,
)
from backend.services.business_yansi.image_observe import ObservationFailure
from backend.services.business_yansi.video_observe import (
    MAX_FRAMES,
    extract_frames,
    frame_timestamps,
    spill_video,
)

VIDEO_MODEL = "BILIGN_BUSINESS_COVER_AI_VIDEO_MODEL"
MAX_CANDIDATES = 3
_MAX_FRAME_BYTES = 2 * 1024 * 1024
_CHAT_URL = "https://api.openai.com/v1/chat/completions"
_MODEL = re.compile(r"[A-Za-z0-9_.:/-]{1,120}")
_PROMPT = (
    "Select cover intervals from the supplied video frames. Return only JSON with the key "
    "intervals. intervals is an array of objects with numeric startSeconds and endSeconds. "
    "Each interval lasts at most 20 seconds, starts at or after 0, and ends at or before the "
    "measured duration. Use only the given frames and timestamps. Do not invent a file, a brand, "
    "a price, or a publication. Do not return coverAssetId, jobId, approval, or publication fields."
)


@dataclass(frozen=True)
class VideoSnapshot:
    asset_id: str
    business_id: str
    locator: str
    size_bytes: int
    duration_ticks: int
    timescale: int
    duration_ms: int
    duration_seconds: float
    revision: int

    def payload(self) -> dict:
        return {
            "assetId": self.asset_id,
            "assetRevision": self.revision,
            "contentKey": self.locator,
            "durationTicks": self.duration_ticks,
            "timescale": self.timescale,
            "sizeBytes": self.size_bytes,
        }

    def identity(self) -> dict:
        return {
            "assetId": self.asset_id,
            "assetRevision": self.revision,
            "contentKey": self.locator,
            "durationTicks": self.duration_ticks,
            "timescale": self.timescale,
            "sizeBytes": self.size_bytes,
        }


def video_model() -> str | None:
    return configured_model()


def _number(value):
    if isinstance(value, bool) or type(value) not in {int, float}:
        return None
    number = float(value)
    if number != number or number in {float("inf"), float("-inf")}:
        return None
    return number


def validated_intervals(candidates, duration_seconds: float) -> list[dict]:
    """Keep at most three finite windows inside the measured video."""
    duration = _number(duration_seconds)
    if duration is None or duration <= 0 or not isinstance(candidates, list):
        return []
    kept = []
    for item in candidates:
        if len(kept) >= MAX_CANDIDATES:
            break
        if not isinstance(item, dict):
            continue
        start = _number(item.get("startSeconds"))
        end = _number(item.get("endSeconds"))
        if start is None or end is None:
            continue
        start = round(start, 3)
        end = round(end, 3)
        if start < 0 or end <= start or end - start > 20 or end > duration + 1e-9:
            continue
        kept.append({"startSeconds": start, "endSeconds": end})
    return kept


def accept_intervals(payload, duration_seconds: float) -> list[dict]:
    """Read structured candidates and drop anything the model is not allowed to decide."""
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError as exc:
            raise CoverAiProviderError("cover_ai_intervals_rejected") from exc
    if not isinstance(payload, dict) or not isinstance(payload.get("intervals"), list):
        raise CoverAiProviderError("cover_ai_intervals_rejected")
    return validated_intervals(payload.get("intervals"), duration_seconds)


def _stored_duration(row) -> float:
    payload = row.request_payload if isinstance(row.request_payload, dict) else {}
    ticks = payload.get("durationTicks")
    scale = payload.get("timescale")
    if isinstance(ticks, bool) or isinstance(scale, bool):
        return 0
    if type(ticks) not in {int, float} or type(scale) not in {int, float} or scale <= 0:
        return 0
    return float(ticks) / float(scale)


def _payload_identity(payload: dict) -> dict | None:
    if not isinstance(payload, dict):
        return None
    revision = payload.get("assetRevision")
    if type(revision) is not int or revision < 1:
        return None
    return {
        "assetId": str(payload.get("assetId") or ""),
        "assetRevision": revision,
        "contentKey": payload.get("contentKey"),
        "durationTicks": payload.get("durationTicks"),
        "timescale": payload.get("timescale"),
        "sizeBytes": payload.get("sizeBytes"),
    }


def source_matches(row, asset) -> bool:
    """True only when the live asset still matches the reserved identity."""
    if asset is None or getattr(asset, "status", None) == "archived":
        return False
    expected = _payload_identity(row.request_payload if isinstance(row.request_payload, dict) else {})
    if expected is None:
        return False
    try:
        live = _snapshot(asset).identity()
    except Exception:
        return False
    return live == expected


def present_suggestion(row, asset_id, *, source_current: bool = True) -> dict:
    """Public proposal view. A proposal is not a cover job."""
    status = row.status if row.status in {"reserved", "running", "succeeded", "failed", "expired"} else "failed"
    intervals = []
    if status == "succeeded" and source_current:
        try:
            intervals = accept_intervals(row.result_payload, _stored_duration(row))
        except CoverAiProviderError:
            intervals = []
    payload = row.request_payload if isinstance(row.request_payload, dict) else {}
    revision = payload.get("assetRevision") if type(payload.get("assetRevision")) is int else None
    return {
        "proposalId": str(row.id),
        "status": status,
        "assetId": str(asset_id),
        "assetRevision": revision,
        "sourceCurrent": bool(source_current),
        "intervals": intervals,
        "errorCode": row.error_code if status in {"failed", "expired"} else None,
        "costKnown": bool(getattr(row, "cost_known", False)),
        "costUsd": format(row.cost_usd, "f") if getattr(row, "cost_known", False) else None,
    }


def _snapshot(asset) -> VideoSnapshot:
    from backend.services.business_yansi.service import fail
    from backend.services.business_yansi.video_ingest import STEP_MAX_BYTES
    from backend.services.business_yansi.video_observe import duration_ms
    from backend.services.business_yansi.video_storage import assert_brand_key

    locator = asset.locator
    if asset.asset_type != "video" or asset.locator_kind != "storage" or not isinstance(locator, str):
        fail("cover_source_not_stored", 422)
    if "://" in locator or locator.lower().startswith("http") or "/staging/" in locator:
        fail("cover_source_not_stored", 422)
    if asset.status == "archived":
        fail("archived_asset", 409)
    assert_brand_key(asset.business_id, locator)
    duration = asset.verified_duration
    scale = asset.verified_timescale
    size = asset.verified_size_bytes
    revision = asset.revision
    if type(duration) is not int or type(scale) is not int or type(size) is not int:
        fail("cover_source_unmeasured", 422)
    if type(revision) is not int or revision < 1:
        fail("cover_source_unmeasured", 422)
    if duration <= 0 or scale <= 0 or size <= 0 or size > STEP_MAX_BYTES:
        fail("cover_source_unmeasured", 422)
    try:
        measured = duration_ms(asset)
    except ObservationFailure:
        fail("cover_source_unmeasured", 422)
    seconds = duration / scale
    if seconds <= 0 or seconds != seconds or seconds in {float("inf"), float("-inf")}:
        fail("cover_source_unmeasured", 422)
    return VideoSnapshot(
        asset_id=str(asset.id),
        business_id=str(asset.business_id),
        locator=locator,
        size_bytes=size,
        duration_ticks=duration,
        timescale=scale,
        duration_ms=measured,
        duration_seconds=seconds,
        revision=revision,
    )


def _guard_frames(frames) -> None:
    if not isinstance(frames, list) or not frames or len(frames) > MAX_FRAMES:
        raise CoverAiProviderError("cover_ai_frames_rejected")
    seen = set()
    total = 0
    for item in frames:
        if not isinstance(item, tuple) or len(item) != 2:
            raise CoverAiProviderError("cover_ai_frames_rejected")
        stamp, blob = item
        if type(stamp) is not int or stamp < 0 or stamp in seen:
            raise CoverAiProviderError("cover_ai_frames_rejected")
        if not isinstance(blob, (bytes, bytearray)) or not blob or len(blob) > _MAX_FRAME_BYTES:
            raise CoverAiProviderError("cover_ai_frames_rejected")
        seen.add(stamp)
        total += len(blob)
    if total > _MAX_FRAME_BYTES * MAX_FRAMES:
        raise CoverAiProviderError("cover_ai_frames_rejected")


def _observation_code(exc: ObservationFailure) -> str:
    code = getattr(exc, "code", "")
    if code in {"observation_not_stored", "observation_source_missing"}:
        return "cover_source_not_stored"
    if code == "observation_video_rejected":
        return "cover_ai_frames_rejected"
    if code == "observation_frames_unavailable":
        return "cover_ai_frames_unavailable"
    return "cover_ai_provider_failed"


def interval_request(frames: list[tuple[int, bytes]], duration_seconds: float, model: str, max_output_tokens: int) -> dict:
    """JPEG data URLs and their timestamps. The source file is not attached."""
    import base64

    content = [{
        "type": "text",
        "text": (
            f"Measured duration seconds: {duration_seconds:.3f}. "
            "Timestamps are milliseconds: " + ", ".join(str(stamp) for stamp, _image in frames)
        ),
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
        "max_tokens": max_output_tokens,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": _PROMPT},
            {"role": "user", "content": content},
        ],
    }


async def post_chat(payload: dict, *, dispatch=None) -> dict:
    """One chat completion. Marks paid dispatch only as the HTTP request starts."""
    import httpx

    from backend.config import get_settings
    from backend.core.openai.config import build_openai_request_headers
    from backend.services.business_yansi.cover_ai import credentials_ready

    settings = get_settings()
    key = (getattr(settings, "OPENAI_API_KEY", None) or "").strip()
    # Never reread MODEL_ENV here; the reserved model is already on the payload.
    if not key or not credentials_ready():
        raise CoverAiProviderError("cover_ai_provider_not_configured")
    model = payload.get("model") if isinstance(payload, dict) else None
    if not isinstance(model, str) or not _MODEL.fullmatch(model):
        raise CoverAiProviderError("cover_ai_provider_not_configured")
    headers = build_openai_request_headers(key)
    if dispatch is not None:
        dispatch.mark_dispatched()
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=5.0)) as client:
            response = await client.post(_CHAT_URL, headers=headers, json=payload)
    except httpx.HTTPError:
        raise CoverAiProviderError("cover_ai_provider_failed") from None
    if response.status_code >= 400:
        raise CoverAiProviderError("cover_ai_provider_failed")
    try:
        data = response.json()
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, ValueError):
        raise CoverAiProviderError("cover_ai_intervals_rejected") from None
    if not isinstance(content, str) or not content.strip():
        raise CoverAiProviderError("cover_ai_intervals_rejected")
    usage = data.get("usage") if isinstance(data, dict) else None
    return {"content": content, "usage": usage if isinstance(usage, dict) else None}


def _usage_usd(usage, spec) -> object:
    if not isinstance(usage, dict) or spec is None:
        return None
    try:
        prompt = int(usage.get("prompt_tokens"))
        completion = int(usage.get("completion_tokens"))
    except (TypeError, ValueError):
        return None
    if prompt < 0 or completion < 0:
        return None
    from decimal import Decimal, ROUND_UP

    money = Decimal("0.00000001")
    return (
        (Decimal(prompt) / Decimal(1000)) * spec.input_usd_per_1k
        + (Decimal(completion) / Decimal(1000)) * spec.output_usd_per_1k
    ).quantize(money, rounding=ROUND_UP)


async def interpret_intervals(frames, duration_seconds: float, *, request: CoverAiRequest) -> CoverAiResult:
    """Use the reserved execution spec only. Never reread the model environment."""
    spec = request.spec
    if spec is None or not spec.model:
        raise CoverAiProviderError("cover_ai_provider_not_configured")
    if len(frames) > spec.max_frames:
        raise CoverAiProviderError("cover_ai_frames_rejected")
    raw = await post_chat(
        interval_request(frames, duration_seconds, spec.model, spec.max_output_tokens),
        dispatch=request.dispatch,
    )
    try:
        data = json.loads(raw["content"])
    except (TypeError, json.JSONDecodeError) as exc:
        raise CoverAiProviderError("cover_ai_intervals_rejected") from exc
    if not isinstance(data, dict):
        raise CoverAiProviderError("cover_ai_intervals_rejected")
    return CoverAiResult(payload=data, model=spec.model, usage_usd=_usage_usd(raw.get("usage"), spec))


class SamplingProvider:
    """Extract a bounded frame set, then ask the interpreter for intervals.

    Frame extraction is local work. Paid dispatch happens only inside interpret → post_chat.
    """

    def __init__(self, snapshot: VideoSnapshot, *, materialize, extract, interpret):
        self.snapshot = snapshot
        self.materialize = materialize
        self.extract = extract
        self.interpret = interpret

    async def complete(self, request: CoverAiRequest) -> CoverAiResult:
        if request.kind != "video_intervals":
            raise CoverAiProviderError("cover_ai_kind_rejected")
        directory = tempfile.mkdtemp(prefix="bilign-cover-ai-")
        path = os.path.join(directory, "source.mp4")
        try:
            try:
                await self.materialize(path)
                stamps = frame_timestamps(self.snapshot.duration_ms)
                frames = await self.extract(path, stamps)
            except ObservationFailure as exc:
                raise CoverAiProviderError(_observation_code(exc)) from None
            _guard_frames(frames)
            if len(frames) > request.spec.max_frames:
                raise CoverAiProviderError("cover_ai_frames_rejected")
            result = await self.interpret(frames, self.snapshot.duration_seconds, request=request)
        finally:
            shutil.rmtree(directory, ignore_errors=True)
        if isinstance(result, CoverAiResult):
            return result
        if not isinstance(result, dict):
            raise CoverAiProviderError("cover_ai_intervals_rejected")
        return CoverAiResult(payload=result, model=request.spec.model)


class _ValidatedProvider:
    def __init__(self, inner, duration_seconds: float):
        self.inner = inner
        self.duration_seconds = duration_seconds

    async def complete(self, request: CoverAiRequest) -> CoverAiResult:
        result = await self.inner.complete(request)
        if not isinstance(result, CoverAiResult):
            raise CoverAiProviderError("cover_ai_provider_failed")
        intervals = accept_intervals(result.payload, self.duration_seconds)
        return CoverAiResult(
            payload={"intervals": intervals},
            model=result.model,
            usage_usd=result.usage_usd,
        )


def _default_materialize(snapshot: VideoSnapshot):
    from backend.services.business_yansi.video_storage import video_store_from_env

    async def materialize(dest: str) -> None:
        store = video_store_from_env()
        try:
            await spill_video(store, snapshot.business_id, snapshot.locator, dest, snapshot.size_bytes)
        finally:
            await store.aclose()

    return materialize


async def _require_default_backend():
    from fastapi import HTTPException

    from backend.services.business_yansi.service import fail
    from backend.services.business_yansi.video_storage import video_store_from_env

    # Fail closed on pricing/model before any storage or provider work.
    quote_for("video_intervals")
    probe = video_store_from_env()
    try:
        await probe.aclose()
    except HTTPException:
        raise
    except Exception:
        fail("video_storage_unconfigured", 503)


async def suggest_video_intervals(db, business_id, actor_id, asset_id, idempotency_key, *, provider=None):
    """Reserve one video-interval proposal. The provider runs outside the transaction."""
    from fastapi import HTTPException

    from backend.services.business_yansi.brand_asset_library import _asset_row
    from backend.services.business_yansi.service import access, fail

    if not enabled():
        fail("cover_ai_disabled", 403)
    try:
        await access(db, business_id, actor_id, "editor")
        asset = await _asset_row(db, business_id, asset_id)
        snapshot = _snapshot(asset)
        if provider is None:
            await _require_default_backend()

            async def interpret(frames, duration_seconds, *, request):
                return await interpret_intervals(frames, duration_seconds, request=request)

            provider = SamplingProvider(
                snapshot,
                materialize=_default_materialize(snapshot),
                extract=extract_frames,
                interpret=interpret,
            )
        else:
            # Injected providers still pass reservation gates inside run_proposal.
            quote_for("video_intervals")
        chosen = _ValidatedProvider(provider, snapshot.duration_seconds)
    except HTTPException:
        await db.rollback()
        raise
    row = await run_proposal(
        db,
        business_id,
        actor_id,
        kind="video_intervals",
        idempotency_key=idempotency_key,
        payload=snapshot.payload(),
        provider=chosen,
    )
    if row is None:
        fail("cover_suggestion_not_found", 404)
    return row


async def read_cover_suggestion(db, business_id, actor_id, asset_id, proposal_id):
    from backend.models.business_cover_ai import BusinessCoverAiProposal as Proposal
    from backend.services.business_yansi.brand_asset_library import _asset_row
    from backend.services.business_yansi.service import access, fail, uid

    await access(db, business_id, actor_id, "viewer")
    row = await db.get(Proposal, uid(proposal_id))
    owner = uid(business_id)
    if row is None or row.business_id != owner or row.kind != "video_intervals":
        fail("cover_suggestion_not_found", 404)
    row = await reconcile_proposal(db, row)
    payload = row.request_payload if isinstance(row.request_payload, dict) else {}
    try:
        stored_asset = uid(payload.get("assetId"))
    except HTTPException:
        fail("cover_suggestion_not_found", 404)
    if stored_asset != uid(asset_id):
        fail("cover_suggestion_not_found", 404)
    try:
        asset = await _asset_row(db, business_id, asset_id)
        current = source_matches(row, asset)
    except HTTPException:
        current = False
    return present_suggestion(row, asset_id, source_current=current)
