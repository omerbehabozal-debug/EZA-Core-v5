"""One vision call for a stored image. The result is not brand knowledge.

The model name comes from BILIGN_BUSINESS_VISION_MODEL. No model is assumed,
and this module does not record a price. Usage numbers are stored only when
the provider returns them.
"""
import base64
import io
import json
import logging
import os

import httpx
from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError
from PIL.Image import DecompressionBombError
from sqlalchemy import select

from backend.models.business_brand_assets import BusinessBrandAsset as Asset
from backend.models.business_media_observations import BusinessMediaObservation as Observation
from backend.services.business_yansi.media_observations import timeout_seconds, vision_model

logger = logging.getLogger(__name__)

CHAT_URL = "https://api.openai.com/v1/chat/completions"
_PROMPT = (
    "Describe one stored image for a private library. Return only JSON with keys "
    "summary, tags, and visibleText. summary is one Turkish sentence of at most "
    "400 characters about what is visible. tags is an array of 1 to 12 short "
    "Turkish phrases, each at most 32 characters. visibleText is text readable "
    "in the image, or null. Do not invent a brand, price, address, certification, "
    "or product claim."
)
_ALLOWED = {"summary", "tags", "visibleText"}
_MAX_EDGE = 512
_MAX_PIXELS = 16_777_216


class ObservationFailure(Exception):
    def __init__(self, code: str, *, retryable: bool):
        super().__init__(code)
        self.code = code
        self.retryable = retryable


def timeout_limit() -> float:
    return timeout_seconds()


def credentials_ready() -> bool:
    """A configured model still needs a key before the worker claims a job."""
    if not vision_model():
        return False
    from backend.config import get_settings

    settings = get_settings()
    key = (getattr(settings, "OPENAI_API_KEY", None) or os.getenv("OPENAI_API_KEY") or "").strip()
    return bool(key)


def resize_for_vision(data: bytes) -> tuple[bytes, str]:
    """Fit the long edge to 512px. The original file is not rewritten.

    Dimensions are rejected before the pixels are decoded. A decompression
    bomb is a bad source, not a reason to retry the provider.
    """
    try:
        image = Image.open(io.BytesIO(data))
        width, height = image.size
        if width < 1 or height < 1 or width * height > _MAX_PIXELS:
            raise ObservationFailure("observation_image_rejected", retryable=False)
        image.load()
    except ObservationFailure:
        raise
    except (UnidentifiedImageError, DecompressionBombError, OSError, ValueError) as exc:
        raise ObservationFailure("observation_image_rejected", retryable=False) from exc
    if image.format not in {"JPEG", "PNG", "WEBP"}:
        raise ObservationFailure("observation_image_rejected", retryable=False)
    if image.mode not in {"RGB", "L"}:
        image = image.convert("RGB")
    image.thumbnail((_MAX_EDGE, _MAX_EDGE), Image.Resampling.LANCZOS)
    if max(image.size) > _MAX_EDGE or min(image.size) <= 0:
        raise ObservationFailure("observation_image_rejected", retryable=False)
    out = io.BytesIO()
    image.save(out, format="JPEG", quality=80)
    return out.getvalue(), "image/jpeg"


def parse_visual_observation(raw) -> dict:
    """Accept only the three declared fields, inside the column limits."""
    if isinstance(raw, str):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ObservationFailure("observation_output_invalid", retryable=True) from exc
    else:
        data = raw
    if not isinstance(data, dict) or set(data) - _ALLOWED or "summary" not in data or "tags" not in data:
        raise ObservationFailure("observation_output_invalid", retryable=True)
    summary = data.get("summary")
    tags = data.get("tags")
    if not isinstance(summary, str) or not isinstance(tags, list):
        raise ObservationFailure("observation_output_invalid", retryable=True)
    summary = summary.strip()
    if not summary or len(summary) > 400:
        raise ObservationFailure("observation_output_invalid", retryable=True)
    cleaned = []
    for tag in tags:
        if not isinstance(tag, str):
            raise ObservationFailure("observation_output_invalid", retryable=True)
        text = " ".join(tag.split())
        if not text or len(text) > 32:
            raise ObservationFailure("observation_output_invalid", retryable=True)
        cleaned.append(text)
    if not cleaned or len(cleaned) > 12:
        raise ObservationFailure("observation_output_invalid", retryable=True)
    visible = data.get("visibleText") if "visibleText" in data else None
    if visible is not None:
        if not isinstance(visible, str):
            raise ObservationFailure("observation_output_invalid", retryable=True)
        visible = visible.strip()
        if not visible:
            visible = None
        elif len(visible) > 200:
            raise ObservationFailure("observation_output_invalid", retryable=True)
    return {"summary": summary, "tags": cleaned, "visible_text": visible}


def _usage(payload) -> tuple[str | None, int | None, int | None]:
    if not isinstance(payload, dict):
        return None, None, None
    model = payload.get("model")
    model = model.strip()[:64] if isinstance(model, str) and model.strip() else None
    usage = payload.get("usage") if isinstance(payload.get("usage"), dict) else {}

    def number(name):
        value = usage.get(name)
        if type(value) is int and 0 <= value <= 1_000_000_000:
            return value
        return None

    return model, number("prompt_tokens"), number("completion_tokens")


def _content(payload) -> str:
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ObservationFailure("observation_output_invalid", retryable=True) from exc
    if not isinstance(content, str) or not content.strip():
        raise ObservationFailure("observation_output_invalid", retryable=True)
    return content


