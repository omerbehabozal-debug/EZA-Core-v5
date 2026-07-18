# -*- coding: utf-8 -*-
"""Mirror Director V1 — Meaning Analysis schemas (PR A).

Controlled topic enum + normalized topicCategory. Not wired to production routes yet.
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

MIRROR_DIRECTOR_SCHEMA_VERSION: Literal["mirror-director-v1"] = "mirror-director-v1"

MirrorDirectorPrimaryTopic = Literal[
    "vehicle",
    "travel",
    "architecture",
    "technology_ai",
    "finance",
    "health",
    "food_culture",
    "family",
    "education",
    "spiritual_reflection",
    "general_curiosity",
    "other",
]

MIRROR_DIRECTOR_PRIMARY_TOPICS: frozenset[str] = frozenset(
    {
        "vehicle",
        "travel",
        "architecture",
        "technology_ai",
        "finance",
        "health",
        "food_culture",
        "family",
        "education",
        "spiritual_reflection",
        "general_curiosity",
        "other",
    }
)

# Free-text / alias → controlled topic
_TOPIC_ALIASES: dict[str, str] = {
    "tourism": "travel",
    "japan_travel": "travel",
    "trip": "travel",
    "journey": "travel",
    "urbanism": "architecture",
    "urban": "architecture",
    "wellness": "health",
    "fitness": "health",
    "ai": "technology_ai",
    "tech": "technology_ai",
    "technology": "technology_ai",
    "food": "food_culture",
    "culture": "food_culture",
    "spirit": "spiritual_reflection",
    "spiritual": "spiritual_reflection",
    "curiosity": "general_curiosity",
    "general": "general_curiosity",
}


def normalize_mirror_director_topic(raw: str | None) -> MirrorDirectorPrimaryTopic:
    """Map free / aliased topic strings onto the controlled enum (+ other)."""
    if not raw or not str(raw).strip():
        return "other"
    key = str(raw).strip().lower().replace("-", "_").replace(" ", "_")
    if key in MIRROR_DIRECTOR_PRIMARY_TOPICS:
        return key  # type: ignore[return-value]
    mapped = _TOPIC_ALIASES.get(key)
    if mapped and mapped in MIRROR_DIRECTOR_PRIMARY_TOPICS:
        return mapped  # type: ignore[return-value]
    return "other"


class MirrorMeaningAnalysis(BaseModel):
    """Structured meaning analysis produced before Mirror draft/scene (Director V1)."""

    schemaVersion: Literal["mirror-director-v1"] = MIRROR_DIRECTOR_SCHEMA_VERSION
    primaryTopic: MirrorDirectorPrimaryTopic
    """Normalized category — always equals a controlled enum value (same family as primaryTopic)."""
    topicCategory: MirrorDirectorPrimaryTopic
    secondaryTopics: List[str] = Field(default_factory=list, max_length=12)
    userIntent: str = Field(..., min_length=1, max_length=400)
    emotionalTone: List[str] = Field(default_factory=list, max_length=8)
    narrative: str = Field(..., min_length=1, max_length=800)
    visualMotifs: List[str] = Field(default_factory=list, max_length=12)
    forbiddenSymbols: List[str] = Field(default_factory=list, max_length=16)
    suggestedPalette: List[str] = Field(default_factory=list, max_length=8)
    suggestedComposition: str = Field(..., min_length=1, max_length=500)
    confidence: float = Field(..., ge=0.0, le=1.0)

    @field_validator("primaryTopic", "topicCategory", mode="before")
    @classmethod
    def _coerce_topic(cls, value: object) -> str:
        return normalize_mirror_director_topic(str(value) if value is not None else None)

    @field_validator("secondaryTopics", "emotionalTone", "visualMotifs", "forbiddenSymbols", "suggestedPalette", mode="before")
    @classmethod
    def _coerce_str_list(cls, value: object) -> list:
        if value is None:
            return []
        if not isinstance(value, list):
            return []
        out: list[str] = []
        for item in value:
            text = str(item).strip()
            if text:
                out.append(text[:120])
        return out


MirrorMeaningFailureCode = Literal[
    "timeout",
    "rate_limit",
    "invalid_json",
    "schema_validation",
    "provider_error",
    "low_confidence",
    "missing_api_key",
    "empty_snapshot",
]


class MirrorMeaningAnalysisFailure(BaseModel):
    ok: Literal[False] = False
    code: MirrorMeaningFailureCode
    message: str = Field(..., max_length=240)
    """Never include raw conversation or prompts."""
    retryable: bool = False


class MirrorMeaningAnalysisSuccess(BaseModel):
    ok: Literal[True] = True
    analysis: MirrorMeaningAnalysis
    model: Optional[str] = None
    latencyMs: Optional[int] = None
    """True when schema-valid but confidence is below the soft threshold (caller may prefer heuristic / defer to Director)."""
    belowConfidenceThreshold: bool = False


MirrorMeaningAnalysisResult = MirrorMeaningAnalysisSuccess | MirrorMeaningAnalysisFailure
