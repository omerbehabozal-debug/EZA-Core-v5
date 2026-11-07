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
    user_id_from_avatar_filename,
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


def test_user_id_from_avatar_filename():
    uid = str(uuid.uuid4())
    assert user_id_from_avatar_filename(f"{uid}.jpg") == uid
    assert user_id_from_avatar_filename("bad-name.jpg") is None


def test_save_and_resolve_profile_avatar(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "backend.services.profile_avatar_store.resolve_profile_avatar_dir",
        lambda: tmp_path,
    )
    user_id = str(uuid.uuid4())
    url, normalized, mime = save_profile_avatar_bytes(_PNG_BYTES, user_id)
    filename = Path(url.rsplit("/", 1)[-1]).name
    assert url == f"/api/public/profile-avatars/{filename}"
    assert resolve_profile_avatar_path(filename) is not None
    assert build_profile_avatar_public_url(filename) == f"/api/public/profile-avatars/{filename}"


def test_normalize_profile_avatar_public_locator_legacy_absolute():
    from backend.services.profile_avatar_store import normalize_profile_avatar_public_locator

    uid = str(uuid.uuid4())
    filename = f"{uid}.jpg"
    canonical = f"/api/public/profile-avatars/{filename}"
    assert (
        normalize_profile_avatar_public_locator(
            f"http://localhost:8000/api/public/profile-avatars/{filename}"
        )
        == canonical
    )
    assert (
        normalize_profile_avatar_public_locator(
            f"https://api.ezacore.ai/api/public/profile-avatars/{filename}"
        )
        == canonical
    )
    assert normalize_profile_avatar_public_locator(canonical) == canonical
    assert (
        normalize_profile_avatar_public_locator("https://cdn.example.com/other.jpg")
        == "https://cdn.example.com/other.jpg"
    )


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


def test_resolve_profile_avatar_dir_prefers_persistent_data_mount(tmp_path, monkeypatch):
    from backend.services import profile_avatar_store as store

    data_root = tmp_path / "data"
    data_root.mkdir()
    monkeypatch.setattr(store, "get_settings", lambda: type("S", (), {"EZA_PROFILE_AVATAR_DIR": None})())
    monkeypatch.setattr(store, "_persistent_data_root", lambda: data_root)
    assert store.resolve_profile_avatar_dir() == data_root / "profile_avatars"


def test_resolve_profile_avatar_dir_honors_explicit_env(tmp_path, monkeypatch):
    from backend.services import profile_avatar_store as store

    configured = tmp_path / "configured_avatars"
    monkeypatch.setattr(
        store,
        "get_settings",
        lambda: type("S", (), {"EZA_PROFILE_AVATAR_DIR": str(configured)})(),
    )
    monkeypatch.setattr(store, "_persistent_data_root", lambda: tmp_path / "ignored")
    assert store.resolve_profile_avatar_dir() == configured


def test_save_fails_closed_when_disk_write_fails(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "backend.services.profile_avatar_store.resolve_profile_avatar_dir",
        lambda: tmp_path,
    )
    original = Path.write_bytes

    def failing_write(self, data):
        if self.parent == tmp_path:
            raise OSError("disk full")
        return original(self, data)

    monkeypatch.setattr(Path, "write_bytes", failing_write)
    with pytest.raises(ValueError, match="avatar_storage_unavailable"):
        save_profile_avatar_bytes(_PNG_BYTES, str(uuid.uuid4()))
    assert list(tmp_path.glob("*")) == []


def test_brand_logo_bytes_survive_resolved_persistent_dir(tmp_path, monkeypatch):
    """Brand logos reuse the profile-avatar pipeline; persistence is the dir choice."""
    persistent = tmp_path / "volume" / "profile_avatars"
    monkeypatch.setattr(
        "backend.services.profile_avatar_store.resolve_profile_avatar_dir",
        lambda: persistent,
    )
    business_id = str(uuid.uuid4())
    url, _, _ = save_profile_avatar_bytes(_PNG_BYTES, business_id)
    filename = url.rsplit("/", 1)[-1]
    assert (persistent / filename).is_file()
    assert resolve_profile_avatar_path(filename) == persistent / filename


def test_resolve_reads_legacy_ephemeral_dir_as_fallback(tmp_path, monkeypatch):
    from backend.services import profile_avatar_store as store

    persistent = tmp_path / "data" / "profile_avatars"
    legacy = tmp_path / "legacy" / "profile_avatars"
    persistent.mkdir(parents=True)
    legacy.mkdir(parents=True)
    uid = str(uuid.uuid4())
    filename = f"{uid}.png"
    (legacy / filename).write_bytes(_PNG_BYTES)
    monkeypatch.setattr(store, "resolve_profile_avatar_dir", lambda: persistent)
    monkeypatch.setattr(store, "_legacy_profile_avatar_dir", lambda: legacy)
    assert resolve_profile_avatar_path(filename) == legacy / filename
