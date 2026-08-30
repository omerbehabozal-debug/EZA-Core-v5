# -*- coding: utf-8 -*-
"""Persist user profile avatar images as durable public HTTP assets."""

from __future__ import annotations

import logging
import re
import uuid
from pathlib import Path

from backend.config import get_settings

logger = logging.getLogger(__name__)

MAX_PROFILE_AVATAR_BYTES = 2 * 1024 * 1024
_AVATAR_FILENAME_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpe?g|webp)$",
    re.IGNORECASE,
)

_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
_JPEG_MAGIC = b"\xff\xd8\xff"


def detect_image_mime(data: bytes) -> str | None:
    if data.startswith(_PNG_MAGIC):
        return "image/png"
    if data.startswith(_JPEG_MAGIC):
        return "image/jpeg"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def _mime_to_extension(mime: str) -> str:
    if mime == "image/png":
        return ".png"
    if mime == "image/jpeg":
        return ".jpg"
    if mime == "image/webp":
        return ".webp"
    raise ValueError(f"unsupported mime: {mime}")


def resolve_profile_avatar_dir() -> Path:
    settings = get_settings()
    configured = (getattr(settings, "EZA_PROFILE_AVATAR_DIR", None) or "").strip()
    if configured:
        return Path(configured)
    backend_dir = Path(__file__).resolve().parents[1]
    return backend_dir / "data" / "profile_avatars"


def user_id_from_avatar_filename(filename: str) -> str | None:
    safe_name = Path(filename).name
    if not _AVATAR_FILENAME_RE.match(safe_name):
        return None
    stem = safe_name.rsplit(".", 1)[0]
    try:
        return str(uuid.UUID(stem))
    except ValueError:
        return None


_PROFILE_AVATAR_PUBLIC_PREFIX = "/api/public/profile-avatars/"


def build_profile_avatar_public_url(filename: str) -> str:
    """Environment-agnostic canonical locator persisted in production_users."""
    safe_name = Path(filename).name
    return f"{_PROFILE_AVATAR_PUBLIC_PREFIX}{safe_name}"


def normalize_profile_avatar_public_locator(url_or_path: str | None) -> str | None:
    """Normalize legacy absolute avatar URLs to canonical /api/public/profile-avatars/{file}."""
    if url_or_path is None:
        return None
    raw = str(url_or_path).strip()
    if not raw:
        return None

    path_only = raw.split("?", 1)[0]
    if path_only.startswith(_PROFILE_AVATAR_PUBLIC_PREFIX):
        filename = Path(path_only).name
        if _AVATAR_FILENAME_RE.match(filename):
            return f"{_PROFILE_AVATAR_PUBLIC_PREFIX}{filename}"
        return raw

    from urllib.parse import urlparse

    parsed = urlparse(raw if "://" in raw else f"http://local{raw}")
    pathname = parsed.path or ""
    if not pathname.startswith(_PROFILE_AVATAR_PUBLIC_PREFIX):
        return raw

    filename = Path(pathname).name
    if not _AVATAR_FILENAME_RE.match(filename):
        return raw
    return f"{_PROFILE_AVATAR_PUBLIC_PREFIX}{filename}"


def resolve_profile_avatar_path(filename: str) -> Path | None:
    safe_name = Path(filename).name
    if not _AVATAR_FILENAME_RE.match(safe_name):
        return None
    path = resolve_profile_avatar_dir() / safe_name
    if not path.is_file():
        return None
    return path


def profile_avatar_response_headers(media_type: str, *, etag: str | None = None) -> dict[str, str]:
    headers: dict[str, str] = {
        "Cache-Control": "private, max-age=0, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "Content-Type": media_type,
    }
    if etag:
        headers["ETag"] = etag
    return headers


def normalize_profile_avatar_bytes(image_bytes: bytes, mime: str) -> tuple[bytes, str]:
    """Center-crop to square and resize so circular avatars fill the frame."""
    from io import BytesIO

    from PIL import Image, ImageOps

    with Image.open(BytesIO(image_bytes)) as raw:
        img = ImageOps.exif_transpose(raw)
        if img.mode not in ("RGB", "RGBA"):
            has_alpha = img.mode in ("RGBA", "LA") or (
                img.mode == "P" and "transparency" in img.info
            )
            img = img.convert("RGBA" if has_alpha else "RGB")

        max_edge = 512
        width, height = img.size
        side = min(width, height)
        left = (width - side) // 2
        top = (height - side) // 2
        cropped = img.crop((left, top, left + side, top + side))
        if cropped.width != max_edge:
            cropped = cropped.resize((max_edge, max_edge), Image.Resampling.LANCZOS)

        out = BytesIO()
        if mime == "image/png":
            cropped.save(out, format="PNG", optimize=True)
            return out.getvalue(), "image/png"
        if mime == "image/webp":
            cropped.save(out, format="WEBP", quality=88, method=4)
            return out.getvalue(), "image/webp"
        if cropped.mode == "RGBA":
            cropped = cropped.convert("RGB")
        cropped.save(out, format="JPEG", quality=88, optimize=True)
        return out.getvalue(), "image/jpeg"


def save_profile_avatar_bytes(image_bytes: bytes, user_id: str) -> tuple[str, bytes, str]:
    mime = detect_image_mime(image_bytes)
    if mime is None:
        raise ValueError("unsupported_avatar_format")
    if len(image_bytes) > MAX_PROFILE_AVATAR_BYTES:
        raise ValueError("avatar_too_large")

    normalized_bytes, normalized_mime = normalize_profile_avatar_bytes(image_bytes, mime)
    if len(normalized_bytes) > MAX_PROFILE_AVATAR_BYTES:
        raise ValueError("avatar_too_large")

    ext = _mime_to_extension(normalized_mime)
    filename = f"{uuid.UUID(str(user_id))}{ext}"
    asset_dir = resolve_profile_avatar_dir()
    asset_dir.mkdir(parents=True, exist_ok=True)

    # Remove prior variants for this user (extension change).
    uid = str(uuid.UUID(str(user_id)))
    for existing in asset_dir.glob(f"{uid}.*"):
        if existing.is_file():
            try:
                existing.unlink()
            except OSError:
                logger.warning("profile_avatar_cleanup_failed filename=%s", existing.name)

    target = asset_dir / filename
    try:
        target.write_bytes(normalized_bytes)
    except OSError:
        logger.warning("profile_avatar_disk_write_failed user_id=%s", uid)

    public_url = build_profile_avatar_public_url(filename)
    logger.info(
        "profile_avatar_saved user_id=%s bytes=%d normalized=%d",
        uid,
        len(image_bytes),
        len(normalized_bytes),
    )
    return public_url, normalized_bytes, normalized_mime


def delete_profile_avatar_files(user_id: str) -> None:
    uid = str(uuid.UUID(str(user_id)))
    asset_dir = resolve_profile_avatar_dir()
    if not asset_dir.is_dir():
        return
    for existing in asset_dir.glob(f"{uid}.*"):
        if existing.is_file():
            try:
                existing.unlink()
            except OSError:
                logger.warning("profile_avatar_delete_failed filename=%s", existing.name)
