# -*- coding: utf-8 -*-
"""Mirror Draft + Director Review schemas (PR B).

Versions:
- mirror-draft-v1
- mirror-director-review-v1

Not wired to production create-path. No image generation / quota.
"""

from __future__ import annotations

import re
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from backend.core.schemas.mirror_director import (
    MirrorDirectorPrimaryTopic,
    normalize_mirror_director_topic,
)

MIRROR_DRAFT_SCHEMA_VERSION: Literal["mirror-draft-v1"] = "mirror-draft-v1"
MIRROR_DIRECTOR_REVIEW_SCHEMA_VERSION: Literal["mirror-director-review-v1"] = (
    "mirror-director-review-v1"
)

# Align with frontend conversationMirrorV2 seasonRegistry — do not invent parallel systems.
MirrorArtDirectionId = Literal[
    "bright_cinematic",
    "night_discovery",
    "editorial_magazine",
    "film_poster",
    "quiet_luxury",
    "golden_hour",
]

MIRROR_ART_DIRECTION_IDS: frozenset[str] = frozenset(
    {
        "bright_cinematic",
        "night_discovery",
        "editorial_magazine",
        "film_poster",
        "quiet_luxury",
        "golden_hour",
    }
)

MirrorNarrativeAngle = Literal[
    "unexpected_discovery",
    "quiet_transformation",
    "earned_confidence",
    "playful_curiosity",
    "architectural_precision",
    "personal_milestone",
    "adaptive_plan",
    "reflective_pause",
    "other",
]

MIRROR_NARRATIVE_ANGLES: frozenset[str] = frozenset(
    {
        "unexpected_discovery",
        "quiet_transformation",
        "earned_confidence",
        "playful_curiosity",
        "architectural_precision",
        "personal_milestone",
        "adaptive_plan",
        "reflective_pause",
        "other",
    }
)

DirectorDecision = Literal["approve", "revise"]

DirectorReasonCode = Literal[
    "topic_mismatch",
    "narrative_mismatch",
    "generic_title",
    "unsupported_motif",
    "forbidden_symbol_conflict",
    "cliche_representation",
    "weak_scene_specificity",
    "emotional_tone_mismatch",
    "art_direction_mismatch",
    "composition_problem",
    "unsafe_or_disallowed_content",
    "schema_quality_issue",
    "other",
]

DIRECTOR_REASON_CODES: frozenset[str] = frozenset(
    {
        "topic_mismatch",
        "narrative_mismatch",
        "generic_title",
        "unsupported_motif",
        "forbidden_symbol_conflict",
        "cliche_representation",
        "weak_scene_specificity",
        "emotional_tone_mismatch",
        "art_direction_mismatch",
        "composition_problem",
        "unsafe_or_disallowed_content",
        "schema_quality_issue",
        "other",
    }
)

DraftSource = Literal[
    "llm_draft_approved",
    "llm_draft_revised",
    "heuristic_draft",
    "safe_fallback",
    "interpretation_llm",
    "interpretation_heuristic",
]

GENERIC_TITLES: frozenset[str] = frozenset(
    {
        "yeni bir başlangıç",
        "yolculuk",
        "keşif",
        "anılar",
        "sessizlik",
        "new beginning",
        "journey",
        "discovery",
        "memories",
        "silence",
        "travel",
        "health",
        "architecture",
        "ayna",
        "mirror",
    }
)

_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_HTML_RE = re.compile(r"<[^>]+>")
_URL_RE = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)
_INJECTION_RE = re.compile(
    r"(ignore (all|previous|above) instructions|system prompt|developer message|"
    r"you are now|jailbreak|<\/?script)",
    re.IGNORECASE,
)


def sanitize_display_text(value: str, *, max_len: int) -> str:
    text = str(value or "")
    text = _CONTROL_CHARS_RE.sub("", text)
    text = _HTML_RE.sub("", text)
    text = _URL_RE.sub("", text)
    text = re.sub(r"\s+", " ", text).strip()
    if _INJECTION_RE.search(text):
        text = _INJECTION_RE.sub("", text).strip()
    return text[:max_len].strip()


