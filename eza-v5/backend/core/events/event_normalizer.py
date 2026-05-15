# -*- coding: utf-8 -*-
"""
Universal Event normalizer — Stage 1.

Produces structured event dicts without raw user/model content in production fields.
Does not alter pipeline safety decisions.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from backend.config import get_settings

EVENT_SCHEMA_VERSION = 1

# Keys that must never appear in persisted JSON (production or test).
FORBIDDEN_CONTENT_KEYS = frozenset({
    "message",
    "content",
    "text",
    "raw_output",
    "query",
    "query_value",
    "user_input",
    "assistant_answer",
    "safe_answer",
    "output_text",
    "transcript",
    "body",
    "prompt",
})

CASE_SNAPSHOT_ALLOWLIST = frozenset({
    "vector",
    "asymmetry",
    "schema_version",
    "interaction_id",
    "mode",
    "score_vector",
    "engine_votes",
    "decision_trace",
})


def _clip_score(value: Any) -> Optional[float]:
    """Clip numeric score to [0, 100]; unknown values become None (not 0)."""
    if value is None:
        return None
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None
    if v != v:  # NaN
        return None
    return max(0.0, min(100.0, v))


def _resolve_case_snapshot(snapshot: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Production / non-test: always NULL.
    TEST_MODE: sanitized numeric-only snapshot subset.
    """
    settings = get_settings()
    env = (settings.ENV or "").lower()
    eza_env = (settings.EZA_ENV or "").lower()
    if env in ("prod", "production") or eza_env in ("prod", "production"):
        return None
    if not settings.TEST_MODE:
        return None
    if not snapshot or not isinstance(snapshot, dict):
        return None
    safe: Dict[str, Any] = {}
    for k, v in snapshot.items():
        if k not in CASE_SNAPSHOT_ALLOWLIST:
            continue
        if k in FORBIDDEN_CONTENT_KEYS:
            continue
        if isinstance(v, dict):
            nested = {
                nk: nv
                for nk, nv in v.items()
                if nk not in FORBIDDEN_CONTENT_KEYS and not isinstance(nv, str)
            }
            if nested:
                safe[k] = nested
        elif not isinstance(v, str):
            safe[k] = v
    return safe or None


def _is_forbidden_key(key: str) -> bool:
    kl = key.lower()
    if kl in FORBIDDEN_CONTENT_KEYS:
        return True
    for token in ("message", "content", "text", "body", "query", "prompt", "transcript", "raw_"):
        if token in kl:
            return True
    return False


