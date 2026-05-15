# -*- coding: utf-8 -*-
"""
Per-turn interaction snapshot: numeric vectors only (no message text).

Designed to be stored in telemetry meta or aggregated offline for Safe Mode.
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

VECTOR_SCHEMA_VERSION = 1


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


def _deep_score(deception: Optional[Dict[str, Any]]) -> Optional[float]:
    if not deception or not isinstance(deception, dict):
        return None
    s = deception.get("score")
    if s is None:
        return None
    return _clamp01(float(s))


def _legal_score(legal_risk: Optional[Dict[str, Any]]) -> Optional[float]:
    if not legal_risk or not isinstance(legal_risk, dict):
        return None
    s = legal_risk.get("risk_score")
    if s is None:
        return None
    return _clamp01(float(s))


def _psych_score(psych_pressure: Optional[Dict[str, Any]]) -> Optional[float]:
    if not psych_pressure or not isinstance(psych_pressure, dict):
        return None
    s = psych_pressure.get("score")
    if s is None:
        return None
    return _clamp01(float(s))


def analyze_interaction_turn(
    mode: str,
    input_analysis: Dict[str, Any],
    output_analysis: Dict[str, Any],
    alignment: Dict[str, Any],
    eza_score: Optional[float],
    redirect: Dict[str, Any],
    deception: Optional[Dict[str, Any]] = None,
    legal_risk: Optional[Dict[str, Any]] = None,
    psych_pressure: Optional[Dict[str, Any]] = None,
    policy_violation_count: int = 0,
) -> Dict[str, Any]:
    """
    Build a privacy-preserving snapshot for one user/assistant turn.

    Returns only scalars derived from existing analyzer outputs.
    """
    in_risk = _clamp01(float(input_analysis.get("risk_score", 0.0)))
    out_risk = _clamp01(float(output_analysis.get("risk_score", 0.0)))
    in_health = 1.0 - in_risk
    out_health = 1.0 - out_risk
    health_gap = abs(in_health - out_health)

    align_score = alignment.get("alignment_score")
    align_f: Optional[float] = None
    if align_score is not None:
        align_f = max(0.0, min(100.0, float(align_score)))

    eza_f: Optional[float] = None
    if eza_score is not None:
        eza_f = max(0.0, min(100.0, float(eza_score)))

    intent = str(input_analysis.get("intent", "unknown"))[:64]

    # Combined stress index in [0, 1]: how far apart user vs model "health"
    asymmetry_index = _clamp01(health_gap)

    redirect_flag = bool(redirect.get("redirect")) if isinstance(redirect, dict) else False
    redirect_reason = None
    if isinstance(redirect, dict):
        r = redirect.get("reason")
        if r is not None:
            redirect_reason = str(r)[:120]

    ds = _deep_score(deception)
    ls = _legal_score(legal_risk)
    ps = _psych_score(psych_pressure)

    vec: Dict[str, Any] = {
        "input_risk": round(in_risk, 4),
        "output_risk": round(out_risk, 4),
        "input_health": round(in_health, 4),
        "output_health": round(out_health, 4),
        "alignment_score": None if align_f is None else round(align_f, 2),
        "eza_final": None if eza_f is None else round(eza_f, 2),
        "intent": intent,
        "alignment_verdict": str(alignment.get("verdict", ""))[:32] or None,
        "redirect": redirect_flag,
        "redirect_reason": redirect_reason,
        "policy_violation_count": max(0, int(policy_violation_count)),
        "deception_score": None if ds is None else round(ds, 4),
        "legal_risk_score": None if ls is None else round(ls, 4),
        "psych_pressure_score": None if ps is None else round(ps, 4),
    }

    return {
        "schema_version": VECTOR_SCHEMA_VERSION,
        "interaction_id": str(uuid.uuid4()),
        "mode": str(mode)[:32],
        "vector": vec,
        "asymmetry": {
            "health_gap": round(health_gap, 4),
            "risk_delta_output_minus_input": round(out_risk - in_risk, 4),
            "index": round(asymmetry_index, 4),
        },
    }
