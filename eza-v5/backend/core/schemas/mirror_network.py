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
    """Frozen confirmed Q/A pair for journey_v1 publish (6–8 required)."""

    model_config = {"extra": "forbid"}

    stepIndex: int = Field(..., ge=1, le=8)
    sourceOrder: int = Field(..., ge=0)
    sourceUserMessageId: str = Field(..., min_length=1, max_length=128)
    sourceAssistantMessageId: str = Field(..., min_length=1, max_length=128)
    publicQuestion: str = Field(..., min_length=1)
    publicAnswer: str = Field(..., min_length=1)
    """Optional interaction-level EZA for this exact Q/A (Phase 4.2)."""
    ezaSnapshot: Optional[Dict[str, Any]] = None


class MirrorNetworkPublishRequest(BaseModel):
    """Stage 4C — auto-register Mirror to network on creation (authenticated)."""

    cardTitle: str = Field(..., min_length=1, max_length=200)
    cardDate: str = Field(..., min_length=8, max_length=10)
    conversationId: Optional[str] = Field(default=None, max_length=128)
    """When EZA_MIRROR_JOURNEY_V1 + conversationId: required. Identity = slug."""
    journeyId: Optional[str] = Field(default=None, max_length=64)
    """When journey mode: confirmed 6–8 frozen Q/A pairs from Review."""
    selectedSteps: Optional[List[MirrorJourneySelectedStep]] = Field(
        default=None, min_length=6, max_length=8
    )
    """Deterministic source-block identity — required in journey mode (do not infer)."""
    windowIndex: Optional[int] = Field(default=None, ge=0)
    windowStart: Optional[int] = Field(default=None, ge=0)
    windowEnd: Optional[int] = Field(default=None, ge=0)
    sceneImageUrl: Optional[str] = None
    curiosityBundle: Dict[str, Any]
    intelligencePrivate: Optional[Dict[str, Any]] = None
    safetyLevel: Optional[str] = "normal"
    parentSlug: Optional[str] = Field(default=None, max_length=64)
    """Alias for parentSlug (same-conversation deterministic chain)."""
    parentJourneyId: Optional[str] = Field(default=None, max_length=64)
    """Phase 3.6 — authoritative generation lineage from the generated artifact."""
    journeyVersion: Optional[int] = Field(default=None, ge=1, le=10_000)
    windowHash: Optional[str] = Field(default=None, max_length=128)
    sourceBlockHash: Optional[str] = Field(default=None, max_length=128)
    scopedInputHash: Optional[str] = Field(default=None, max_length=128)
    selectedStepsHash: Optional[str] = Field(default=None, max_length=128)
    interpretationHash: Optional[str] = Field(default=None, max_length=128)
    anchorsHash: Optional[str] = Field(default=None, max_length=128)
    publicLandingHash: Optional[str] = Field(default=None, max_length=128)
    mappedPromptHash: Optional[str] = Field(default=None, max_length=128)
    generationId: Optional[str] = Field(default=None, max_length=128)
    sceneAssetId: Optional[str] = Field(default=None, max_length=128)
    sourceConversationId: Optional[str] = Field(default=None, max_length=128)
    journeyGenerationLineage: Optional[Dict[str, Any]] = None
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


class PublicFrozenStepEzaSnapshot(BaseModel):
    """Allowlisted interaction-level EZA for public frozen replay (Phase 4.2)."""

    model_config = {"extra": "forbid"}

    assistantScore: Optional[float] = None
    userScore: Optional[float] = None
    ezaFinal: Optional[float] = None
    outputHealth: Optional[float] = None
    inputHealth: Optional[float] = None
    alignmentScore: Optional[float] = None
    redirect: Optional[bool] = None
    redirectBenign: Optional[bool] = None
    intent: Optional[str] = None


class PublicFrozenJourneyStep(BaseModel):
    """Public replay-safe frozen Q/A (+ optional EZA snapshot)."""

    model_config = {"extra": "forbid"}

    stepIndex: int = Field(ge=1, le=8)
    publicQuestion: str
    publicAnswer: str
    ezaSnapshot: Optional[PublicFrozenStepEzaSnapshot] = None


class PublicFrozenJourneyArtifact(BaseModel):
    """GET /api/mirror-network/{slug}/frozen — allowlisted public projection."""

    model_config = {"extra": "forbid"}

    slug: str
    journeyId: str
    journeyVersion: int = Field(ge=1)
    publicTitle: Optional[str] = None
    publicSummary: Optional[str] = None
    continuationContext: Optional[str] = None
    sceneImageUrl: Optional[str] = None
    authorUserId: str
    parentSlug: Optional[str] = None
    selectedCount: int = Field(ge=6, le=8)
    steps: List[PublicFrozenJourneyStep] = Field(default_factory=list)
    publishedAt: Optional[str] = None
    replayReady: bool = True


# Backward-compatible aliases (Phase 4 names → Phase 4.1 public DTOs).
FrozenJourneyPublicStep = PublicFrozenJourneyStep
FrozenJourneyArtifactPublicResponse = PublicFrozenJourneyArtifact


class OwnerPublishedJourneyItem(BaseModel):
    """Owner Ayna rehydration item — published durable identity only."""

    model_config = {"extra": "forbid"}

    slug: str
    journeyId: str
    journeyVersion: int
    artifactKind: Optional[str] = None
    freezeStatus: str
    publicTitle: Optional[str] = None
    publicSummary: Optional[str] = None
    continuationContext: Optional[str] = None
    sceneImageUrl: Optional[str] = None
    parentSlug: Optional[str] = None
    authorUserId: Optional[str] = None
    selectedCount: Optional[int] = None
    publishedAt: Optional[str] = None
    frozenAt: Optional[str] = None


class OwnerPublishedJourneysResponse(BaseModel):
    model_config = {"extra": "forbid"}

    conversationId: str
    items: List[OwnerPublishedJourneyItem] = Field(default_factory=list)
    total: int = Field(default=0, ge=0)
