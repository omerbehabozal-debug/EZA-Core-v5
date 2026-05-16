# -*- coding: utf-8 -*-
"""
Optional non-blocking Universal Event logging hooks for the core pipeline.

Does not alter pipeline responses or safety decisions.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, Optional

from backend.config import get_settings
from backend.core.events.event_logger import log_eza_event
from backend.core.events.event_normalizer import (
    normalize_standalone_event,
    normalize_proxy_event,
    normalize_proxy_lite_event,
)

logger = logging.getLogger(__name__)


def _is_event_logging_enabled() -> bool:
    return bool(get_settings().EZA_EVENT_LOGGING_ENABLED)


def build_governance_meta(event_id: Optional[str] = None) -> Dict[str, Any]:
    """Governance visibility block for API responses (no raw content)."""
    enabled = _is_event_logging_enabled()
    return {
        "event_id": str(event_id) if (enabled and event_id) else None,
        "event_logging_enabled": enabled,
    }


def _resolve_context(event_context: Optional[Dict[str, Any]], mode: str) -> Dict[str, str]:
    """Build user/session/org ids for event logging (no raw content)."""
    ctx = event_context or {}
    session_id = ctx.get("session_id") or str(uuid.uuid4())
    user_id = ctx.get("user_id") or "anonymous"
    out: Dict[str, str] = {
        "user_id": str(user_id),
        "session_id": str(session_id),
    }
    if ctx.get("org_id"):
        out["org_id"] = str(ctx["org_id"])
    if ctx.get("analysis_id"):
        out["analysis_id"] = str(ctx["analysis_id"])
    if ctx.get("case_id"):
        out["case_id"] = str(ctx["case_id"])
    if ctx.get("regulation_scope"):
        out["regulation_scope"] = str(ctx["regulation_scope"])
    return out


async def _hook_standalone(
    db_session: Any,
    pipeline_result: Dict[str, Any],
    event_context: Optional[Dict[str, Any]],
) -> Optional[str]:
    ctx = _resolve_context(event_context, "standalone")
    behavioral = pipeline_result.get("behavioral")
    event = normalize_standalone_event(
        user_id=ctx["user_id"],
        session_id=ctx["session_id"],
        org_id=ctx.get("org_id"),
        pipeline_result=pipeline_result,
        behavioral_snapshot=behavioral,
        case_snapshot=behavioral,
    )
    return await log_eza_event(db_session, event)


async def _hook_proxy(
    db_session: Any,
    pipeline_result: Dict[str, Any],
    event_context: Optional[Dict[str, Any]],
) -> Optional[str]:
    ctx = _resolve_context(event_context, "proxy")
    behavioral = pipeline_result.get("behavioral")
    event = normalize_proxy_event(
        user_id=ctx["user_id"],
        session_id=ctx["session_id"],
        org_id=ctx.get("org_id"),
        analysis_id=ctx.get("analysis_id"),
        case_id=ctx.get("case_id"),
        pipeline_result=pipeline_result,
        behavioral_snapshot=behavioral,
        regulation_scope=ctx.get("regulation_scope", "none"),
        case_snapshot=behavioral,
    )
    return await log_eza_event(db_session, event)


async def _hook_proxy_lite(
    db_session: Any,
    pipeline_result: Dict[str, Any],
    event_context: Optional[Dict[str, Any]],
) -> Optional[str]:
    ctx = _resolve_context(event_context, "proxy-lite")
    behavioral = pipeline_result.get("behavioral")
    event = normalize_proxy_lite_event(
        user_id=ctx["user_id"],
        session_id=ctx["session_id"],
        org_id=ctx.get("org_id"),
        case_id=ctx.get("case_id"),
        pipeline_result=pipeline_result,
        behavioral_snapshot=behavioral,
        regulation_scope=ctx.get("regulation_scope", "none"),
        case_snapshot=behavioral,
    )
    return await log_eza_event(db_session, event)


async def maybe_log_pipeline_event(
    db_session: Any,
    mode: str,
    pipeline_result: Dict[str, Any],
    event_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Optionally persist a universal event after pipeline completion.

    Returns governance meta (event_id, event_logging_enabled). Never raises.
    """
    if not _is_event_logging_enabled():
        return build_governance_meta(None)
    if db_session is None:
        return build_governance_meta(None)
    if not pipeline_result or not isinstance(pipeline_result, dict):
        return build_governance_meta(None)

    try:
        event_id: Optional[str] = None
        if mode == "standalone":
            event_id = await _hook_standalone(db_session, pipeline_result, event_context)
        elif mode == "proxy":
            event_id = await _hook_proxy(db_session, pipeline_result, event_context)
        elif mode == "proxy-lite":
            event_id = await _hook_proxy_lite(db_session, pipeline_result, event_context)
        else:
            logger.debug("maybe_log_pipeline_event: unsupported mode %s", mode)
        return build_governance_meta(event_id)
    except Exception as exc:
        logger.warning("Universal event pipeline hook failed (non-blocking): %s", exc)
        return build_governance_meta(None)


def _risk_level_from_input_analysis(input_analysis: Optional[Dict[str, Any]]) -> str:
    if not input_analysis:
        return "low"
    level = str(input_analysis.get("risk_level") or "low").lower()
    if level in ("low", "medium", "high", "critical"):
        return level
    risk = float(input_analysis.get("risk_score") or 0.0)
    if risk >= 0.7:
        return "high"
    if risk >= 0.3:
        return "medium"
    return "low"


async def maybe_log_standalone_stream_event(
    db_session: Any,
    *,
    completion_data: Dict[str, Any],
    input_analysis: Dict[str, Any],
    safe_only: bool,
    event_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Log universal event for standalone streaming completion (non-blocking).

    Builds a minimal pipeline_result dict; does not change scores or safety.
    """
    pipeline_result: Dict[str, Any] = {
        "ok": True,
        "mode": "standalone",
        "risk_level": _risk_level_from_input_analysis(input_analysis),
        "behavioral": completion_data.get("behavioral"),
        "data": {
            "user_score": completion_data.get("user_score"),
            "assistant_score": completion_data.get("assistant_score"),
        },
    }
    if completion_data.get("assistant_score") is not None:
        pipeline_result["eza_score"] = completion_data.get("assistant_score")
    if safe_only:
        pipeline_result["data"]["mode"] = "safe-only"
        pipeline_result["data"]["safety"] = completion_data.get("safety")
    return await maybe_log_pipeline_event(
        db_session,
        "standalone",
        pipeline_result,
        event_context,
    )


# ---------------------------------------------------------------------------
# TODO — future pipeline integrations (Stage 3+)
# ---------------------------------------------------------------------------

async def maybe_log_media_pipeline_event(*_args: Any, **_kwargs: Any) -> None:
    """TODO: Wire media_monitor pipeline to normalize_media_event + log_eza_event."""
    return None


async def maybe_log_agent_pipeline_event(*_args: Any, **_kwargs: Any) -> None:
    """TODO: Wire agent_runtime to normalize_agent_event + log_eza_event."""
    return None


async def maybe_log_autonomy_pipeline_event(*_args: Any, **_kwargs: Any) -> None:
    """TODO: Wire autonomy_monitor to normalize_autonomy_event + log_eza_event."""
    return None
