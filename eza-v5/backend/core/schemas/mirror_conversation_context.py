# -*- coding: utf-8 -*-
"""Mirror Conversation Context Package (PR D1).

Evidence-only understanding for the creative pipeline.
Does NOT prescribe visual interpretation, scenes, metaphors, or image prompts.
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend.core.schemas.mirror_draft import sanitize_display_text

MIRROR_CONVERSATION_CONTEXT_VERSION = "mirror-conversation-context-v1"

EpistemicStatus = Literal[
    "user_stated",
    "assistant_suggestion",
    "user_preference",
    "hypothesis",
    "uncertain",
    "accepted_decision",
    "rejected_option",
]

DetailKind = Literal[
    "entity",
    "preference",
    "constraint",
    "comparison",
    "correction",
    "question",
    "decision",
    "other",
]


class MirrorContextEvidenceRef(BaseModel):
    """Pointer back to a source message (no private IDs beyond index/sequence)."""

    model_config = ConfigDict(extra="forbid")

    messageIndex: int = Field(..., ge=0, le=10_000)
    role: Literal["user", "assistant"]
    excerpt: str = Field(..., min_length=1, max_length=160)
    sequence: Optional[int] = Field(default=None, ge=0, le=100_000)

    @field_validator("excerpt", mode="before")
    @classmethod
    def _clean_excerpt(cls, value: object) -> str:
        return sanitize_display_text(str(value or ""), max_len=160)


class MirrorContextMessageV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    messageIndex: int = Field(..., ge=0, le=10_000)
    role: Literal["user", "assistant"]
    text: str = Field(..., min_length=1, max_length=800)
    sequence: Optional[int] = Field(default=None, ge=0, le=100_000)

    @field_validator("text", mode="before")
    @classmethod
    def _clean_text(cls, value: object) -> str:
        return sanitize_display_text(str(value or ""), max_len=800)


class MirrorConversationArcV1(BaseModel):
    """Chronological journey beats — evidence excerpts only, not interpretation."""

    model_config = ConfigDict(extra="forbid")

    openingIntent: Optional[str] = Field(default=None, max_length=240)
    developmentBeats: List[str] = Field(default_factory=list, max_length=12)
    currentState: Optional[str] = Field(default=None, max_length=240)
    directionChanges: List[str] = Field(default_factory=list, max_length=8)

    @field_validator("openingIntent", "currentState", mode="before")
    @classmethod
    def _clean_optional(cls, value: object) -> Optional[str]:
        if value is None:
            return None
        text = sanitize_display_text(str(value), max_len=240)
        return text or None

    @field_validator("developmentBeats", "directionChanges", mode="before")
    @classmethod
    def _clean_list(cls, value: object) -> list[str]:
        if not isinstance(value, list):
            return []
        out: list[str] = []
        for item in value[:12]:
            text = sanitize_display_text(str(item or ""), max_len=200)
            if text:
                out.append(text)
        return out


class MirrorSalientDetailV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(..., min_length=1, max_length=200)
    kind: DetailKind = "other"
    speaker: Literal["user", "assistant"]
    epistemic: EpistemicStatus
    evidence: MirrorContextEvidenceRef

    @field_validator("text", mode="before")
    @classmethod
    def _clean_text(cls, value: object) -> str:
        return sanitize_display_text(str(value or ""), max_len=200)


class MirrorConversationContextDiagnosticsV1(BaseModel):
    """Safe observability — counts and reasons only (no full transcript)."""

    model_config = ConfigDict(extra="forbid")

    sourceMessageCount: int = Field(..., ge=0)
    selectedMessageCount: int = Field(..., ge=0)
    omittedMessageCount: int = Field(..., ge=0)
    userMessageCount: int = Field(..., ge=0)
    assistantMessageCount: int = Field(..., ge=0)
    charEstimate: int = Field(..., ge=0)
    truncationReason: Optional[str] = Field(default=None, max_length=80)
    correctionCount: int = Field(default=0, ge=0)
    preferenceCount: int = Field(default=0, ge=0)
    unresolvedQuestionCount: int = Field(default=0, ge=0)
    rejectedOptionCount: int = Field(default=0, ge=0)
    contextVersion: str = MIRROR_CONVERSATION_CONTEXT_VERSION


class MirrorConversationContextV1(BaseModel):
    """PR D1 — Conversation Understanding Context Package.

    creativeAuthority is always \"none\": D2+ may interpret; D1 must not.
    """

    model_config = ConfigDict(extra="forbid")

    version: Literal["mirror-conversation-context-v1"] = MIRROR_CONVERSATION_CONTEXT_VERSION
    conversationId: Optional[str] = Field(default=None, max_length=128)
    locale: Optional[str] = Field(default=None, max_length=16)
    messages: List[MirrorContextMessageV1] = Field(default_factory=list, max_length=40)
    conversationArc: MirrorConversationArcV1 = Field(default_factory=MirrorConversationArcV1)
    salientDetails: List[MirrorSalientDetailV1] = Field(default_factory=list, max_length=24)
    userPreferences: List[MirrorSalientDetailV1] = Field(default_factory=list, max_length=12)
    correctionsAndRevisions: List[MirrorSalientDetailV1] = Field(default_factory=list, max_length=12)
    unresolvedQuestions: List[MirrorSalientDetailV1] = Field(default_factory=list, max_length=12)
    factualGrounding: List[MirrorSalientDetailV1] = Field(default_factory=list, max_length=16)
    uncertaintyNotes: List[str] = Field(default_factory=list, max_length=12)
    exclusions: List[str] = Field(default_factory=list, max_length=16)
    sourceCoverage: Optional[str] = Field(default=None, max_length=240)
    diagnostics: MirrorConversationContextDiagnosticsV1
    """D1 never authorizes visual creative output."""
    creativeAuthority: Literal["none"] = "none"
