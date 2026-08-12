# -*- coding: utf-8 -*-
"""Phase 4.2 — frozen per-step EZA interaction snapshot.

Canonical source model: BehavioralSnapshot (+ userScore/assistantScore) from the
chat turn that produced the Q/A. NOT Relationship Map / user profile aggregates.

Internal storage keeps enough of the behavioral vector to freeze historical
display. Public HTTP uses an explicit allowlist only.
"""

from __future__ import annotations

from typing import Any, Mapping, Optional

FROZEN_STEP_EZA_CONTRACT = "frozen_step_eza_v1"

# Public allowlist — interaction display fields only (chat pill inputs).
_PUBLIC_EZA_KEYS = frozenset(
    {
        "assistantScore",
        "userScore",
        "ezaFinal",
        "outputHealth",
        "inputHealth",
        "alignmentScore",
        "redirect",
        "redirectBenign",
        "intent",
    }
)

# Never accept / never project these (profile / detectors / traces).
_FORBIDDEN_EZA_KEYS = frozenset(
    {
        "relationshipMap",
        "relationship_map",
        "behavioralHistory",
        "behavioral_history",
        "aggregateScore",
        "aggregate_score",
        "userProfile",
        "user_profile",
        "eza_score_breakdown",
        "score_breakdown",
        "case_snapshot",
        "caseSnapshot",
        "deception_score",
        "legal_risk_score",
        "psych_pressure_score",
        "asymmetry",
        "input_risk",
        "output_risk",
        "policy_violation_count",
        "redirect_reason",
        "alignment_verdict",
        "standaloneObservation",
        "mirrorCueHints",
        "rawModelTrace",
        "reasoning",
    }
)


def _as_mapping(value: Any) -> dict[str, Any]:
    return dict(value) if isinstance(value, Mapping) else {}


def _finite_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        num = float(value)
    except (TypeError, ValueError):
        return None
    if num != num:  # NaN
        return None
    return num


def _clamp_score_0_100(value: Any) -> float | None:
    num = _finite_float(value)
    if num is None:
        return None
    if 0.0 <= num <= 1.0:
        num = num * 100.0
    return max(0.0, min(100.0, num))


def _clamp_unit(value: Any) -> float | None:
    num = _finite_float(value)
    if num is None:
        return None
    if num > 1.0 and num <= 100.0:
        num = num / 100.0
    return max(0.0, min(1.0, num))


