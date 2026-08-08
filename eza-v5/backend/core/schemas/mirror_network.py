# -*- coding: utf-8 -*-
"""Pydantic schemas — Mirror Network public/private contract (Stage 1)."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


MirrorSafetyStatus = Literal["open", "review", "restricted"]
MirrorVisibility = Literal["public", "unlisted", "private"]
MirrorSafetyTierPublic = Literal["open", "review"]


class MirrorSeedPublic(BaseModel):
    """Public-safe curiosity seed — no user identity or conversation traces."""

    topicCategory: str
    mood: str
    subtopics: List[str] = Field(default_factory=list)
    curiosityHooks: List[str] = Field(default_factory=list)
    seedQuestions: List[str] = Field(default_factory=list)
    locale: str = "tr"
    lineage: Optional[str] = None
    safetyTier: MirrorSafetyTierPublic = "open"


class MirrorNetworkPublicPayload(BaseModel):
    """Exactly what GET /api/mirror-network/{slug} may return."""

    slug: str
    shareUrl: str
    cardTitle: str
    cardDate: str
    sceneImageUrl: Optional[str] = None
    coreCuriosity: str
    curiosityContext: str
    landingContext: str
    hooks: List[str] = Field(default_factory=list)
    seedQuestions: List[str] = Field(default_factory=list)
    discoverySignals: List[str] = Field(default_factory=list)
    collectionTags: List[str] = Field(default_factory=list)
    seed: MirrorSeedPublic
    lineage: Optional[str] = None
    shareVoice: Optional[str] = None
    # Public landing contract v1 (preferred over curiosityContext for UI)
    publicTitle: Optional[str] = None
    publicSummary: Optional[str] = None
    continuationContext: Optional[str] = None
    contractVersion: Optional[str] = None
    interpretationHash: Optional[str] = None
    publicLandingHash: Optional[str] = None
    semanticSource: Optional[str] = None
    # Phase 1 Semantic Anchors — optional; Vision Verify not required.
    semanticAnchors: Optional[Dict[str, Any]] = None


# Stage 2 landing UI: show at most this many hooks / seed starters (card shows none).
LANDING_MAX_HOOKS_DISPLAY = 3
LANDING_MAX_SEED_QUESTIONS_DISPLAY = 2


class MirrorNetworkPrivatePayload(BaseModel):
    """Owner/internal metadata — never returned by public endpoints."""

    userId: str
    conversationId: Optional[str] = None
    mirrorBody: Optional[str] = None
    topicSummary: Optional[str] = None
    evidenceLabels: List[str] = Field(default_factory=list)
    intelligenceBrief: Optional[Dict[str, Any]] = None
    behavioralSnapshot: Optional[Dict[str, Any]] = None
    curiosityPipeline: Optional[Dict[str, Any]] = None


class MirrorNetworkPublicAudit(BaseModel):
    passed: bool
    forbiddenKeysFound: List[str] = Field(default_factory=list)
    forbiddenValuePatternsFound: List[str] = Field(default_factory=list)


class MirrorNetworkSafetyGateResult(BaseModel):
    passed: bool
    reason: Optional[str] = None
    safetyStatus: MirrorSafetyStatus
    visibility: MirrorVisibility


class MirrorNetworkDebugReport(BaseModel):
    slug: str
    shareUrl: str
    safety: MirrorNetworkSafetyGateResult
    publicAudit: MirrorNetworkPublicAudit
    publicPayload: MirrorNetworkPublicPayload
    privatePayloadPresent: bool
    privateFieldCount: int
    philosophyCheck: str


class MirrorJourneySelectedStep(BaseModel):
    """Frozen Review 8 Q/A pair for journey_v1 publish (exactly 8 required)."""

    model_config = {"extra": "forbid"}

    index: int = Field(..., ge=1, le=8)
    userMessageId: str = Field(..., min_length=1, max_length=128)
    assistantMessageId: str = Field(..., min_length=1, max_length=128)
    publicQuestion: str = Field(..., min_length=1)
    publicAnswer: str = Field(..., min_length=1)


class MirrorNetworkPublishRequest(BaseModel):
    """Stage 4C — auto-register Mirror to network on creation (authenticated)."""

    cardTitle: str = Field(..., min_length=1, max_length=200)
    cardDate: str = Field(..., min_length=8, max_length=10)
    conversationId: Optional[str] = Field(default=None, max_length=128)
    """When EZA_MIRROR_JOURNEY_V1 + conversationId: required. Identity = slug."""
    journeyId: Optional[str] = Field(default=None, max_length=64)
    """When journey mode: exactly 8 frozen Q/A pairs from Review 8."""
    selectedSteps: Optional[List[MirrorJourneySelectedStep]] = None
    sceneImageUrl: Optional[str] = None
    curiosityBundle: Dict[str, Any]
    intelligencePrivate: Optional[Dict[str, Any]] = None
    safetyLevel: Optional[str] = "normal"
    parentSlug: Optional[str] = Field(default=None, max_length=64)
    lineageProofToken: Optional[str] = Field(default=None, max_length=64)
    guestToken: Optional[str] = Field(default=None, max_length=256)


class DiscoverMirrorItem(BaseModel):
    """Public discover card — root Ayna only."""

    slug: str
    title: str
    description: Optional[str] = None
    sceneImageUrl: Optional[str] = None
    yansiCount: int = Field(default=0, ge=0)
    createdAt: Optional[str] = None


class DiscoverMirrorListResponse(BaseModel):
    """GET /api/mirror-network/discover"""

    model_config = {"extra": "forbid"}

    items: List[DiscoverMirrorItem] = Field(default_factory=list)
    total: int = Field(default=0, ge=0)


class MirrorNetworkImpactStats(BaseModel):
    """Owner-only aggregate impact — no identity or private mirror payload."""

    model_config = {"extra": "forbid"}

    mirrorId: str
    publicSlug: str
    shareUrl: str
    continuationStarts: int = Field(default=0, ge=0)
    continuationStartsVerified: bool = False
    yansiCount: int = Field(default=0, ge=0)
    landingViews: int = Field(default=0, ge=0)
