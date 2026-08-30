# -*- coding: utf-8 -*-
"""Mirror Network — public read API (Stage 1)."""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.core.schemas.mirror_network import (
    DiscoverMirrorListResponse,
    MirrorNetworkDebugReport,
    MirrorNetworkImpactStats,
    MirrorNetworkPublicPayload,
    MirrorNetworkPublishRequest,
    OwnerPublishedJourneysResponse,
    PublicFrozenJourneyArtifact,
    YansiPublicMetrics,
)
from backend.core.schemas.mirror_sohbet import (
    MirrorSohbetSessionRequest,
    MirrorSohbetSessionResponse,
)
from backend.auth.deps import security
from backend.core.account.guards import assert_can_start_discover_conversation
from backend.core.account.quota_events import DISCOVER_CONVERSATION_STARTED
from backend.core.account.usage_service import record_account_usage_event
from backend.security.rate_limit import rate_limit_standalone
from backend.auth.mirror_entitlement import require_mirror_authenticated_user
from backend.models.mirror_network import MirrorNetworkNode
from backend.models.production import User
from backend.services.mirror_network.fixtures import build_fixture_mirror_node
from backend.services.mirror_network.repository import create_mirror_network_node
from backend.core.utils.dependencies import get_db
from backend.auth.yansi_trust_admin import require_yansi_trust_admin_dependency
from backend.services.mirror_network.yansi_visibility_controls import (
    YansiNotFoundError,
    YansiOwnershipError,
    apply_yansi_safety_removal,
    set_yansi_visibility_for_owner,
    unpublish_yansi_for_owner,
)
from backend.services.mirror_network.yansi_report import (
    YansiReportTargetError,
    create_yansi_report,
)
from backend.services.mirror_network.discover import (
    DiscoverModeError,
    list_discover_mirrors,
)
from backend.services.mirror_network.publish import publish_mirror_to_network
from backend.services.mirror_network.impact import get_mirror_impact_stats
from backend.services.mirror_network.service import fetch_debug_mirror_by_slug, fetch_public_mirror_by_slug
from backend.services.mirror_network.sohbet_session import create_sohbet_session
from backend.services.mirror_network.author_profile import (
    list_owner_profile_yansilar,
    list_published_direct_children,
    list_published_mirrors_for_author,
)
from backend.services.mirror_network.frozen_journey_artifact import (
    get_public_frozen_journey_artifact,
    list_owner_published_journeys_for_conversation,
)
from backend.services.mirror_network.yansi_experience_events import (
    YansiExperienceIngestError,
    ingest_yansi_experience_event,
)
from backend.services.mirror_network.yansi_exposure import (
    YansiExposureIngestError,
    ingest_yansi_exposure_event,
)
from backend.security.production_surface import assert_non_production_surface
from backend.services.mirror_network.yansi_metrics import (
    YansiMetricsError,
    get_yansi_public_metrics,
)
from backend.core.observation.experience_event_rate_limit import (
    rate_limit_experience_events,
    rate_limit_yansi_actor_ingest,
)
from backend.auth.jwt import get_user_from_token
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional

router = APIRouter(prefix="/api/mirror-network", tags=["Mirror Network"])
debug_router = APIRouter(prefix="/api/debug/mirror-network", tags=["Debug — Mirror Network"])


class MirrorNetworkCapabilitiesResponse(BaseModel):
    """Phase 8.6 — FE/BE Journey V1 flag parity surface (read-only)."""

    model_config = ConfigDict(extra="forbid")

    journeyV1Enabled: bool
    artifactKind: str = "journey_v1"
    clientFlag: str = "NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1"
    serverFlag: str = "EZA_MIRROR_JOURNEY_V1"


@router.get("/capabilities", response_model=MirrorNetworkCapabilitiesResponse)
async def get_mirror_network_capabilities(
    _: None = Depends(rate_limit_standalone),
) -> MirrorNetworkCapabilitiesResponse:
    """
    Public read of Journey V1 enablement so clients can detect FE/BE flag skew.
    Does not expose secrets or internal scoring.
    """
    from backend.services.mirror_network.journey_identity import (
        mirror_journey_v1_enabled,
    )

    return MirrorNetworkCapabilitiesResponse(
        journeyV1Enabled=bool(mirror_journey_v1_enabled()),
    )


def _configured_debug_secret() -> str | None:
    settings = get_settings()
    return (
        (settings.EZA_DEBUG_SECRET or "").strip()
        or (os.getenv("DEBUG_SECRET") or "").strip()
        or None
    )


