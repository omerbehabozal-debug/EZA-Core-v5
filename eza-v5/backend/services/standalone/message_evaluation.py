# -*- coding: utf-8 -*-
"""Whitelist + sanitize durable per-message EZA evaluation metadata.

Stored in StandaloneConversationMessage.metadata (JSON). No migration.
Presentation (EZA Görünümü) is independent — always persist when available.
"""

from __future__ import annotations

from typing import Any, Optional

from backend.services.standalone.metadata_security import reject_forbidden_metadata
from backend.services.standalone.persistence_limits import validate_bounded_json

SAFETY_VALUES = frozenset({"Safe", "Warning", "Blocked"})

# Metadata keys written to DB (camelCase — matches FE Message / archive)
META_USER_SCORE = "userScore"
META_ASSISTANT_SCORE = "assistantScore"
META_BEHAVIORAL = "behavioral"
META_SAFETY = "safety"


def clamp_score_0_100(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        num = float(value)
    except (TypeError, ValueError):
        return None
    if num != num or num in (float("inf"), float("-inf")):  # NaN / Inf
        return None
    return max(0.0, min(100.0, round(num, 1)))


def sanitize_safety(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    text = value.strip()
    return text if text in SAFETY_VALUES else None


def _finite_float(value: Any) -> Optional[float]:
    try:
        num = float(value)
    except (TypeError, ValueError):
        return None
    if num != num or num in (float("inf"), float("-inf")):
        return None
    return num


def sanitize_behavioral_snapshot(raw: Any) -> Optional[dict[str, Any]]:
    """Keep only the BehavioralSnapshot contract; drop unknown keys."""
    if not isinstance(raw, dict):
        return None
    vector_raw = raw.get("vector")
    asymmetry_raw = raw.get("asymmetry")
    if not isinstance(vector_raw, dict) or not isinstance(asymmetry_raw, dict):
        return None

    def opt01(key: str) -> Optional[float]:
        v = _finite_float(vector_raw.get(key))
        if v is None:
            return None
        return max(0.0, min(1.0, round(v, 4)))

    def opt100(key: str) -> Optional[float]:
        v = _finite_float(vector_raw.get(key))
        if v is None:
            return None
        return max(0.0, min(100.0, round(v, 2)))

    vector: dict[str, Any] = {
        "input_risk": opt01("input_risk") if vector_raw.get("input_risk") is not None else 0.0,
        "output_risk": opt01("output_risk") if vector_raw.get("output_risk") is not None else 0.0,
        "input_health": opt01("input_health") if vector_raw.get("input_health") is not None else 0.0,
        "output_health": opt01("output_health")
        if vector_raw.get("output_health") is not None
        else 0.0,
        "alignment_score": opt100("alignment_score"),
        "eza_final": opt100("eza_final"),
        "intent": str(vector_raw.get("intent") or "unknown")[:64],
        "alignment_verdict": (
            str(vector_raw.get("alignment_verdict"))[:32]
            if vector_raw.get("alignment_verdict") is not None
            else None
        ),
        "redirect": bool(vector_raw.get("redirect")),
        "redirect_reason": (
            str(vector_raw.get("redirect_reason"))[:120]
            if vector_raw.get("redirect_reason") is not None
            else None
        ),
        "redirect_benign": bool(vector_raw.get("redirect_benign")),
        "policy_violation_count": max(
            0, int(_finite_float(vector_raw.get("policy_violation_count")) or 0)
        ),
    }
    for opt_key in ("deception_score", "legal_risk_score", "psych_pressure_score"):
        if vector_raw.get(opt_key) is not None:
            vector[opt_key] = opt01(opt_key)

    asymmetry: dict[str, Any] = {}
    for key in ("health_gap", "risk_delta_output_minus_input", "index"):
        v = _finite_float(asymmetry_raw.get(key))
        asymmetry[key] = 0.0 if v is None else round(v, 4)

    try:
        schema_version = int(raw.get("schema_version") or 1)
    except (TypeError, ValueError):
        schema_version = 1

    return {
        "schema_version": schema_version,
        "interaction_id": str(raw.get("interaction_id") or "")[:128],
        "mode": str(raw.get("mode") or "standalone")[:32],
        "vector": vector,
        "asymmetry": asymmetry,
    }


def build_user_evaluation_metadata(*, user_score: Any) -> Optional[dict[str, Any]]:
    score = clamp_score_0_100(user_score)
    if score is None:
        return None
    return {META_USER_SCORE: score}


def build_assistant_evaluation_metadata(
    *,
    assistant_score: Any = None,
    behavioral: Any = None,
    safety: Any = None,
) -> Optional[dict[str, Any]]:
    out: dict[str, Any] = {}
    score = clamp_score_0_100(assistant_score)
    if score is not None:
        out[META_ASSISTANT_SCORE] = score
    snap = sanitize_behavioral_snapshot(behavioral)
    if snap is not None:
        out[META_BEHAVIORAL] = snap
    safe = sanitize_safety(safety)
    if safe is not None:
        out[META_SAFETY] = safe
    return out or None


def merge_evaluation_into_metadata(
    existing: Any,
    patch: dict[str, Any] | None,
) -> Optional[dict[str, Any]]:
    """Merge whitelist evaluation keys into existing metadata; never drop unrelated keys."""
    base: dict[str, Any] = {}
    if isinstance(existing, dict):
        base = dict(existing)
    if not patch:
        return base or None
    for key in (META_USER_SCORE, META_ASSISTANT_SCORE, META_BEHAVIORAL, META_SAFETY):
        if key in patch:
            base[key] = patch[key]
    return base or None


def evaluation_fields_from_metadata(raw: Any) -> dict[str, Any]:
    """Safe DTO projection — never expose arbitrary metadata keys."""
    if not isinstance(raw, dict):
        return {}
    out: dict[str, Any] = {}
    user_score = clamp_score_0_100(raw.get(META_USER_SCORE))
    if user_score is None and raw.get("user_score") is not None:
        user_score = clamp_score_0_100(raw.get("user_score"))
    if user_score is not None:
        out["userScore"] = user_score

    assistant_score = clamp_score_0_100(raw.get(META_ASSISTANT_SCORE))
    if assistant_score is None and raw.get("assistant_score") is not None:
        assistant_score = clamp_score_0_100(raw.get("assistant_score"))
    if assistant_score is not None:
        out["assistantScore"] = assistant_score

    behavioral = sanitize_behavioral_snapshot(
        raw.get(META_BEHAVIORAL) or raw.get("behavioral")
    )
    if behavioral is not None:
        out["behavioral"] = behavioral

    safety = sanitize_safety(raw.get(META_SAFETY) or raw.get("safety"))
    if safety is not None:
        out["safety"] = safety
    return out


def try_prepare_persisted_metadata(patch: dict[str, Any] | None) -> Optional[dict[str, Any]]:
    """
    Validate bounds/forbidden keys. On failure return None (fail soft —
    message persistence must not fail because of evaluation metadata).
    """
    if not patch:
        return None
    try:
        reject_forbidden_metadata(patch, field_name="message_metadata")
        validate_bounded_json(patch, field_name="message_metadata")
    except Exception:
        # Prefer scores-only if full behavioral exceeds limits
        slim: dict[str, Any] = {}
        if META_USER_SCORE in patch:
            slim[META_USER_SCORE] = patch[META_USER_SCORE]
        if META_ASSISTANT_SCORE in patch:
            slim[META_ASSISTANT_SCORE] = patch[META_ASSISTANT_SCORE]
        if META_SAFETY in patch:
            slim[META_SAFETY] = patch[META_SAFETY]
        if not slim:
            return None
        try:
            reject_forbidden_metadata(slim, field_name="message_metadata")
            validate_bounded_json(slim, field_name="message_metadata")
            return slim
        except Exception:
            return None
    return patch
