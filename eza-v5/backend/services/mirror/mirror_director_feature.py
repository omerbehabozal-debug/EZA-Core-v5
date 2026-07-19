# -*- coding: utf-8 -*-
"""Feature flag for Mirror Director pipeline (PR B).

Default OFF — production create-path must not invoke orchestration.
Tests may pass force=True.
"""

from __future__ import annotations

import os

from backend.config import get_settings


def is_mirror_director_pipeline_enabled() -> bool:
    """
    Explicit enable only. Defaults False.
    Env: EZA_MIRROR_DIRECTOR_ENABLED=1|true|yes
    """
    raw = (os.getenv("EZA_MIRROR_DIRECTOR_ENABLED") or "").strip().lower()
    if raw in {"1", "true", "yes", "on"}:
        return True
    settings = get_settings()
    return bool(getattr(settings, "EZA_MIRROR_DIRECTOR_ENABLED", False))
