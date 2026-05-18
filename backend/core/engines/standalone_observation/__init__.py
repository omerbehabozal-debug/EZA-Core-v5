# -*- coding: utf-8 -*-
"""Standalone lightweight observation layer (rule-based, no LLM)."""

from backend.core.engines.standalone_observation.service import (
    attach_standalone_observation_to_response,
    is_standalone_observation_enabled,
    maybe_build_standalone_observation,
    safe_event_metadata,
)

__all__ = [
    "attach_standalone_observation_to_response",
    "is_standalone_observation_enabled",
    "maybe_build_standalone_observation",
    "safe_event_metadata",
]
