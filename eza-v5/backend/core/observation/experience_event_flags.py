# -*- coding: utf-8 -*-
"""EZA Observation — feature flag helpers."""

from __future__ import annotations

from backend.config import get_settings


def is_experience_event_logging_enabled() -> bool:
    """True only when EXPERIENCE_EVENT_LOGGING_ENABLED is explicitly enabled."""
    return bool(get_settings().EXPERIENCE_EVENT_LOGGING_ENABLED)
