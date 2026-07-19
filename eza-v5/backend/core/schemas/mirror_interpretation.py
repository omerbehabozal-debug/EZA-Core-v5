# -*- coding: utf-8 -*-
"""Mirror Interpretation V1 schema (PR D2).

Creative decision object — not a rendering recipe.
D0: title is metadata only; never burned into the image prompt as typography.
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend.core.schemas.mirror_draft import sanitize_display_text

MIRROR_INTERPRETATION_SCHEMA_VERSION = "mirror-interpretation-v1"


class MirrorInterpretationV1(BaseModel):
    """Single creative authority for Mirror scene intent (PR D2)."""

    model_config = ConfigDict(extra="forbid")

    version: Literal["mirror-interpretation-v1"] = MIRROR_INTERPRETATION_SCHEMA_VERSION
    """UI/landing title only — must not be embedded as image typography (D0)."""
    title: str = Field(..., min_length=2, max_length=64)
    interpretationSummary: str = Field(..., min_length=8, max_length=400)
    rationale: str = Field(..., min_length=8, max_length=600)
    """What the image should make another person feel/understand."""
    imageIntent: str = Field(..., min_length=8, max_length=500)
    """Free-form natural scene narrative — creative, not a checklist."""
    visualNarrative: str = Field(..., min_length=24, max_length=900)
    exclusions: List[str] = Field(default_factory=list, max_length=16)
    confidence: float = Field(..., ge=0.0, le=1.0)
    topicCategory: Optional[str] = Field(default=None, max_length=64)
    """Optional free atmosphere language (not a camera/lighting recipe)."""
    atmosphereHint: Optional[str] = Field(default=None, max_length=200)

    @field_validator(
        "title",
        "interpretationSummary",
        "rationale",
        "imageIntent",
        "visualNarrative",
        "topicCategory",
        "atmosphereHint",
        mode="before",
    )
    @classmethod
    def _clean_text(cls, value: object) -> Optional[str]:
        if value is None:
            return None
        return sanitize_display_text(str(value), max_len=900)

    @field_validator("exclusions", mode="before")
    @classmethod
    def _clean_exclusions(cls, value: object) -> list[str]:
        if not isinstance(value, list):
            return []
        out: list[str] = []
        for item in value[:16]:
            text = sanitize_display_text(str(item or ""), max_len=80)
            if text:
                out.append(text)
        return out


class MirrorInterpretationDiagnosticsV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    interpretationVersion: str = MIRROR_INTERPRETATION_SCHEMA_VERSION
    interpretationSource: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    evidenceCoverage: Optional[str] = Field(default=None, max_length=240)
    latencyMs: int = Field(default=0, ge=0)
    rolloutArm: str = Field(..., max_length=32)
    interpretationHash: Optional[str] = Field(default=None, max_length=64)
