# -*- coding: utf-8 -*-
"""Persist mirror scene images as durable public HTTP(S) assets."""

from __future__ import annotations

import base64
import binascii
import logging
import re
import uuid
from pathlib import Path

from backend.config import get_settings

logger = logging.getLogger(__name__)

MAX_SCENE_ASSET_BYTES = 8 * 1024 * 1024
_ASSET_FILENAME_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpe?g|webp)$",
    re.IGNORECASE,
)
_DATA_URL_RE = re.compile(
    r"^data:image/(?P<fmt>png|jpe?g|webp);base64,(?P<payload>[A-Za-z0-9+/=\s]+)$",
    re.IGNORECASE,
)

_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
_JPEG_MAGIC = b"\xff\xd8\xff"


def _mime_to_extension(mime: str) -> str:
    if mime == "image/png":
        return ".png"
    if mime == "image/jpeg":
        return ".jpg"
    if mime == "image/webp":
        return ".webp"
    raise ValueError(f"unsupported mime: {mime}")


def detect_image_mime(data: bytes) -> str | None:
    if data.startswith(_PNG_MAGIC):
        return "image/png"
    if data.startswith(_JPEG_MAGIC):
        return "image/jpeg"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def parse_mirror_scene_data_url(data_url: str) -> bytes | None:
    raw = (data_url or "").strip()
    match = _DATA_URL_RE.match(raw)
    if not match:
        return None
    payload = re.sub(r"\s+", "", match.group("payload"))
    try:
        decoded = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError):
        return None
    if not decoded or len(decoded) > MAX_SCENE_ASSET_BYTES:
        return None
    if detect_image_mime(decoded) is None:
        return None
    return decoded


def resolve_mirror_scene_asset_dir() -> Path:
    settings = get_settings()
    configured = (getattr(settings, "EZA_MIRROR_SCENE_ASSET_DIR", None) or "").strip()
    if configured:
        return Path(configured)
    backend_dir = Path(__file__).resolve().parents[2]
    return backend_dir / "data" / "mirror_scene_assets"


def build_mirror_scene_asset_public_url(filename: str) -> str:
    settings = get_settings()
    base = (
        (getattr(settings, "EZA_MIRROR_SCENE_ASSET_BASE_URL", None) or "").strip()
        or (getattr(settings, "LOADTEST_BASE_URL", None) or "").strip()
        or "http://localhost:8000"
    ).rstrip("/")
    safe_name = Path(filename).name
    return f"{base}/api/public/mirror-scene-assets/{safe_name}"


def save_mirror_scene_bytes(image_bytes: bytes) -> str:
    mime = detect_image_mime(image_bytes)
    if mime is None:
        raise ValueError("unsupported_scene_image_format")
    if len(image_bytes) > MAX_SCENE_ASSET_BYTES:
        raise ValueError("scene_image_too_large")

    ext = _mime_to_extension(mime)
    filename = f"{uuid.uuid4()}{ext}"
    asset_dir = resolve_mirror_scene_asset_dir()
    asset_dir.mkdir(parents=True, exist_ok=True)
    target = asset_dir / filename
    target.write_bytes(image_bytes)
    public_url = build_mirror_scene_asset_public_url(filename)
    logger.info("mirror_scene_asset_saved filename=%s bytes=%d", filename, len(image_bytes))
    return public_url


def save_mirror_scene_data_url(data_url: str) -> str | None:
    image_bytes = parse_mirror_scene_data_url(data_url)
    if image_bytes is None:
        return None
    try:
        return save_mirror_scene_bytes(image_bytes)
    except ValueError:
        return None


def ensure_persistable_mirror_scene_url(raw: str | None) -> str | None:
    """
    Return a durable HTTP(S) scene URL.

    - https/http URLs pass through unchanged
    - data:image/*;base64 URLs are stored and replaced with a public asset URL
    - blob: and other schemes are rejected
    """
    value = (raw or "").strip()
    if not value:
        return None
    lower = value.lower()
    if lower.startswith(("http://", "https://")):
        return value
    if lower.startswith("data:"):
        return save_mirror_scene_data_url(value)
    return None


def resolve_mirror_scene_asset_path(filename: str) -> Path | None:
    safe_name = Path(filename).name
    if not _ASSET_FILENAME_RE.match(safe_name):
        return None
    asset_dir = resolve_mirror_scene_asset_dir()
    candidate = (asset_dir / safe_name).resolve()
    try:
        candidate.relative_to(asset_dir.resolve())
    except ValueError:
        return None
    if not candidate.is_file():
        return None
    return candidate
