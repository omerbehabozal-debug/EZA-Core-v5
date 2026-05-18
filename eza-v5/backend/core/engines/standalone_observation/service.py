# -*- coding: utf-8 -*-
"""
Standalone observation service — optional, feature-flagged, never blocks pipeline.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from backend.config import get_settings
from backend.core.engines.standalone_observation.tagger import build_observation
from backend.core.engines.standalone_observation.types import observation_to_dict

logger = logging.getLogger(__name__)


def is_standalone_observation_enabled() -> bool:
    try:
        return bool(get_settings().STANDALONE_OBSERVATION_ENABLED)
    except Exception:
        return False


def safe_event_metadata(observation: Dict[str, Any]) -> Dict[str, Any]:
    """
    Strip observation for eza_events metadata — no raw user/assistant text.
    """
    out: Dict[str, Any] = {}
    for key in ("user_pattern", "ai_behavior", "relationship_balance"):
        block = observation.get(key)
        if not isinstance(block, dict):
            continue
        out[key] = {
            "category": block.get("category"),
            "confidence": block.get("confidence"),
            "signals": list(block.get("signals") or [])[:8],
        }
    out["observation_quality"] = observation.get("observation_quality")
    out["can_interpret"] = observation.get("can_interpret")
    return out


def maybe_build_standalone_observation(
    *,
    user_text: str,
    output_text: str,
    input_analysis: Optional[Dict[str, Any]] = None,
    output_analysis: Optional[Dict[str, Any]] = None,
    alignment: Optional[Dict[str, Any]] = None,
    redirect: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """Build observation dict or None. Never raises."""
    if not is_standalone_observation_enabled():
        return None
    try:
        obs = build_observation(
            user_text=user_text or "",
            output_text=output_text or "",
            input_analysis=input_analysis if isinstance(input_analysis, dict) else {},
            output_analysis=output_analysis if isinstance(output_analysis, dict) else {},
            alignment=alignment if isinstance(alignment, dict) else {},
            redirect=redirect if isinstance(redirect, dict) else None,
        )
        return observation_to_dict(obs)
    except Exception as exc:
        logger.debug("standalone_observation skipped: %s", exc)
        return None


def attach_standalone_observation_to_response(
    response: Dict[str, Any],
    *,
    user_text: str,
    output_text: str,
    input_analysis: Optional[Dict[str, Any]] = None,
    output_analysis: Optional[Dict[str, Any]] = None,
    alignment: Optional[Dict[str, Any]] = None,
    redirect: Optional[Dict[str, Any]] = None,
) -> None:
    """Mutate response in place when flag enabled. Never raises."""
    try:
        obs = maybe_build_standalone_observation(
            user_text=user_text,
            output_text=output_text,
            input_analysis=input_analysis,
            output_analysis=output_analysis,
            alignment=alignment,
            redirect=redirect,
        )
        if obs is not None:
            response["standalone_observation"] = obs
    except Exception as exc:
        logger.debug("attach_standalone_observation failed: %s", exc)