def normalize_art_direction(raw: str | None) -> MirrorArtDirectionId:
    key = (raw or "").strip().lower().replace("-", "_").replace(" ", "_")
    aliases = {
        "cinematic": "bright_cinematic",
        "night": "night_discovery",
        "editorial": "editorial_magazine",
        "magazine": "editorial_magazine",
        "film": "film_poster",
        "poster": "film_poster",
        "luxury": "quiet_luxury",
        "golden": "golden_hour",
        "goldenhour": "golden_hour",
    }
    if key in MIRROR_ART_DIRECTION_IDS:
        return key  # type: ignore[return-value]
    mapped = aliases.get(key)
    if mapped in MIRROR_ART_DIRECTION_IDS:
        return mapped  # type: ignore[return-value]
    return "editorial_magazine"


def normalize_narrative_angle(raw: str | None) -> MirrorNarrativeAngle:
    key = (raw or "").strip().lower().replace("-", "_").replace(" ", "_")
    if key in MIRROR_NARRATIVE_ANGLES:
        return key  # type: ignore[return-value]
    return "other"


def _dedupe_list(values: list[str], *, max_items: int, max_item_len: int = 80) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in values:
        text = sanitize_display_text(str(item), max_len=max_item_len)
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(text)
        if len(out) >= max_items:
            break
    return out


class MirrorDraftEvidenceMap(BaseModel):
    """Internal only — never send to image prompt or public payload."""

    model_config = ConfigDict(extra="forbid")

    titleEvidence: List[str] = Field(default_factory=list, max_length=8)
    motifEvidence: List[str] = Field(default_factory=list, max_length=12)
    narrativeEvidence: List[str] = Field(default_factory=list, max_length=8)


class MirrorDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schemaVersion: Literal["mirror-draft-v1"] = MIRROR_DRAFT_SCHEMA_VERSION
    title: str = Field(..., min_length=2, max_length=64)
    subtitle: Optional[str] = Field(default=None, max_length=96)
    coreIdea: str = Field(..., min_length=8, max_length=240)
    narrativeAngle: MirrorNarrativeAngle
    artDirection: MirrorArtDirectionId
    sceneDescription: str = Field(..., min_length=24, max_length=700)
    visualMotifs: List[str] = Field(default_factory=list, max_length=10)
    forbiddenSymbols: List[str] = Field(default_factory=list, max_length=16)
    palette: List[str] = Field(default_factory=list, max_length=6)
    composition: str = Field(..., min_length=8, max_length=220)
    lighting: str = Field(..., min_length=4, max_length=160)
    camera: str = Field(..., min_length=4, max_length=120)
    typographyMood: str = Field(..., min_length=4, max_length=80)
    emotionalTone: List[str] = Field(default_factory=list, max_length=6)
    topicCategory: MirrorDirectorPrimaryTopic
    confidence: float = Field(..., ge=0.0, le=1.0)
    """Internal grounding — omitted from image prompts."""
    evidence: Optional[MirrorDraftEvidenceMap] = None

    @field_validator("title", "coreIdea", "sceneDescription", "composition", "lighting", "camera", "typographyMood", mode="before")
    @classmethod
    def _sanitize_required(cls, value: object) -> str:
        text = sanitize_display_text(str(value or ""), max_len=700)
        if not text:
            raise ValueError("required field empty after sanitize")
        return text

    @field_validator("subtitle", mode="before")
    @classmethod
    def _sanitize_subtitle(cls, value: object) -> str | None:
        if value is None:
            return None
        text = sanitize_display_text(str(value), max_len=96)
        return text or None

    @field_validator("artDirection", mode="before")
    @classmethod
    def _coerce_art(cls, value: object) -> str:
        return normalize_art_direction(str(value) if value is not None else None)

    @field_validator("narrativeAngle", mode="before")
    @classmethod
    def _coerce_angle(cls, value: object) -> str:
        return normalize_narrative_angle(str(value) if value is not None else None)

    @field_validator("topicCategory", mode="before")
    @classmethod
    def _coerce_topic(cls, value: object) -> str:
        return normalize_mirror_director_topic(str(value) if value is not None else None)

    @field_validator("visualMotifs", "forbiddenSymbols", "palette", "emotionalTone", mode="before")
    @classmethod
    def _coerce_lists(cls, value: object) -> list:
        if value is None:
            return []
        if not isinstance(value, list):
            return []
        return [str(x) for x in value]

    @model_validator(mode="after")
    def _normalize_lists_and_conflicts(self) -> MirrorDraft:
        self.visualMotifs = _dedupe_list(self.visualMotifs, max_items=10)
        self.forbiddenSymbols = _dedupe_list(self.forbiddenSymbols, max_items=16)
        self.palette = _dedupe_list(self.palette, max_items=6)
        self.emotionalTone = _dedupe_list(self.emotionalTone, max_items=6)
        forbidden_l = {f.lower() for f in self.forbiddenSymbols}
        self.visualMotifs = [m for m in self.visualMotifs if m.lower() not in forbidden_l]
        if self.subtitle and self.subtitle.strip().lower() == self.title.strip().lower():
            self.subtitle = None
        self.title = sanitize_display_text(self.title, max_len=64)
        self.coreIdea = sanitize_display_text(self.coreIdea, max_len=240)
        self.sceneDescription = sanitize_display_text(self.sceneDescription, max_len=700)
        return self


