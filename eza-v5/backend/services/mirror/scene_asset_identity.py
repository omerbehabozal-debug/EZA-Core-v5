# -*- coding: utf-8 -*-
"""Resolve scene asset identity from Mirror scene URLs (Phase 3.6b)."""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

# …/mirror-scene-assets/{uuid}.png or {uuid}
_ASSET_PATH_RE = re.compile(
    r"/mirror-scene-assets/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-"
    r"[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:\.[A-Za-z0-9]+)?(?:[?#]|$)"
)
_UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-"
    r"[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def resolve_scene_asset_id_from_url(scene_image_url: str | None) -> str | None:
    """Return canonical asset id (uuid without extension) or None if not a Mirror asset URL."""
    url = (scene_image_url or "").strip()
    if not url:
        return None
    match = _ASSET_PATH_RE.search(url)
    if match:
        return match.group(1).lower()
    # Bare filename path segment
    try:
        path = urlparse(url).path or ""
    except Exception:
        path = ""
    name = path.rsplit("/", 1)[-1] if path else ""
    stem = name.rsplit(".", 1)[0] if name else ""
    if _UUID_RE.match(stem):
        return stem.lower()
    if _UUID_RE.match(name):
        return name.lower()
    return None


def assert_journey_scene_url_acceptable(scene_image_url: str | None) -> str:
    """
    Journey V1 requires a persistable Mirror scene asset URL.
    Returns resolved asset id or raises ValueError with reason code.
    """
    asset_id = resolve_scene_asset_id_from_url(scene_image_url)
    if not asset_id:
        raise ValueError("scene_asset_mismatch")
    return asset_id