def _normalize_vector(raw: Mapping[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(raw, Mapping) or not raw:
        return None
    out: dict[str, Any] = {
        "input_risk": _clamp_unit(raw.get("input_risk")),
        "output_risk": _clamp_unit(raw.get("output_risk")),
        "input_health": _clamp_unit(raw.get("input_health")),
        "output_health": _clamp_unit(raw.get("output_health")),
        "alignment_score": _clamp_unit(raw.get("alignment_score")),
        "eza_final": _clamp_score_0_100(raw.get("eza_final")),
        "intent": str(raw.get("intent") or "").strip() or None,
        "alignment_verdict": (
            str(raw.get("alignment_verdict")).strip()
            if raw.get("alignment_verdict") is not None
            else None
        ),
        "redirect": bool(raw.get("redirect")) if raw.get("redirect") is not None else False,
        "redirect_reason": (
            str(raw.get("redirect_reason")).strip()
            if raw.get("redirect_reason") is not None
            else None
        ),
        "policy_violation_count": int(raw.get("policy_violation_count") or 0),
    }
    if "redirect_benign" in raw:
        out["redirect_benign"] = bool(raw.get("redirect_benign"))
    # Intentionally omit deception/legal/psych deep scores from frozen storage.
    return out


def _normalize_asymmetry(raw: Mapping[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(raw, Mapping) or not raw:
        return None
    return {
        "health_gap": _finite_float(raw.get("health_gap")),
        "risk_delta_output_minus_input": _finite_float(
            raw.get("risk_delta_output_minus_input")
        ),
        "index": _finite_float(raw.get("index")),
    }


def normalize_frozen_step_eza_snapshot(
    raw: Mapping[str, Any] | None,
    *,
    source_assistant_message_id: str | None = None,
    source_user_message_id: str | None = None,
) -> dict[str, Any] | None:
    """
    Normalize client/server EZA payload into durable internal freeze shape.

    Returns None when no usable interaction-level scores/vector exist.
    Rejects / strips profile-level and detector-only fields.
    """
    if not isinstance(raw, Mapping) or not raw:
        return None
    for key in (
        "relationshipMap",
        "relationship_map",
        "behavioralHistory",
        "behavioral_history",
        "userProfile",
        "user_profile",
        "aggregateScore",
        "aggregate_score",
    ):
        if key in raw:
            return None

    behavioral_in = _as_mapping(raw.get("behavioral") or raw.get("BehavioralSnapshot"))
    if not behavioral_in and isinstance(raw.get("vector"), Mapping):
        behavioral_in = {
            "schema_version": raw.get("schema_version") or 1,
            "interaction_id": raw.get("interaction_id"),
            "mode": raw.get("mode") or "standalone",
            "vector": raw.get("vector"),
            "asymmetry": raw.get("asymmetry"),
        }

    vector = _normalize_vector(_as_mapping(behavioral_in.get("vector")))
    asymmetry = _normalize_asymmetry(_as_mapping(behavioral_in.get("asymmetry")))

    assistant_score = _clamp_score_0_100(
        raw.get("assistantScore")
        if raw.get("assistantScore") is not None
        else raw.get("assistant_score")
        if raw.get("assistant_score") is not None
        else raw.get("eza_score")
        if raw.get("eza_score") is not None
        else (vector or {}).get("eza_final")
    )
    user_score = _clamp_score_0_100(
        raw.get("userScore")
        if raw.get("userScore") is not None
        else raw.get("user_score")
    )

    if assistant_score is None and user_score is None and vector is None:
        return None

    behavioral_out: dict[str, Any] | None = None
    if vector is not None:
        behavioral_out = {
            "schema_version": int(behavioral_in.get("schema_version") or 1),
            "interaction_id": str(
                behavioral_in.get("interaction_id")
                or source_assistant_message_id
                or ""
            ).strip()
            or None,
            "mode": str(behavioral_in.get("mode") or "standalone").strip() or "standalone",
            "vector": vector,
        }
        if asymmetry is not None:
            behavioral_out["asymmetry"] = asymmetry

    return {
        "contractVersion": FROZEN_STEP_EZA_CONTRACT,
        "sourceUserMessageId": (source_user_message_id or "").strip() or None,
        "sourceAssistantMessageId": (source_assistant_message_id or "").strip() or None,
        "assistantScore": assistant_score,
        "userScore": user_score,
        "behavioral": behavioral_out,
    }


def project_public_frozen_step_eza(
    internal: Mapping[str, Any] | None,
) -> dict[str, Any] | None:
    """Allowlisted public EZA projection for /frozen steps."""
    if not isinstance(internal, Mapping) or not internal:
        return None
    for key in (
        "relationshipMap",
        "relationship_map",
        "behavioralHistory",
        "userProfile",
        "aggregateScore",
    ):
        if key in internal:
            return None

    behavioral = _as_mapping(internal.get("behavioral"))
    vector = _as_mapping(behavioral.get("vector"))

    public: dict[str, Any] = {}
    assistant = _clamp_score_0_100(internal.get("assistantScore"))
    user = _clamp_score_0_100(internal.get("userScore"))
    eza_final = _clamp_score_0_100(vector.get("eza_final"))
    if assistant is not None:
        public["assistantScore"] = assistant
    if user is not None:
        public["userScore"] = user
    if eza_final is not None:
        public["ezaFinal"] = eza_final
    oh = _clamp_unit(vector.get("output_health"))
    ih = _clamp_unit(vector.get("input_health"))
    align = _clamp_unit(vector.get("alignment_score"))
    if oh is not None:
        public["outputHealth"] = oh
    if ih is not None:
        public["inputHealth"] = ih
    if align is not None:
        public["alignmentScore"] = align
    if "redirect" in vector:
        public["redirect"] = bool(vector.get("redirect"))
    if "redirect_benign" in vector:
        public["redirectBenign"] = bool(vector.get("redirect_benign"))
    intent = str(vector.get("intent") or "").strip()
    if intent:
        public["intent"] = intent

    if not public:
        return None
    # Strict allowlist — drop anything unexpected if callers mutate.
    return {k: v for k, v in public.items() if k in _PUBLIC_EZA_KEYS}


def assert_eza_bound_to_assistant(
    *,
    snapshot: Mapping[str, Any] | None,
    source_assistant_message_id: str,
) -> None:
    """Fail closed if a snapshot claims a different assistant message binding."""
    if not snapshot:
        return
    bound = str(snapshot.get("sourceAssistantMessageId") or "").strip()
    expected = str(source_assistant_message_id or "").strip()
    if bound and expected and bound != expected:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "journey_eza_snapshot_mismatch",
                "message": "EZA snapshot does not bind to this step's assistant message",
            },
        )