def _strip_forbidden(obj: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Remove raw-content keys from nested dicts; keep short identifier strings."""
    if not obj or not isinstance(obj, dict):
        return None
    out: Dict[str, Any] = {}
    for k, v in obj.items():
        if _is_forbidden_key(k):
            continue
        if isinstance(v, str):
            if len(v) > 256:
                continue
            out[k] = v
        elif isinstance(v, dict):
            nested = _strip_forbidden(v)
            if nested:
                out[k] = nested
        elif isinstance(v, list):
            out[k] = [
                x for x in v
                if not isinstance(x, str) or len(x) <= 256
            ]
        else:
            out[k] = v
    return out or None


def _scores_from_pipeline(pipeline_result: Optional[Dict[str, Any]]) -> Dict[str, Optional[float]]:
    """Extract clipped scores from pipeline response without copying text fields."""
    if not pipeline_result or not isinstance(pipeline_result, dict):
        return {
            "eza_score": None,
            "risk_score": None,
            "confidence_score": None,
            "reliability_score": None,
        }
    eza = pipeline_result.get("eza_score")
    risk_level = pipeline_result.get("risk_level")
    risk_score = None
    if risk_level == "high":
        risk_score = 80.0
    elif risk_level == "medium":
        risk_score = 50.0
    elif risk_level == "low":
        risk_score = 20.0

    data = pipeline_result.get("data") or {}
    if isinstance(data, dict):
        us = data.get("user_score")
        if us is not None and risk_score is None:
            risk_score = 100.0 - _clip_score(us)

    return {
        "eza_score": _clip_score(eza),
        "risk_score": _clip_score(risk_score),
        "confidence_score": _clip_score(pipeline_result.get("confidence_score")),
        "reliability_score": _clip_score(pipeline_result.get("reliability_score")),
    }


def _vector_from_behavioral(behavioral: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not behavioral or not isinstance(behavioral, dict):
        return None
    vec = behavioral.get("vector")
    if not vec or not isinstance(vec, dict):
        return None
    out: Dict[str, Any] = {}
    for k, v in vec.items():
        if k in FORBIDDEN_CONTENT_KEYS or isinstance(v, str):
            continue
        if v is None:
            out[k] = None
        elif isinstance(v, (int, float, bool)):
            out[k] = v
        else:
            clipped = _clip_score(v)
            out[k] = clipped if clipped is not None else v
    return out or None


def _build_base_event(
    *,
    source_mode: str,
    entity_type: str,
    entity_id: str,
    event_type: str,
    calibration_scope: str,
    regulation_scope: str = "none",
    user_id: Optional[str] = None,
    org_id: Optional[str] = None,
    session_id: Optional[str] = None,
    timestamp: Optional[datetime] = None,
    score_vector: Optional[Dict[str, Any]] = None,
    engine_votes: Optional[Dict[str, Any]] = None,
    decision_trace: Optional[Dict[str, Any]] = None,
    metadata: Optional[Dict[str, Any]] = None,
    risk_label: Optional[str] = None,
    risk_score: Optional[float] = None,
    confidence_score: Optional[float] = None,
    reliability_score: Optional[float] = None,
    can_interpret: bool = False,
    case_snapshot: Optional[Dict[str, Any]] = None,
    schema_version: int = EVENT_SCHEMA_VERSION,
) -> Dict[str, Any]:
    """Assemble a normalized event dict ready for logging."""
    ts = timestamp or datetime.now(timezone.utc)
    return {
        "id": str(uuid.uuid4()),
        "source_mode": source_mode,
        "entity_type": entity_type,
        "entity_id": str(entity_id),
        "event_type": event_type,
        "calibration_scope": calibration_scope,
        "regulation_scope": regulation_scope,
        "user_id": str(user_id) if user_id else None,
        "org_id": str(org_id) if org_id else None,
        "session_id": str(session_id) if session_id else None,
        "timestamp": ts.isoformat(),
        "score_vector": _strip_forbidden(score_vector),
        "engine_votes": _strip_forbidden(engine_votes),
        "decision_trace": _strip_forbidden(decision_trace),
        "metadata": _strip_forbidden(metadata),
        "risk_label": str(risk_label)[:64] if risk_label else None,
        "risk_score": _clip_score(risk_score),
        "confidence_score": _clip_score(confidence_score),
        "reliability_score": _clip_score(reliability_score),
        "can_interpret": bool(can_interpret),
        "case_snapshot": _resolve_case_snapshot(case_snapshot),
        "schema_version": int(schema_version),
    }


def normalize_standalone_event(
    *,
    user_id: str,
    session_id: str,
    org_id: Optional[str] = None,
    pipeline_result: Optional[Dict[str, Any]] = None,
    behavioral_snapshot: Optional[Dict[str, Any]] = None,
    engine_votes: Optional[Dict[str, Any]] = None,
    decision_trace: Optional[Dict[str, Any]] = None,
    metadata: Optional[Dict[str, Any]] = None,
    case_snapshot: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Standalone turn → universal event (numeric only).

    source_mode=standalone, entity_type=user, event_type=message, scope=user_level
    """
    scores = _scores_from_pipeline(pipeline_result)
    vec = _vector_from_behavioral(behavioral_snapshot)
    if vec is None and scores.get("eza_score") is not None:
        vec = {"eza_final": scores["eza_score"]}

    risk_label = None
    if pipeline_result and isinstance(pipeline_result, dict):
        risk_label = pipeline_result.get("risk_level")

    return _build_base_event(
        source_mode="standalone",
        entity_type="user",
        entity_id=user_id,
        event_type="message",
        calibration_scope="user_level",
        regulation_scope="none",
        user_id=user_id,
        org_id=org_id,
        session_id=session_id,
        score_vector=vec,
        engine_votes=engine_votes,
        decision_trace=decision_trace,
        metadata=metadata,
        risk_label=risk_label,
        risk_score=scores.get("risk_score"),
        confidence_score=scores.get("confidence_score"),
        reliability_score=scores.get("reliability_score"),
        can_interpret=bool(pipeline_result and pipeline_result.get("ok")),
        case_snapshot=case_snapshot or behavioral_snapshot,
    )


def normalize_proxy_event(
    *,
    user_id: Optional[str],
    session_id: str,
    org_id: Optional[str] = None,
    analysis_id: Optional[str] = None,
    case_id: Optional[str] = None,
    pipeline_result: Optional[Dict[str, Any]] = None,
    behavioral_snapshot: Optional[Dict[str, Any]] = None,
    engine_votes: Optional[Dict[str, Any]] = None,
    decision_trace: Optional[Dict[str, Any]] = None,
    metadata: Optional[Dict[str, Any]] = None,
    regulation_scope: str = "none",
    case_snapshot: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Proxy analysis case → universal event.

    entity_id = analysis_id or case_id or session_id fallback.
    """
    entity_id = analysis_id or case_id or session_id
    scores = _scores_from_pipeline(pipeline_result)
    vec = _vector_from_behavioral(behavioral_snapshot)

    risk_label = None
    if pipeline_result and isinstance(pipeline_result, dict):
        risk_label = pipeline_result.get("risk_level")

    meta = dict(metadata or {})
    if analysis_id:
        meta["analysis_id"] = str(analysis_id)
    if case_id:
        meta["case_id"] = str(case_id)

    return _build_base_event(
        source_mode="proxy",
        entity_type="content",
        entity_id=entity_id,
        event_type="analysis_case",
        calibration_scope="case_level",
        regulation_scope=regulation_scope,
        user_id=user_id,
        org_id=org_id,
        session_id=session_id,
        score_vector=vec,
        engine_votes=engine_votes,
        decision_trace=decision_trace,
        metadata=meta,
        risk_label=risk_label,
        risk_score=scores.get("risk_score"),
        confidence_score=scores.get("confidence_score"),
        reliability_score=scores.get("reliability_score"),
        can_interpret=True,
        case_snapshot=case_snapshot or behavioral_snapshot,
    )


def normalize_proxy_lite_event(
    *,
    user_id: Optional[str],
    session_id: str,
    org_id: Optional[str] = None,
    case_id: Optional[str] = None,
    pipeline_result: Optional[Dict[str, Any]] = None,
    behavioral_snapshot: Optional[Dict[str, Any]] = None,
    engine_votes: Optional[Dict[str, Any]] = None,
    decision_trace: Optional[Dict[str, Any]] = None,
    metadata: Optional[Dict[str, Any]] = None,
    regulation_scope: str = "none",
    case_snapshot: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Proxy-Lite audit case → universal event (org_level calibration)."""
    entity_id = case_id or session_id
    scores = _scores_from_pipeline(pipeline_result)
    vec = _vector_from_behavioral(behavioral_snapshot)

    risk_label = None
    if pipeline_result and isinstance(pipeline_result, dict):
        risk_label = pipeline_result.get("risk_level")
        data = pipeline_result.get("data") or {}
        if isinstance(data, dict) and not risk_label:
            risk_label = data.get("risk_level")

    return _build_base_event(
        source_mode="proxy_lite",
        entity_type="content",
        entity_id=entity_id,
        event_type="audit_case",
        calibration_scope="org_level",
        regulation_scope=regulation_scope,
        user_id=user_id,
        org_id=org_id,
        session_id=session_id,
        score_vector=vec,
        engine_votes=engine_votes,
        decision_trace=decision_trace,
        metadata=metadata,
        risk_label=risk_label,
        risk_score=scores.get("risk_score"),
        confidence_score=scores.get("confidence_score"),
        reliability_score=scores.get("reliability_score"),
        can_interpret=True,
        case_snapshot=case_snapshot or behavioral_snapshot,
    )


def normalize_media_event(
    *,
    media_case_id: str,
    session_id: str,
    media_event_type: str,
    user_id: Optional[str] = None,
    org_id: Optional[str] = None,
    risk_label: Optional[str] = None,
    risk_score: Optional[float] = None,
    confidence_score: Optional[float] = None,
    reliability_score: Optional[float] = None,
    score_vector: Optional[Dict[str, Any]] = None,
    engine_votes: Optional[Dict[str, Any]] = None,
    decision_trace: Optional[Dict[str, Any]] = None,
    metadata: Optional[Dict[str, Any]] = None,
    regulation_scope: str = "rtuk",
    case_snapshot: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Media monitor event (text/audio/image/video)."""
    allowed = {"media_text", "media_audio", "media_image", "media_video"}
    evt = media_event_type if media_event_type in allowed else "media_text"

    return _build_base_event(
        source_mode="media_monitor",
        entity_type="media_case",
        entity_id=media_case_id,
        event_type=evt,
        calibration_scope="case_level",
        regulation_scope=regulation_scope,
        user_id=user_id,
        org_id=org_id,
        session_id=session_id,
        score_vector=score_vector,
        engine_votes=engine_votes,
        decision_trace=decision_trace,
        metadata=metadata,
        risk_label=risk_label,
        risk_score=risk_score,
        confidence_score=confidence_score,
        reliability_score=reliability_score,
        can_interpret=True,
        case_snapshot=case_snapshot,
    )


def normalize_agent_event(
    *,
    agent_id: str,
    session_id: str,
    user_id: Optional[str] = None,
    org_id: Optional[str] = None,
    decision_label: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Agent runtime stub — phase 3, not fully interpretable."""
    meta = dict(metadata or {})
    meta["phase"] = 3
    meta["stub"] = True

    return _build_base_event(
        source_mode="agent_runtime",
        entity_type="agent",
        entity_id=agent_id,
        event_type="agent_decision",
        calibration_scope="engine_level",
        regulation_scope="none",
        user_id=user_id,
        org_id=org_id,
        session_id=session_id,
        score_vector=None,
        engine_votes=None,
        decision_trace=None,
        metadata=meta,
        risk_label=decision_label,
        risk_score=None,
        confidence_score=None,
        reliability_score=None,
        can_interpret=False,
        case_snapshot=None,
    )


def normalize_autonomy_event(
    *,
    entity_id: str,
    session_id: str,
    autonomy_event_type: str,
    entity_type: str = "vehicle",
    user_id: Optional[str] = None,
    org_id: Optional[str] = None,
    risk_label: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Autonomy monitor stub — phase 4."""
    allowed_types = {"motion_event", "sensor_event", "autonomy_event"}
    evt = autonomy_event_type if autonomy_event_type in allowed_types else "autonomy_event"
    if entity_type not in ("vehicle", "robot"):
        entity_type = "vehicle"

    meta = dict(metadata or {})
    meta["phase"] = 4
    meta["stub"] = True

    return _build_base_event(
        source_mode="autonomy_monitor",
        entity_type=entity_type,
        entity_id=entity_id,
        event_type=evt,
        calibration_scope="global_level",
        regulation_scope="autonomy_safety",
        user_id=user_id,
        org_id=org_id,
        session_id=session_id,
        metadata=meta,
        risk_label=risk_label,
        risk_score=None,
        confidence_score=None,
        reliability_score=None,
        can_interpret=False,
        case_snapshot=None,
    )