class MirrorDirectorReview(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schemaVersion: Literal["mirror-director-review-v1"] = MIRROR_DIRECTOR_REVIEW_SCHEMA_VERSION
    decision: DirectorDecision
    overallScore: float = Field(..., ge=0.0, le=1.0)
    reasonCodes: List[DirectorReasonCode] = Field(default_factory=list, max_length=8)
    summary: str = Field(..., min_length=1, max_length=400)
    requiredChanges: List[str] = Field(default_factory=list, max_length=8)
    revisedDraft: Optional[MirrorDraft] = None
    confidence: float = Field(..., ge=0.0, le=1.0)

    @field_validator("summary", mode="before")
    @classmethod
    def _sanitize_summary(cls, value: object) -> str:
        text = sanitize_display_text(str(value or ""), max_len=400)
        if not text:
            raise ValueError("summary empty")
        return text

    @field_validator("reasonCodes", mode="before")
    @classmethod
    def _coerce_reasons(cls, value: object) -> list:
        if not isinstance(value, list):
            return []
        out: list[str] = []
        for item in value:
            key = str(item).strip().lower().replace("-", "_").replace(" ", "_")
            if key in DIRECTOR_REASON_CODES and key not in out:
                out.append(key)
        return out[:8]

    @field_validator("requiredChanges", mode="before")
    @classmethod
    def _coerce_changes(cls, value: object) -> list:
        if not isinstance(value, list):
            return []
        return _dedupe_list([str(x) for x in value], max_items=8, max_item_len=160)

    @model_validator(mode="after")
    def _revise_requires_draft(self) -> MirrorDirectorReview:
        if self.decision == "revise" and self.revisedDraft is None:
            # Allow schema parse; orchestrator treats missing revisedDraft as fallback.
            pass
        if self.decision == "approve":
            self.revisedDraft = None
        return self


class MirrorDirectorMetadataContract(BaseModel):
    """Planned persist shape for PR C — not written to DB in PR B."""

    model_config = ConfigDict(extra="forbid")

    analysisSchemaVersion: str = "mirror-director-v1"
    draftSchemaVersion: str = MIRROR_DRAFT_SCHEMA_VERSION
    reviewSchemaVersion: str = MIRROR_DIRECTOR_REVIEW_SCHEMA_VERSION
    analysisSource: str
    draftSource: DraftSource
    analysisConfidence: Optional[float] = None
    draftConfidence: Optional[float] = None
    directorConfidence: Optional[float] = None
    directorDecision: Optional[DirectorDecision] = None
    directorReasonCodes: List[DirectorReasonCode] = Field(default_factory=list)
    revisionCount: Literal[0, 1] = 0
    fallbackReason: Optional[str] = None
    topicCategory: MirrorDirectorPrimaryTopic
    draftDurationMs: Optional[int] = None
    reviewDurationMs: Optional[int] = None
    totalDirectorDurationMs: Optional[int] = None
    contentHash: str
    draftModel: Optional[str] = None
    reviewModel: Optional[str] = None


class MirrorDirectorOrchestratorResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    finalDraft: MirrorDraft
    draftSource: DraftSource
    directorDecision: Optional[DirectorDecision] = None
    directorReasonCodes: List[DirectorReasonCode] = Field(default_factory=list)
    revisionCount: Literal[0, 1] = 0
    fallbackReason: Optional[str] = None
    draftDurationMs: int = 0
    reviewDurationMs: int = 0
    totalDurationMs: int = 0
    contentHash: str
    metadata: MirrorDirectorMetadataContract
    """Internal evidence retained for tests — never public."""
    internalEvidence: Optional[MirrorDraftEvidenceMap] = None
