# -*- coding: utf-8 -*-
"""EZA Mirror — standalone scene image generation (provider adapter)."""

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.deps import security
from backend.auth.mirror_entitlement import MirrorSceneActor, require_mirror_scene_actor
from backend.core.account.guest_identity import GUEST_TOKEN_HEADER
from backend.core.account.quota_events import MIRROR_CREATED
from backend.core.account.subject import resolve_account_subject
from backend.core.account.tiers import get_entitlements_for_tier
from backend.core.account.usage_service import UsageQuotaExceeded, consume_usage_event_atomic
from backend.core.account.visual_source import (
    VisualSourceIdError,
    build_visual_source_id,
    content_hash_for_visual,
)
from backend.core.account.guards import recommended_tier_for_upgrade
from backend.core.schemas.mirror_scene import (
    MirrorGenerateSceneRequest,
    MirrorGenerateSceneResponse,
)
from backend.core.schemas.mirror_prepare_director import (
    MirrorPrepareDirectorDraftRequest,
    MirrorPrepareDirectorDraftResponse,
)
from backend.core.utils.dependencies import get_db
from backend.security.rate_limit import rate_limit_standalone
from backend.services.mirror.mirror_scene_asset_store import ensure_persistable_mirror_scene_url
from backend.services.mirror.mirror_image_service import generate_mirror_scene
from backend.services.mirror.mirror_director_prepare import prepare_mirror_director_draft
from backend.services.mirror.mirror_director_telemetry import emit_director_event

router = APIRouter(prefix="/api/standalone/mirror", tags=["Standalone — Mirror"])


def _quota_error_response(exc: UsageQuotaExceeded) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "allowed": False,
            "reason": exc.reason,
            "upgradeRequired": exc.upgrade_required,
            "currentTier": exc.tier.value,
            "recommendedTier": recommended_tier_for_upgrade(exc.tier),
            "nextVisualAvailableAt": exc.next_visual_available_at,
        },
    )


def _resolve_visual_source_id(body: MirrorGenerateSceneRequest, actor: MirrorSceneActor) -> str:
    content_hash = content_hash_for_visual(
        prompt=body.prompt,
        seed_hint=body.seedHint,
        style_preset=body.stylePreset,
    )
    guest_scope = actor.guest_fingerprint if actor.user is None else None
    try:
        return build_visual_source_id(
            conversation_id=body.conversationId,
            generation_request_id=body.generationRequestId,
            card_id=body.cardId,
            card_date=body.cardDate,
            content_hash=content_hash,
            guest_scope=guest_scope,
        )
    except VisualSourceIdError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "allowed": False,
                "reason": "visual_source_id_required",
                "message": str(exc),
            },
        ) from exc


@router.post(
    "/generate-scene",
    response_model=MirrorGenerateSceneResponse,
    status_code=status.HTTP_200_OK,
)
async def generate_mirror_scene_endpoint(
    body: MirrorGenerateSceneRequest,
    actor: MirrorSceneActor = Depends(require_mirror_scene_actor),
    db: AsyncSession = Depends(get_db),
    credentials=Depends(security),
    x_guest_token: str | None = Header(None, alias=GUEST_TOKEN_HEADER),
    _: None = Depends(rate_limit_standalone),
) -> MirrorGenerateSceneResponse:
    """
    Generate a textless Daily Mirror scene image from visual prompt metadata only.
    Authenticated users and guests (X-Guest-Token) may consume visual quota.
    """
    user_id = str(actor.user.id) if actor.user is not None else None
    subject = await resolve_account_subject(
        db,
        credentials=credentials,
        guest_token=x_guest_token,
    )

    if not subject.is_authenticated and not subject.guest_fingerprint:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "allowed": False,
                "reason": "guest_token_required",
                "upgradeRequired": False,
                "currentTier": subject.tier.value,
                "recommendedTier": None,
                "header": GUEST_TOKEN_HEADER,
            },
        )

    source_id = _resolve_visual_source_id(body, actor)
    entitlements = get_entitlements_for_tier(subject.tier)

    try:
        await consume_usage_event_atomic(
            db,
            event_type=MIRROR_CREATED,
            user_id=user_id,
            guest_fingerprint=actor.guest_fingerprint,
            source_id=source_id,
            tier=subject.tier,
            entitlements=entitlements,
            metadata={"lineage": "mirror"},
        )
    except UsageQuotaExceeded as exc:
        raise _quota_error_response(exc) from exc

    result = await generate_mirror_scene(
        prompt=body.prompt,
        negative_prompt=body.negativePrompt,
        seed_hint=body.seedHint,
        style_preset=body.stylePreset,
        card_date=body.cardDate,
        quality_hints=body.qualityHints,
        prompt_contract=body.promptContract,
    )
    provider = result.provider
    if provider not in ("mock", "openai", "replicate", "stability"):
        provider = "mock"
    persisted_url = ensure_persistable_mirror_scene_url(result.scene_image_url)
    if not persisted_url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "ok": False,
                "code": "scene_asset_persist_failed",
                "message": "Mirror sahnesi şu an hazırlanamadı.",
            },
        )

    await db.commit()

    return MirrorGenerateSceneResponse(
        sceneImageUrl=persisted_url,
        provider=provider,  # type: ignore[arg-type]
        cached=result.cached,
        generatedAt=result.generated_at or "",
    )


@router.post(
    "/prepare-director-draft",
    response_model=MirrorPrepareDirectorDraftResponse,
    status_code=status.HTTP_200_OK,
)
async def prepare_director_draft_endpoint(
    body: MirrorPrepareDirectorDraftRequest,
    actor: MirrorSceneActor = Depends(require_mirror_scene_actor),
    db: AsyncSession = Depends(get_db),
    credentials=Depends(security),
    x_guest_token: str | None = Header(None, alias=GUEST_TOKEN_HEADER),
    _: None = Depends(rate_limit_standalone),
) -> MirrorPrepareDirectorDraftResponse:
    """
    Run Meaning → Draft → Director Review and map to V5 prompt fields.

    Does NOT consume visual quota and does NOT generate images.
    Flag-off returns directorEnabled=False with zero LLM calls.
    """
    # Auth parity with generate-scene (guest or user)
    subject = await resolve_account_subject(
        db,
        credentials=credentials,
        guest_token=x_guest_token,
    )
    if not subject.is_authenticated and not subject.guest_fingerprint:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "allowed": False,
                "reason": "guest_token_required",
                "header": GUEST_TOKEN_HEADER,
            },
        )

    # db unused for quota — keep session for subject resolution only
    _ = actor
    result = await prepare_mirror_director_draft(
        conversation_id=body.conversationId,
        generation_request_id=body.generationRequestId,
        messages=list(body.messages),
        title=body.title,
        conversation_summary=body.conversationSummary,
    )
    if result.usedDirector and result.mappedPrompt:
        emit_director_event(
            "prepare_ready_for_image",
            generationRequestId=body.generationRequestId[:48],
            contentHash=result.contentHash,
            titleSource=result.mappedPrompt.titleSource,
        )
    return result
