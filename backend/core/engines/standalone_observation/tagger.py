# -*- coding: utf-8 -*-
"""Rule-based tagger for standalone observation categories."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from backend.core.engines.standalone_observation import rules
from backend.core.engines.standalone_observation.types import (
    AiBehaviorCategory,
    ObservationQuality,
    PatternTag,
    RelationshipBalanceCategory,
    StandaloneObservation,
    UserPatternCategory,
    DISCLAIMER_TR,
)


def _clamp_conf(x: float) -> float:
    return max(0.5, min(0.95, round(float(x), 2)))


def _risk(analysis: Optional[Dict[str, Any]]) -> float:
    if not analysis or not isinstance(analysis, dict):
        return 0.0
    try:
        return max(0.0, min(1.0, float(analysis.get("risk_score", 0.0))))
    except (TypeError, ValueError):
        return 0.0


def _alignment_score(alignment: Optional[Dict[str, Any]]) -> float:
    if not alignment or not isinstance(alignment, dict):
        return 70.0
    try:
        return max(0.0, min(100.0, float(alignment.get("alignment_score", 70.0))))
    except (TypeError, ValueError):
        return 70.0


def tag_user_pattern(
    user_text: str,
    input_analysis: Dict[str, Any],
) -> PatternTag:
    input_risk = _risk(input_analysis)
    if input_risk >= rules.INPUT_RISK_HIGH:
        conf = _clamp_conf(0.58 + input_risk * 0.35)
        return {
            "category": "sensitive_careful",
            "confidence": conf,
            "signals": ["elevated_input_risk"],
        }

    category, signals, conf = rules.match_user_keywords(user_text)
    return {
        "category": category,
        "confidence": _clamp_conf(conf),
        "signals": signals[:6],
    }


def tag_ai_behavior(
    output_text: str,
    input_analysis: Dict[str, Any],
    output_analysis: Dict[str, Any],
    alignment: Dict[str, Any],
    redirect: Optional[Dict[str, Any]] = None,
) -> PatternTag:
    input_risk = _risk(input_analysis)
    output_risk = _risk(output_analysis)
    align = _alignment_score(alignment)
    redir = redirect or {}
    out = output_text or ""
    t = rules.normalize_text(out)

    if input_risk >= rules.INPUT_RISK_HIGH and output_risk <= rules.OUTPUT_RISK_LOW:
        return {
            "category": "protective",
            "confidence": _clamp_conf(0.72 + input_risk * 0.15),
            "signals": ["high_input_low_output_risk"],
        }

    if redir.get("redirect") and redir.get("reason") == "high_input_risk" and output_risk <= rules.OUTPUT_RISK_LOW:
        return {
            "category": "protective",
            "confidence": _clamp_conf(0.78),
            "signals": ["safe_redirect", "boundary_response"],
        }

    if rules.has_refusal_tone(out):
        cat: AiBehaviorCategory = "careful" if output_risk > 0.25 else "protective"
        return {
            "category": cat,
            "confidence": _clamp_conf(0.74),
            "signals": ["refusal_language", "policy_boundary"],
        }

    creative_markers = ("alternatif", "öneri", "tasarım", "fikir", "konsept", "örnek")
    if any(m in t for m in creative_markers) and len(out) > 80:
        return {
            "category": "creative",
            "confidence": _clamp_conf(0.7),
            "signals": ["idea_generation", "alternatives_offered"],
        }

    if rules.has_structure(out):
        return {
            "category": "structured",
            "confidence": _clamp_conf(0.76),
            "signals": ["structured_answer", "sectioned_response"],
        }

    if len(out) > 350 and any(m in t for m in rules.EXPLANATION_MARKERS):
        return {
            "category": "explanatory",
            "confidence": _clamp_conf(0.81),
            "signals": ["context_explanation", "causal_reasoning"],
        }

    guide_markers = ("öneririm", "şunu dene", "adım", "yapabilirsin", "dikkat et")
    if any(m in t for m in guide_markers):
        return {
            "category": "guiding",
            "confidence": _clamp_conf(0.73),
            "signals": ["guidance_language", "action_hints"],
        }

    if rules.is_short_direct_answer(out):
        return {
            "category": "clear",
            "confidence": _clamp_conf(0.68),
            "signals": ["concise_answer"],
        }

    if align >= rules.ALIGNMENT_HIGH and output_risk <= rules.OUTPUT_RISK_LOW:
        return {
            "category": "aligned",
            "confidence": _clamp_conf(0.75 + align / 500),
            "signals": ["high_alignment", "low_output_risk"],
        }

    if align < rules.ALIGNMENT_LOW:
        return {
            "category": "reflective",
            "confidence": _clamp_conf(0.65),
            "signals": ["alignment_tension"],
        }

    return {
        "category": "calm",
        "confidence": _clamp_conf(0.62),
        "signals": ["neutral_tone"],
    }


def tag_relationship_balance(
    user_pattern: PatternTag,
    ai_behavior: PatternTag,
    input_analysis: Dict[str, Any],
    output_analysis: Dict[str, Any],
    alignment: Dict[str, Any],
) -> PatternTag:
    u = user_pattern["category"]
    a = ai_behavior["category"]
    input_risk = _risk(input_analysis)
    output_risk = _risk(output_analysis)
    align = _alignment_score(alignment)

    if input_risk >= rules.INPUT_RISK_HIGH and output_risk <= rules.OUTPUT_RISK_LOW:
        return {
            "category": "safe_balance",
            "confidence": _clamp_conf(0.76),
            "signals": ["guidance_without_pressure"],
        }

    if u == "decision_direction" and a in ("structured", "guiding"):
        return {
            "category": "decision_balance",
            "confidence": _clamp_conf(0.76),
            "signals": ["guidance_without_pressure"],
        }

    if u == "clarity_simplification" and a in ("clear", "structured"):
        return {
            "category": "clarity_balance",
            "confidence": _clamp_conf(0.74),
            "signals": ["matched_clarity"],
        }

    if u == "ideation_creation" and a == "creative":
        return {
            "category": "creative_balance",
            "confidence": _clamp_conf(0.75),
            "signals": ["co_creative_flow"],
        }

    if u == "curiosity_exploration" and a in ("creative", "explanatory"):
        return {
            "category": "exploration_balance",
            "confidence": _clamp_conf(0.73),
            "signals": ["open_exploration"],
        }

    if u == "sensitive_careful" and a in ("careful", "protective"):
        cat: RelationshipBalanceCategory = (
            "boundary_balance" if a == "protective" else "careful_balance"
        )
        return {
            "category": cat,
            "confidence": _clamp_conf(0.77),
            "signals": ["careful_pairing"],
        }

    if u == "deep_thinking" and a in ("explanatory", "reflective"):
        return {
            "category": "explanation_balance",
            "confidence": _clamp_conf(0.75),
            "signals": ["depth_matched"],
        }

    neutral_user = u == "balanced_calm"
    if (
        not neutral_user
        and align >= rules.ALIGNMENT_HIGH
        and input_risk <= 0.35
        and output_risk <= 0.35
    ):
        return {
            "category": "harmonious_flow",
            "confidence": _clamp_conf(0.78),
            "signals": ["low_risk_alignment"],
        }

    return {
        "category": "calm_rhythm",
        "confidence": _clamp_conf(0.58),
        "signals": ["steady_interaction"],
    }


def _quality(
    user_pattern: PatternTag,
    ai_behavior: PatternTag,
    balance: PatternTag,
) -> ObservationQuality:
    fallback = (
        user_pattern["category"] == "balanced_calm"
        and ai_behavior["category"] == "calm"
        and balance["category"] == "calm_rhythm"
    )
    if fallback:
        return "low"
    confs = [
        user_pattern["confidence"],
        ai_behavior["confidence"],
        balance["confidence"],
    ]
    avg = sum(confs) / 3.0
    if avg >= 0.74:
        return "high"
    if avg >= 0.62:
        return "medium"
    return "low"


def build_observation(
    *,
    user_text: str,
    output_text: str,
    input_analysis: Dict[str, Any],
    output_analysis: Dict[str, Any],
    alignment: Dict[str, Any],
    redirect: Optional[Dict[str, Any]] = None,
) -> StandaloneObservation:
    user_pattern = tag_user_pattern(user_text, input_analysis)
    ai_behavior = tag_ai_behavior(
        output_text,
        input_analysis,
        output_analysis,
        alignment,
        redirect=redirect,
    )
    balance = tag_relationship_balance(
        user_pattern,
        ai_behavior,
        input_analysis,
        output_analysis,
        alignment,
    )
    quality = _quality(user_pattern, ai_behavior, balance)
    can_interpret = quality != "low"

    return {
        "user_pattern": user_pattern,
        "ai_behavior": ai_behavior,
        "relationship_balance": balance,
        "observation_quality": quality,
        "can_interpret": can_interpret,
        "disclaimer": DISCLAIMER_TR,
    }
