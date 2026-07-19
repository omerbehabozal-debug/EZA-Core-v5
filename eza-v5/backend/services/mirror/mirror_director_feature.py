# -*- coding: utf-8 -*-
"""Feature flag compatibility shim — prefer mirror_director_mode.resolve_*."""

from __future__ import annotations

from backend.services.mirror.mirror_director_mode import (
    get_mirror_director_execution_policy,
    is_mirror_director_pipeline_enabled,
    resolve_mirror_director_mode,
)

__all__ = [
    "is_mirror_director_pipeline_enabled",
    "resolve_mirror_director_mode",
    "get_mirror_director_execution_policy",
]
