# -*- coding: utf-8 -*-
"""Types for the standalone observation layer (rule-based, no LLM)."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, TypedDict

UserPatternCategory = Literal[
    "curiosity_exploration",
    "decision_direction",
    "clarity_simplification",
    "ideation_creation",
    "deep_thinking",
    "sensitive_careful",
    "fast_practical",
    "planning_structure",
    "trust_verification",
    "balanced_calm",
]

AiBehaviorCategory = Literal[
    "explanatory",
    "guiding",
    "careful",
    "creative",
    "calm",
    "clear",
    "structured",
    "protective",
    "aligned",
    "reflective",
]

RelationshipBalanceCategory = Literal[
    "harmonious_flow",
    "safe_balance",
    "exploration_balance",
    "decision_balance",
    "clarity_balance",
    "creative_balance",
    "careful_balance",
    "calm_rhythm",
    "explanation_balance",
    "boundary_balance",
]

ObservationQuality = Literal["low", "medium", "high"]


class PatternTag(TypedDict):
    category: str
    confidence: float
    signals: List[str]


class StandaloneObservation(TypedDict):
    user_pattern: PatternTag
    ai_behavior: PatternTag
    relationship_balance: PatternTag
    observation_quality: ObservationQuality
    can_interpret: bool
    disclaimer: str


DISCLAIMER_TR = "Bu gözlem yalnızca sayısal etkileşim sinyallerine dayanır."


def observation_to_dict(obs: StandaloneObservation) -> Dict[str, Any]:
    return dict(obs)
