# -*- coding: utf-8 -*-
"""Brand library image prepare / size limits (separate from profile avatars)."""

from __future__ import annotations

from io import BytesIO

import pytest
from PIL import Image

from backend.services.business_yansi import brand_asset_library as library
from backend.services.profile_avatar_store import MAX_PROFILE_AVATAR_BYTES


_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
    b"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
    b"\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def test_library_limit_is_independent_of_avatar_limit():
    assert library.MAX_BRAND_LIBRARY_IMAGE_BYTES == 15 * 1024 * 1024
    assert library.MAX_BRAND_LIBRARY_IMAGE_BYTES > MAX_PROFILE_AVATAR_BYTES


def test_prepare_rejects_oversized_raw_upload():
    huge = _PNG + (b"\x00" * (library.MAX_BRAND_LIBRARY_IMAGE_BYTES + 1))
    with pytest.raises(Exception) as raised:
        library.prepare_brand_library_image(huge)
    assert raised.value.status_code == 400
    assert raised.value.detail["code"] == "asset_file_too_large"


def test_prepare_normalizes_large_rgb_jpeg_under_edge_cap():
    buf = BytesIO()
    Image.new("RGB", (5000, 3000), color=(20, 80, 120)).save(buf, format="JPEG", quality=95)
    raw = buf.getvalue()
    assert len(raw) < library.MAX_BRAND_LIBRARY_IMAGE_BYTES
    prepared = library.prepare_brand_library_image(raw)
    assert prepared
    assert len(prepared) < len(raw)
    with Image.open(BytesIO(prepared)) as out:
        assert max(out.size) <= 4096


def test_prepare_rejects_corrupt_payload():
    with pytest.raises(Exception) as raised:
        library.prepare_brand_library_image(b"\x89PNG\r\n\x1a\n" + b"\x00" * 24)
    assert raised.value.status_code == 400
    assert raised.value.detail["code"] == "asset_file_rejected"


def test_prepare_preserves_png_alpha():
    img = Image.new("RGBA", (32, 32), (255, 0, 0, 0))
    for y in range(32):
        for x in range(16):
            img.putpixel((x, y), (0, 128, 255, 200))
    buf = BytesIO()
    img.save(buf, format="PNG")
    prepared = library.prepare_brand_library_image(buf.getvalue())
    with Image.open(BytesIO(prepared)) as out:
        assert out.mode == "RGBA"
        assert out.getpixel((0, 0))[3] == 200
        assert out.getpixel((24, 0))[3] == 0


def test_prepare_applies_exif_orientation_and_strips_tag():
    img = Image.new("RGB", (200, 100), (10, 20, 30))
    exif = Image.Exif()
    exif[274] = 6
    buf = BytesIO()
    img.save(buf, format="JPEG", exif=exif, quality=90)
    prepared = library.prepare_brand_library_image(buf.getvalue())
    with Image.open(BytesIO(prepared)) as out:
        assert out.size == (100, 200)
        assert 274 not in out.getexif()
