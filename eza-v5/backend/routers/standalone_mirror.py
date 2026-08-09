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
from backend.core.schemas.mirror_narrative_alignment import (
    MirrorDetectImageClaimsRequest,
    MirrorDetectImageClaimsResponse,
)
from backend.core.utils.dependencies import get_db
from backend.security.rate_limit import rate_limit_standalone
from backend.services.mirror.mirror_scene_asset_store import ensure_persistable_mirror_scene_url
from backend.services.mirror.mirror_image_service import generate_mirror_scene
from backend.services.mirror.mirror_director_prepare import prepare_mirror_director_draft
from backend.services.mirror.mirror_director_telemetry import emit_director_event
from backend.services.mirror.narrative_alignment_detect import detect_image_claims

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
        generation_id=body.generationRequestId,
        generation_pipeline=body.generationPipeline,
        final_scene_prompt_hash=body.finalScenePromptHash,
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

    # Phase 3.6b — bind scene asset to the same generationId used at prepare.
    if body.generationRequestId:
        from backend.services.mirror.journey_generation_record import (
            bind_scene_asset_to_generation,
            get_journey_generation_record,
        )
        from backend.services.mirror.scene_asset_identity import (
            resolve_scene_asset_id_from_url,
        )

        asset_id = resolve_scene_asset_id_from_url(persisted_url)
        if asset_id and get_journey_generation_record(body.generationRequestId):
            bind_scene_asset_to_generation(
                body.generationRequestId,
                scene_asset_id=asset_id,
                scene_image_url=persisted_url,
            )

    await db.commit()

    return MirrorGenerateSceneResponse(
        sceneImageUrl=persisted_url,
        provider=provider,  # type: ignore[arg-type]
        cached=result.cached,
        generatedAt=result.generated_at or "",
        generationRequestId=body.generationRequestId,
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

    # Scope cache by authenticated user or guest fingerprint (no cross-account reuse).
    scope_key: str | None = None
    if subject.is_authenticated and actor.user is not None:
        scope_key = f"user:{str(actor.user.id)}"
    elif subject.guest_fingerprint:
        scope_key = f"guest:{subject.guest_fingerprint}"

    journey_meta = None
    if body.journeySemanticScope is not None:
        from backend.services.mirror.journey_semantic_scope import (
            append_journey_scope_key,
            validate_journey_semantic_scope,
        )

        existing_published_version = None
        journey_slug = str(body.journeySemanticScope.journeyId or "").strip().lower()
        if (
            subject.is_authenticated
            and actor.user is not None
            and journey_slug
        ):
            from backend.services.mirror_network.repository import (
                get_mirror_network_node_by_slug_for_user,
            )

            existing_node = await get_mirror_network_node_by_slug_for_user(
                db,
                user_id=actor.user.id,
                slug=journey_slug,
            )
            if existing_node is not None:
                existing_published_version = int(
                    getattr(existing_node, "journey_version", None) or 1
                )

        journey_meta = validate_journey_semantic_scope(
            journey_scope=body.journeySemanticScope.model_dump(),
            messages=[m.model_dump() for m in body.messages],
            existing_published_version=existing_published_version,
            request_conversation_id=body.conversationId,
        )
        scope_key = append_journey_scope_key(scope_key, journey_meta)
        emit_director_event(
            "journey_semantic_scope_bound",
            generationRequestId=body.generationRequestId[:48],
            conversationId=body.conversationId[:48],
            journeyId=str(journey_meta.get("journeyId") or "")[:48],
            semanticScope=journey_meta.get("semanticScope"),
            windowIndex=journey_meta.get("windowIndex"),
            windowHash=str(journey_meta.get("windowHash") or "")[:48] or None,
            scopedInputHash=str(journey_meta.get("scopedInputHash") or "")[:48] or None,
            selectedStepsHash=str(journey_meta.get("selectedStepsHash") or "")[:48]
            or None,
            journeyVersion=journey_meta.get("journeyVersion"),
        )

    # Journey scoped prepare: messages alone are semantic input — ignore chat title/summary.
    prepare_title = None if journey_meta is not None else body.title
    prepare_summary = None if journey_meta is not None else body.conversationSummary

    result = await prepare_mirror_director_draft(
        conversation_id=body.conversationId,
        generation_request_id=body.generationRequestId,
        messages=list(body.messages),
        title=prepare_title,
        conversation_summary=prepare_summary,
        scope_key=scope_key,
    )
    if journey_meta is not None:
        from backend.services.mirror.journey_generation_lineage import (
            build_journey_generation_lineage,
        )
        from backend.services.mirror.mirror_interpretation_to_v5 import (
            interpretation_hash as interp_hash_fn,
        )
        import hashlib

        interp_hash = None
        if result.finalInterpretation is not None:
            interp_hash = interp_hash_fn(result.finalInterpretation)
        mapped_hash = None
        if result.mappedPrompt and result.mappedPrompt.prompt:
            mapped_hash = hashlib.sha256(
                result.mappedPrompt.prompt.strip().encode("utf-8")
            ).hexdigest()

        lineage = build_journey_generation_lineage(
            journey_id=str(journey_meta.get("journeyId") or ""),
            journey_version=int(journey_meta.get("journeyVersion") or 1),
            source_conversation_id=str(
                journey_meta.get("sourceConversationId") or body.conversationId
            ),
            window_index=int(journey_meta.get("windowIndex") or 0),
            window_start=int(journey_meta.get("windowStart") or 0),
            window_end=int(journey_meta.get("windowEnd") or 0),
            window_hash=str(journey_meta.get("windowHash") or ""),
            scoped_input_hash=str(journey_meta.get("scopedInputHash") or ""),
            selected_steps_hash=str(journey_meta.get("selectedStepsHash") or ""),
            generation_id=body.generationRequestId,
            interpretation_hash=interp_hash,
            mapped_prompt_hash=mapped_hash,
            parent_journey_id=journey_meta.get("parentJourneyId"),
            source_block_hash=str(journey_meta.get("sourceBlockHash") or "") or None,
            selected_count=int(journey_meta.get("selectedCount") or 0) or None,
            selected_steps=journey_meta.get("selectedSteps"),
        )
        from backend.services.mirror.journey_generation_record import (
            upsert_journey_generation_record,
        )

        upsert_journey_generation_record(
            body.generationRequestId,
            {
                "journeyId": lineage["journeyId"],
                "journeyVersion": lineage["journeyVersion"],
                "sourceConversationId": lineage["sourceConversationId"],
                "parentJourneyId": lineage.get("parentJourneyId"),
                "windowIndex": lineage["windowIndex"],
                "windowStart": lineage["windowStart"],
                "windowEnd": lineage["windowEnd"],
                "blockIndex": lineage.get("blockIndex"),
                "blockStart": lineage.get("blockStart"),
                "blockEnd": lineage.get("blockEnd"),
                "windowHash": lineage["windowHash"],
                "sourceBlockHash": lineage.get("sourceBlockHash"),
                "scopedInputHash": lineage["scopedInputHash"],
                "selectedStepsHash": lineage["selectedStepsHash"],
                "selectedCount": lineage.get("selectedCount"),
                "interpretationHash": interp_hash,
                "mappedPromptHash": mapped_hash,
            },
        )
        result = result.model_copy(
            update={
                "semanticScope": journey_meta.get("semanticScope"),
                "semanticSourceJourneyId": journey_meta.get("journeyId"),
                "semanticWindowIndex": journey_meta.get("windowIndex"),
                "semanticWindowHash": journey_meta.get("windowHash"),
                "scopedInputHash": journey_meta.get("scopedInputHash"),
                "selectedStepsHash": journey_meta.get("selectedStepsHash"),
                "journeyVersion": journey_meta.get("journeyVersion"),
                "journeyGenerationLineage": lineage,
            }
        )
    if result.usedDirector and result.mappedPrompt:
        emit_director_event(
            "prepare_ready_for_image",
            generationRequestId=body.generationRequestId[:48],
            contentHash=result.contentHash,
            titleSource=result.mappedPrompt.titleSource,
            semanticScope=result.semanticScope,
            journeyId=(result.semanticSourceJourneyId or "")[:48] or None,
        )
    return result


@router.post(
    "/detect-image-claims",
    response_model=MirrorDetectImageClaimsResponse,
    status_code=status.HTTP_200_OK,
)
async def detect_image_claims_endpoint(
    body: MirrorDetectImageClaimsRequest,
    actor: MirrorSceneActor = Depends(require_mirror_scene_actor),
    _: None = Depends(rate_limit_standalone),
) -> MirrorDetectImageClaimsResponse:
    """
    Lightweight vision claim detection for Narrative Alignment Phase 1.
    Structured claims only — no beauty/composition/mood scores.
    """
    _ = actor  # auth required; no quota consume
    result = await detect_image_claims(scene_image_url=body.sceneImageUrl)
    return MirrorDetectImageClaimsResponse(
        detectedClaims=[{"type": c.type, "value": c.value} for c in result.detectedClaims],
        source=result.source,  # type: ignore[arg-type]
        generationId=body.generationId,
    )