def vision_request(image: bytes, mime: str, model: str) -> dict:
    encoded = base64.b64encode(image).decode("ascii")
    return {
        "model": model,
        "temperature": 0,
        "max_tokens": 300,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": _PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Bu görselde ne görünüyor?"},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{encoded}", "detail": "low"}},
                ],
            },
        ],
    }


async def default_completer(payload: dict) -> dict:
    from backend.config import get_settings
    from backend.core.openai.config import build_openai_request_headers

    settings = get_settings()
    key = (getattr(settings, "OPENAI_API_KEY", None) or "").strip()
    if not key or not vision_model():
        raise ObservationFailure("observation_provider_unconfigured", retryable=False)
    headers = build_openai_request_headers(key)
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds()) as client:
            response = await client.post(CHAT_URL, headers=headers, json=payload)
    except httpx.TimeoutException as exc:
        raise ObservationFailure("observation_provider_timeout", retryable=True) from exc
    if response.status_code in {401, 403}:
        raise ObservationFailure("observation_provider_unconfigured", retryable=False)
    if response.status_code == 400:
        raise ObservationFailure("observation_provider_refused", retryable=False)
    if response.status_code == 429 or response.status_code >= 500:
        raise ObservationFailure("observation_provider_unavailable", retryable=True)
    if response.status_code >= 400:
        raise ObservationFailure("observation_provider_unavailable", retryable=False)
    try:
        data = response.json()
    except ValueError as exc:
        raise ObservationFailure("observation_output_invalid", retryable=True) from exc
    if not isinstance(data, dict):
        raise ObservationFailure("observation_output_invalid", retryable=True)
    return data


async def _fail(db, held, code: str, *, retryable: bool):
    from backend.services.business_yansi.media_observations import fail_owned

    logger.info("image_observation_failed code=%s", code)
    await fail_owned(db, held, code, retryable=retryable)


async def analyze_image_claim(db, held, *, completer=None, reader=None):
    """Describe the claimed image. A wrong token, a video, or a URL changes nothing useful.

    held is (observation id, claim token, business id). Bytes are hashed before
    the provider call and again before the result is stored. The database
    transaction is committed before that file read and the provider call.
    """
    from backend.services.business_yansi.brand_asset_library import read_stored_image
    from backend.services.business_yansi.media_observations import (
        complete_owned,
        digest_bytes,
        finish_authorized,
        note_changed_source,
        owned_observation,
        provenance_ok,
    )

    job_id, token, business_id = held
    if not token:
        return None
    job = await owned_observation(db, held)
    if job is None:
        return None
    asset = await db.scalar(
        select(Asset).where(Asset.id == job.asset_id, Asset.business_id == job.business_id)
    )
    if asset is None:
        await _fail(db, held, "observation_source_missing", retryable=False)
        return None
    locator = getattr(asset, "locator", None)
    if asset.asset_type != "image" or asset.locator_kind != "storage" or not isinstance(locator, str) or "://" in locator:
        await _fail(db, held, "observation_not_stored", retryable=False)
        return None
    expected = job.content_sha256
    created_by = job.created_by
    asset_id = job.asset_id
    await db.commit()
    read = reader or read_stored_image

    def load():
        return read(business_id, locator)

    try:
        data, _mime = load()
        actual = digest_bytes(data)
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {}
        code = "observation_source_missing" if detail.get("code") == "asset_file_unavailable" else "observation_image_rejected"
        await _fail(db, held, code, retryable=False)
        return None
    asset = await db.scalar(select(Asset).where(Asset.id == asset_id, Asset.business_id == business_id))
    if not provenance_ok(expected, asset, actual):
        await finish_authorized(
            db, held, business_id, created_by,
            lambda: note_changed_source(db, held, asset, created_by, actual),
        )
        return None
    try:
        prepared, mime = resize_for_vision(data)
    except ObservationFailure as exc:
        await _fail(db, held, exc.code, retryable=exc.retryable)
        return None
    call = completer or default_completer
    model = vision_model() or "unconfigured"
    try:
        payload = await call(vision_request(prepared, mime, model))
        parsed = parse_visual_observation(_content(payload))
        again, _mime = load()
        actual = digest_bytes(again)
    except ObservationFailure as exc:
        await _fail(db, held, exc.code, retryable=exc.retryable)
        return None
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {}
        code = "observation_source_missing" if detail.get("code") == "asset_file_unavailable" else "observation_image_rejected"
        await _fail(db, held, code, retryable=False)
        return None
    except Exception:
        await _fail(db, held, "observation_analysis_failed", retryable=True)
        return None
    asset = await db.scalar(select(Asset).where(Asset.id == asset_id, Asset.business_id == business_id))
    if not provenance_ok(expected, asset, actual):
        await finish_authorized(
            db, held, business_id, created_by,
            lambda: note_changed_source(db, held, asset, created_by, actual),
        )
        return None
    provider_model, prompt_tokens, completion_tokens = _usage(payload)

    async def write():
        fresh = await db.scalar(select(Asset).where(Asset.id == asset_id, Asset.business_id == business_id))
        if not provenance_ok(expected, fresh, actual):
            return await note_changed_source(db, held, fresh, created_by, actual)
        return await complete_owned(
            db, held,
            summary=parsed["summary"], tags=parsed["tags"], visible_text=parsed["visible_text"],
            provider_model=provider_model, input_tokens=prompt_tokens, output_tokens=completion_tokens,
        )

    return await finish_authorized(db, held, business_id, created_by, write)