def _verify_debug_access(
    x_debug_secret: str | None = Header(default=None, alias="X-Debug-Secret"),
    debug_secret: str | None = Header(default=None, alias="DEBUG_SECRET"),
) -> None:
    assert_non_production_surface(surface="debug/mirror-network")
    expected = _configured_debug_secret()
    if not expected:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    provided = (x_debug_secret or debug_secret or "").strip()
    if not provided or provided != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"ok": False, "error": "debug_secret_required", "message": "Unauthorized"},
        )


@router.post(
    "/publish",
    response_model=MirrorNetworkPublicPayload,
    status_code=status.HTTP_201_CREATED,
)
async def publish_mirror_network_node(
    body: MirrorNetworkPublishRequest,
    user: User = Depends(require_mirror_authenticated_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_standalone),
) -> MirrorNetworkPublicPayload:
    """
    Register Mirror to network on creation — share link is prepared automatically.

    No separate user-facing publish step; curiosity-only public payload.
    """
    return await publish_mirror_to_network(db, user, body)


@router.get("/discover", response_model=DiscoverMirrorListResponse)
async def get_mirror_network_discover(
    limit: int = 24,
    offset: int = 0,
    mode: Optional[str] = None,
    randomSession: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_standalone),
) -> DiscoverMirrorListResponse:
    """
    Public discover list — root Aynalar only.

    Modes: random (default / Rastlantısal), newest (En Yeni), strong_curiosity (Güçlü Merak).
    Güçlü Merak uses the frozen Phase 7.4.2 policy when STRONG_CURIOSITY_DISCOVER_ENABLED.
    May include public authorDisplayName + publicHonorific (display only).
    Never returns userId, email, guest tokens, raw conversation, or private payload.
    """
    try:
        return await list_discover_mirrors(
            db,
            limit=limit,
            offset=offset,
            mode=mode,
            random_session=randomSession,
        )
    except DiscoverModeError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"ok": False, "error": exc.reason},
        ) from exc


class AuthorPublishedYansiItem(BaseModel):
    model_config = {"extra": "forbid"}

    slug: str
    shareUrl: str
    publicTitle: str
    publicSummary: Optional[str] = None
    sceneImageUrl: Optional[str] = None
    publishedAt: Optional[str] = None
    parentSlug: Optional[str] = None
    journeyVersion: Optional[int] = Field(default=None, ge=1)
    experienceStartedCount: Optional[int] = Field(default=None, ge=0)
    directChildYansiCount: Optional[int] = Field(default=None, ge=0)


class AuthorPublishedYansiResponse(BaseModel):
    """GET /api/mirror-network/authors/{userId}/published — published only."""

    model_config = {"extra": "forbid"}

    userId: str
    displayName: str
    publicHonorific: str = "curious"
    publicAvatarUrl: Optional[str] = None
    publicAvatarRevision: int = 0
    items: List[AuthorPublishedYansiItem] = Field(default_factory=list)
    total: int = Field(default=0, ge=0)


class OwnerProfileYansiItem(AuthorPublishedYansiItem):
    visibility: Optional[str] = None
    safetyStatus: Optional[str] = None
    isPublicListable: Optional[bool] = None


class OwnerProfileYansiResponse(BaseModel):
    """GET /api/mirror-network/me/profile-yansilar — owner inventory only."""

    model_config = {"extra": "forbid"}

    userId: str
    displayName: str
    publicDisplayName: Optional[str] = None
    publicHonorific: str = "curious"
    publicAvatarUrl: Optional[str] = None
    publicAvatarRevision: int = 0
    items: List[OwnerProfileYansiItem] = Field(default_factory=list)
    total: int = Field(default=0, ge=0)
    view: str = "owner"


class ParentChildrenYansiResponse(BaseModel):
    """Direct published child Yansılar eligible for public frozen continuation."""

    model_config = {"extra": "forbid"}

    parentSlug: str
    parentTitle: Optional[str] = None
    items: List[AuthorPublishedYansiItem] = Field(default_factory=list)
    total: int = Field(default=0, ge=0)


@router.get(
    "/authors/{user_id}/published",
    response_model=AuthorPublishedYansiResponse,
)
async def get_author_published_yansilar(
    user_id: UUID,
    response: Response,
    limit: int = 48,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_standalone),
) -> AuthorPublishedYansiResponse:
    """
    Public author profile contract — published Yansılar only.

    Never exposes generating / ready / failed private Ayna panel states.
    Phase 8.5 — displayName never email-derived; Cache-Control no-store for
    visibility / identity freshness.
    """
    response.headers["Cache-Control"] = "no-store"
    payload = await list_published_mirrors_for_author(
        db, user_id=user_id, limit=limit, offset=offset
    )
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "author_not_found", "message": "Author not found"},
        )
    return AuthorPublishedYansiResponse(**payload)


