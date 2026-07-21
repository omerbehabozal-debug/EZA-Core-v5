# -*- coding: utf-8 -*-
"""Schemas for Mirror Director prepare-director-draft (PR C)."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend.core.schemas.mirror_draft import (
    MirrorDirectorMetadataContract,
    MirrorDraft,
    sanitize_display_text,
)
from backend.core.schemas.mirror_conversation_context import MirrorConversationContextV1
from backend.core.schemas.mirror_interpretation import MirrorInterpretationV1


class MirrorConversationMessageDTO(BaseModel):
    """Permitted frontend → backend conversation message (no private metadata)."""

    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    text: str = Field(..., min_length=1, max_length=4000)
    sequence: Optional[int] = Field(default=None, ge=0, le=100_000)

    @field_validator("text", mode="before")
    @classmethod
    def _clean_text(cls, value: object) -> str:
        text = sanitize_display_text(str(value or ""), max_len=4000)
        if not text:
            raise ValueError("empty message text")
        return text


class MirrorPrepareDirectorDraftRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    conversationId: str = Field(..., min_length=1, max_length=128)
    generationRequestId: str = Field(..., min_length=8, max_length=128)
    title: Optional[str] = Field(default=None, max_length=160)
    messages: List[MirrorConversationMessageDTO] = Field(..., min_length=1, max_length=200)
    conversationSummary: Optional[str] = Field(default=None, max_length=400)


class MirrorV5MappedPrompt(BaseModel):
    """Typed fields for existing V5 / generate-scene prompt path."""

    model_config = ConfigDict(extra="forbid")

    title: str
    topicCategory: str
    season: str
    mood: Optional[str] = None
    prompt: str = Field(..., min_length=12, max_length=2000)
    negativePrompt: str = Field(default="", max_length=2000)
    promptContract: Literal["saina_mirror_v5_minimal"] = "saina_mirror_v5_minimal"
    titleSource: str
    artDirectionSource: str


class MirrorPrepareDirectorDraftResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    directorEnabled: bool
    usedDirector: bool
    reusedCache: bool = False
    """LEGACY | SHADOW | SOFT | FULL"""
    directorMode: str = "LEGACY"
    directorExecuted: bool = False
    directorAffectedOutput: bool = False
    applyTitle: bool = False
    applyPrompt: bool = False
    finalDraft: Optional[MirrorDraft] = None
    mappedPrompt: Optional[MirrorV5MappedPrompt] = None
    """Shadow/compare only — never applied to user output when affectUserOutput is false."""
    shadowMappedPrompt: Optional[MirrorV5MappedPrompt] = None
    metadata: Optional[MirrorDirectorMetadataContract] = None
    fallbackReason: Optional[str] = None
    contentHash: Optional[str] = None
    message: Optional[str] = None
    titleSource: Optional[str] = None
    promptSource: Optional[str] = None
    """PR D1 — evidence package; creativeAuthority is always none (not visual authority)."""
    conversationContext: Optional[MirrorConversationContextV1] = None
    """PR D2 — creative interpretation (authority when rollout uses interpretation v1)."""
    finalInterpretation: Optional[MirrorInterpretationV1] = None
