# -*- coding: utf-8 -*-
"""Profile avatar durable storage."""

from __future__ import annotations

import uuid
from pathlib import Path

import pytest

from backend.services.profile_avatar_store import (
    MAX_PROFILE_AVATAR_BYTES,
    build_profile_avatar_public_url,
    detect_image_mime,
    normalize_profile_avatar_bytes,
    resolve_profile_avatar_path,
    save_profile_avatar_bytes,
)


_PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
    b"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
    b"\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def test_detect_image_mime_png():
    assert detect_image_mime(_PNG_BYTES) == "image/png"


def test_normalize_profile_avatar_fits_wide_image(tmp_path, monkeypatch):
    from PIL import Image
    from io import BytesIO

    monkeypatch.setattr(
        "backend.services.profile_avatar_store.resolve_profile_avatar_dir",
        lambda: tmp_path,
    )

    wide = Image.new("RGB", (800, 400), color=(40, 120, 80))
    buf = BytesIO()
    wide.save(buf, format="JPEG")
    raw = buf.getvalue()

    normalized, mime = normalize_profile_avatar_bytes(raw, "image/jpeg")
    assert mime == "image/jpeg"
    with Image.open(BytesIO(normalized)) as saved:
        assert saved.width == saved.height == 512


def test_save_and_resolve_profile_avatar(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "backend.services.profile_avatar_store.resolve_profile_avatar_dir",
        lambda: tmp_path,
    )
    user_id = str(uuid.uuid4())
    url = save_profile_avatar_bytes(_PNG_BYTES, user_id)
    filename = Path(url.rsplit("/", 1)[-1]).name
    assert resolve_profile_avatar_path(filename) is not None
    assert build_profile_avatar_public_url(filename).endswith(filename)


def test_save_rejects_invalid_bytes(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "backend.services.profile_avatar_store.resolve_profile_avatar_dir",
        lambda: tmp_path,
    )
    with pytest.raises(ValueError, match="unsupported_avatar_format"):
        save_profile_avatar_bytes(b"not-an-image", str(uuid.uuid4()))


def test_save_rejects_oversized_bytes(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "backend.services.profile_avatar_store.resolve_profile_avatar_dir",
        lambda: tmp_path,
    )
    huge = _PNG_BYTES + (b"\x00" * (MAX_PROFILE_AVATAR_BYTES + 1))
    with pytest.raises(ValueError, match="avatar_too_large"):
        save_profile_avatar_bytes(huge, str(uuid.uuid4()))