@router.get(
    "/me/profile-yansilar",
    response_model=OwnerProfileYansiResponse,
)
async def get_owner_profile_yansilar(
    response: Response,
    limit: int = 48,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_mirror_authenticated_user),
    _: None = Depends(rate_limit_standalone),
) -> OwnerProfileYansiResponse:
    """Owner-only inventory including non-public Yansılar (Phase 8.5)."""
    response.headers["Cache-Control"] = "no-store"
    payload = await list_owner_profile_yansilar(
        db, owner_user_id=user.id, limit=limit, offset=offset
    )
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "author_not_found", "message": "Author not found"},
        )
    return OwnerProfileYansiResponse(**payload)


@router.get(
    "/me/conversations/{conversation_id}/published-journeys",
    response_model=OwnerPublishedJourneysResponse,
)
async def get_owner_published_journeys_for_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_mirror_authenticated_user),
    _: None = Depends(rate_limit_standalone),
) -> OwnerPublishedJourneysResponse:
    """
    Owner Ayna rehydration — published Journey identities from durable server state.

    Generating/ready unpublished artifacts remain client-local (documented).
    """
    items = await list_owner_published_journeys_for_conversation(
        db,
        user_id=user.id,
        conversation_id=conversation_id,
    )
    return OwnerPublishedJourneysResponse(
        conversationId=conversation_id,
        items=items,
        total=len(items),
    )


@router.get("/{slug}/children", response_model=ParentChildrenYansiResponse)
async def get_mirror_network_children(
    slug: str,
    limit: int = 48,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_standalone),
) -> ParentChildrenYansiResponse:
    """Direct published child Yansılar of a public parent — frozen replay-ready only."""
    payload = await list_published_direct_children(
        db, parent_slug=slug, limit=limit, offset=offset
    )
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "mirror_not_found", "message": "Mirror not found"},
        )
    return ParentChildrenYansiResponse(**payload)


@router.get("/{slug}/frozen", response_model=PublicFrozenJourneyArtifact)
async def get_frozen_published_journey(
    slug: str,
    journeyVersion: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_standalone),
) -> PublicFrozenJourneyArtifact:
    """
    Public Frozen Journey Artifact (Phase 4.1 allowlisted projection).

    Returns only replay-safe fields. Non-frozen / incomplete → 404.
    """
    public = await get_public_frozen_journey_artifact(
        db, slug=slug, journey_version=journeyVersion
    )
    if public is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "frozen_journey_not_found",
                "message": "Frozen published Journey not found or not replay-ready",
            },
        )
    return PublicFrozenJourneyArtifact.model_validate(public)


@router.get("/{slug}/metrics", response_model=YansiPublicMetrics)
async def get_yansi_metrics(
    slug: str,
    journeyVersion: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_standalone),
) -> YansiPublicMetrics:
    """
    Phase 6.1 — public aggregate metrics for a replayable Yansı.

    Independent of /frozen. Does not return viewer identity or ranking.
    Default version = current published Journey version.
    """
    try:
        payload = await get_yansi_public_metrics(
            db, slug=slug, journey_version=journeyVersion
        )
    except YansiMetricsError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.reason, "message": "Yansı metrics not found"},
        ) from exc
    return YansiPublicMetrics.model_validate(payload)


class YansiExperienceEventRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    eventId: str = Field(..., min_length=8, max_length=36)
    experienceSessionId: str = Field(..., min_length=8, max_length=36)
    eventType: str = Field(..., min_length=1, max_length=64)
    journeyVersion: int
    completedStepCount: Optional[int] = None
    destinationSlug: Optional[str] = Field(None, max_length=128)
    occurredAt: Optional[str] = None


class YansiExperienceEventResponse(BaseModel):
    accepted: bool
    duplicate: bool = False
    reason: Optional[str] = None


def _optional_viewer_user_id(
    credentials: HTTPAuthorizationCredentials | None,
) -> str | None:
    if credentials is None:
        return None
    user = get_user_from_token(credentials.credentials)
    if not user:
        return None
    uid = user.get("user_id") or user.get("sub")
    return str(uid).strip() or None if uid else None


