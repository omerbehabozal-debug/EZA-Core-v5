# -*- coding: utf-8 -*-
"""Mirror Journey identity helpers — Phase 1 (flag + normalize)."""

from __future__ import annotations

import re
from typing import Optional

from backend.config import get_settings, parse_strict_env_bool
from backend.models.mirror_network import (
    ARTIFACT_KIND_JOURNEY_V1,
    ARTIFACT_KIND_LEGACY_LANDING,
)

_SLUG_SAFE = re.compile(r"[^a-z0-9-]+")

__all__ = [
    "mirror_journey_v1_enabled",
    "normalize_journey_id",
    "parse_strict_env_bool",
    "is_journey_v1_artifact",
    "is_legacy_landing_artifact",
]


def mirror_journey_v1_enabled() -> bool:
    """Feature flag: EZA_MIRROR_JOURNEY_V1 (default False — parallel, non-breaking)."""
    return bool(getattr(get_settings(), "EZA_MIRROR_JOURNEY_V1", False))


def normalize_journey_id(value: str | None) -> Optional[str]:
    """Normalize journeyId / slug: lowercase, hyphenated, max 64."""
    raw = (value or "").strip().lower()
    if not raw:
        return None
    cleaned = _SLUG_SAFE.sub("-", raw.replace("_", "-"))
    cleaned = re.sub(r"-{2,}", "-", cleaned).strip("-")
    if not cleaned:
        return None
    return cleaned[:64]


def is_journey_v1_artifact(kind: str | None) -> bool:
    return (kind or "").strip() == ARTIFACT_KIND_JOURNEY_V1


def is_legacy_landing_artifact(kind: str | None) -> bool:
    k = (kind or ARTIFACT_KIND_LEGACY_LANDING).strip()
    return k == ARTIFACT_KIND_LEGACY_LANDING or k == ""