@router.post(
    "/{slug}/experience-events",
    response_model=YansiExperienceEventResponse,
)
async def post_yansi_experience_event(
    slug: str,
    body: YansiExperienceEventRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> YansiExperienceEventResponse:
    """
    Phase 6.0 — durable started/completed/skipped ingest.
    Best-effort measurement; never returns ranking or viewer identity.
    """
    viewer_user_id = _optional_viewer_user_id(credentials)
    await rate_limit_experience_events(
        request,
        user_id=viewer_user_id,
        guest_token_hash=body.experienceSessionId[:16],
    )
    await rate_limit_yansi_actor_ingest(
        request, user_id=viewer_user_id, kind="experience"
    )
    try:
        result = await ingest_yansi_experience_event(
            db,
            slug=slug,
            payload=body.model_dump(),
            viewer_user_id=viewer_user_id,
        )
    except YansiExperienceIngestError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"accepted": False, "duplicate": False, "reason": exc.reason},
        ) from exc
    return YansiExperienceEventResponse(**result)


class YansiExposureEventRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    eventId: str = Field(..., min_length=8, max_length=36)
    exposureSessionId: str = Field(..., min_length=8, max_length=36)
    journeyVersion: int
    context: str = Field(..., min_length=1, max_length=32)
    occurredAt: Optional[str] = None


class YansiExposureEventResponse(BaseModel):
    accepted: bool
    duplicate: bool = False
    reason: Optional[str] = None


@router.post(
    "/{slug}/exposure-events",
    response_model=YansiExposureEventResponse,
)
async def post_yansi_exposure_event(
    slug: str,
    body: YansiExposureEventRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> YansiExposureEventResponse:
    """
    Phase 6.4 — durable meaningful-visibility ingest.
    Best-effort measurement; never blocks Discover/landing/chain.
    """
    viewer_user_id = _optional_viewer_user_id(credentials)
    await rate_limit_experience_events(
        request,
        user_id=viewer_user_id,
        guest_token_hash=body.exposureSessionId[:16],
    )
    await rate_limit_yansi_actor_ingest(
        request, user_id=viewer_user_id, kind="exposure"
    )
    try:
        result = await ingest_yansi_exposure_event(
            db,
            slug=slug,
            payload=body.model_dump(),
            viewer_user_id=viewer_user_id,
        )
    except YansiExposureIngestError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"accepted": False, "duplicate": False, "reason": exc.reason},
        ) from exc
    return YansiExposureEventResponse(**result)


@router.get("/{slug}/impact", response_model=MirrorNetworkImpactStats)
async def get_mirror_network_impact(
    slug: str,
    user: User = Depends(require_mirror_authenticated_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_standalone),
) -> MirrorNetworkImpactStats:
    """
    Owner-only aggregate stats for a Mirror node.

    Returns counts only — never actor identity, conversation content, or raw events.
    """
    return await get_mirror_impact_stats(db, slug, user.id)


class YansiUnpublishResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str
    slug: str
    visibility: str
    safetyStatus: str


class YansiVisibilityRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    visibility: str = Field(..., min_length=1, max_length=20)


class YansiVisibilityResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str
    slug: str
    visibility: str
    safetyStatus: str
    reason: Optional[str] = None


class YansiReportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(..., min_length=1, max_length=32)


class YansiReportResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str
    slug: str
    reason: str


class YansiSafetyRemoveResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str
    slug: str
    visibility: str
    safetyStatus: str


@router.post("/{slug}/unpublish", response_model=YansiUnpublishResponse)
async def unpublish_mirror_network_yansi(
    slug: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_mirror_authenticated_user),
    _: None = Depends(rate_limit_standalone),
) -> YansiUnpublishResponse:
    """Owner withdraw — stops Discover, profile, direct link, frozen, sohbet."""
    try:
        result = await unpublish_yansi_for_owner(
            db, slug=slug, owner_user_id=user.id
        )
    except YansiNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "mirror_not_found", "message": "Yansı bulunamadı"},
        ) from exc
    except YansiOwnershipError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "forbidden", "message": "Bu Yansı için yetkin yok"},
        ) from exc
    return YansiUnpublishResponse(
        status=result.status,
        slug=result.slug,
        visibility=result.visibility,
        safetyStatus=result.safety_status,
    )


@router.post("/{slug}/visibility", response_model=YansiVisibilityResponse)
async def set_mirror_network_yansi_visibility(
    slug: str,
    body: YansiVisibilityRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_mirror_authenticated_user),
    _: None = Depends(rate_limit_standalone),
) -> YansiVisibilityResponse:
    """Owner toggle public ↔ unlisted (Discover off while keeping link-access)."""
    try:
        result = await set_yansi_visibility_for_owner(
            db,
            slug=slug,
            owner_user_id=user.id,
            visibility=body.visibility,
        )
    except YansiNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "mirror_not_found", "message": "Yansı bulunamadı"},
        ) from exc
    except YansiOwnershipError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "forbidden", "message": "Bu Yansı için yetkin yok"},
        ) from exc
    if result.status == "rejected":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": result.reason or "visibility_rejected",
                "message": "Görünürlük değiştirilemedi",
            },
        )
    return YansiVisibilityResponse(
        status=result.status,
        slug=result.slug,
        visibility=result.visibility,
        safetyStatus=result.safety_status,
        reason=result.reason,
    )


@router.post("/{slug}/report", response_model=YansiReportResponse)
async def report_mirror_network_yansi(
    slug: str,
    body: YansiReportRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_mirror_authenticated_user),
    _: None = Depends(rate_limit_standalone),
) -> YansiReportResponse:
    """Minimal authenticated report — does not auto-hide or affect ranking/metrics."""
    try:
        result = await create_yansi_report(
            db,
            slug=slug,
            reporter_user_id=user.id,
            reason=body.reason,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "invalid_reason", "message": "Geçersiz bildirim nedeni"},
        ) from exc
    except YansiReportTargetError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "mirror_not_found", "message": "Yansı bulunamadı"},
        ) from exc
    return YansiReportResponse(
        status=result.status,
        slug=result.slug,
        reason=result.reason,
    )


@router.post("/{slug}/safety-remove", response_model=YansiSafetyRemoveResponse)
async def safety_remove_mirror_network_yansi(
    slug: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_yansi_trust_admin_dependency()),
) -> YansiSafetyRemoveResponse:
    """
    Post-publish safety removal — restricted + private.

    Phase 8.4.1: production-safe trust admin key (X-Api-Key), separate from
    Phase 8.1 require_internal() which remains non-production-only.
    """
    try:
        result = await apply_yansi_safety_removal(db, slug=slug)
    except YansiNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "mirror_not_found", "message": "Yansı bulunamadı"},
        ) from exc
    return YansiSafetyRemoveResponse(
        status=result.status,
        slug=result.slug,
        visibility=result.visibility,
        safetyStatus=result.safety_status,
    )


@router.get("/{slug}", response_model=MirrorNetworkPublicPayload)
async def get_public_mirror(
    slug: str,
    db: AsyncSession = Depends(get_db),
) -> MirrorNetworkPublicPayload:
    """
    Public Mirror Network payload — curiosity seed only.

    Never returns raw conversation, user identity, behavioral analysis,
    full intelligence, or private metadata.
    """
    return await fetch_public_mirror_by_slug(db, slug)


@router.post(
    "/{slug}/sohbet/session",
    response_model=MirrorSohbetSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def start_mirror_sohbet_session(
    slug: str,
    body: MirrorSohbetSessionRequest | None = None,
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    _: None = Depends(rate_limit_standalone),
) -> MirrorSohbetSessionResponse:
    """
    Start a guest sohbet from public mirror curiosity only.

    Never uses private payload, raw conversation, or user identity.
    """
    guest = body.guestToken if body else None
    subject = await assert_can_start_discover_conversation(
        db,
        credentials=credentials,
        guest_token=guest,
        mirror_slug=slug,
        record_on_success=False,
    )
    result = await create_sohbet_session(db, slug, guest)
    await record_account_usage_event(
        db,
        event_type=DISCOVER_CONVERSATION_STARTED,
        user_id=subject.user_id,
        guest_fingerprint=subject.guest_fingerprint,
        source_id=slug,
        metadata={"mirrorSlug": slug},
    )
    await db.commit()
    return result


@debug_router.get("/{slug}", response_model=MirrorNetworkDebugReport)
async def debug_mirror_network_node(
    slug: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_verify_debug_access),
) -> MirrorNetworkDebugReport:
    """Dev-only validation — public/private separation audit (no private payload body)."""
    return await fetch_debug_mirror_by_slug(db, slug)


@debug_router.post("/seed-fixture", response_model=MirrorNetworkPublicPayload)
async def seed_mirror_network_fixture(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_verify_debug_access),
) -> MirrorNetworkPublicPayload:
    """Insert a QA fixture node when debug secret is configured."""
    record = build_fixture_mirror_node(slug_suffix="seed01")
    node = MirrorNetworkNode(
        id=record.id,
        slug=record.slug,
        user_id=record.user_id,
        conversation_id=record.conversation_id,
        visibility=record.visibility,
        safety_status=record.safety_status,
        card_title=record.card_title,
        card_date=record.card_date,
        scene_image_url=record.scene_image_url,
        public_payload=record.public_payload,
        private_payload=record.private_payload,
        parent_slug=record.parent_slug,
        created_at=record.created_at,
        published_at=record.published_at,
    )
    created = await create_mirror_network_node(db, node)
    return await fetch_public_mirror_by_slug(db, created.slug)
