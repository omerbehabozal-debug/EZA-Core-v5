# -*- coding: utf-8 -*-
"""EZA Mirror — standalone scene image generation (provider adapter)."""

import logging

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

logger = logging.getLogger(__name__)

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


def _journey_proof_unavailable_error(reason: str) -> HTTPException:
    """Authenticated Journey scene cannot be sealed without durable proof."""
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={
            "ok": False,
            "code": "journey_generation_proof_unavailable",
            "reason": reason,
            "message": "Yansı kimliği kalıcı olarak kaydedilemedi. Lütfen tekrar dene.",
        },
    )


def _is_authenticated_journey_seed(seed: dict | None) -> bool:
    """A Journey generation is one whose server record carries Journey lineage."""
    if not seed:
        return False
    return bool(
        str(seed.get("journeyId") or "").strip()
        and str(seed.get("interpretationHash") or "").strip()
        and str(seed.get("mappedPromptHash") or "").strip()
    )


async def _settle_durable_canonical_scene(
    db: AsyncSession,
    *,
    user_id,
    generation_id: str,
    client_conversation_id: str,
    asset_id: str,
    persisted_url: str,
) -> tuple[str, str]:
    """
    Settle the ONE canonical scene for this generationId in durable storage.

    Authenticated Journey: the bind is required and atomic. A failure raises
    503 so the client cannot seal READY. A scene already bound by another
    worker wins and is returned instead of this call's image.

    Non-Journey scene: durable proof is not part of publication authority,
    so a proof-store miss stays tolerated (savepoint, logged).

    Transaction ownership: the endpoint owns commit. This helper flushes and
    may roll back only its own savepoint on the tolerated path.
    """
    from backend.services.mirror.durable_journey_generation_proof import (
        DurableProofUnavailable,
        assert_durable_scene_proof_matches,
        bind_durable_canonical_scene,
        load_durable_journey_generation_proof,
        persist_durable_journey_generation_proof,
    )
    from backend.services.mirror.journey_generation_record import (
        adopt_canonical_scene_binding,
        get_journey_generation_record,
    )

    live = get_journey_generation_record(generation_id)
    durable_before = None
    try:
        durable_before = await load_durable_journey_generation_proof(
            db,
            user_id=user_id,
            generation_id=generation_id,
            client_conversation_id=client_conversation_id,
        )
    except Exception:
        logger.exception(
            "durable_generation_proof_preread_failed generationRequestId=%s",
            (generation_id or "")[:48],
        )
        if _is_authenticated_journey_seed(live):
            raise _journey_proof_unavailable_error("proof_read_failed") from None
        return asset_id, persisted_url

    seed = durable_before or live
    if not _is_authenticated_journey_seed(seed):
        # Tolerated legacy / non-Journey path — unchanged behavior.
        try:
            async with db.begin_nested():
                if seed:
                    await persist_durable_journey_generation_proof(
                        db,
                        user_id=user_id,
                        client_conversation_id=client_conversation_id,
                        fields={
                            "generationId": generation_id,
                            "sourceConversationId": seed.get("sourceConversationId")
                            or client_conversation_id,
                            "sceneAssetId": asset_id,
                            "sceneImageUrl": persisted_url,
                        },
                        commit=False,
                    )
        except Exception:
            logger.exception(
                "durable_generation_proof_scene_bind_skipped generationRequestId=%s",
                (generation_id or "")[:48],
            )
        return asset_id, persisted_url

    # Authenticated Journey — REQUIRED atomic bind under a row lock.
    try:
        outcome, canonical = await bind_durable_canonical_scene(
            db,
            user_id=user_id,
            client_conversation_id=client_conversation_id,
            generation_id=generation_id,
            scene_asset_id=asset_id,
            scene_image_url=persisted_url,
            seed=seed,
        )
    except DurableProofUnavailable as exc:
        raise _journey_proof_unavailable_error(exc.reason) from exc
    except Exception as exc:
        logger.exception(
            "durable_canonical_scene_bind_failed generationRequestId=%s",
            (generation_id or "")[:48],
        )
        raise _journey_proof_unavailable_error("proof_write_failed") from exc

    if outcome in ("no_conversation", "no_proof") or not canonical:
        raise _journey_proof_unavailable_error(outcome)

    canonical_asset = str(canonical.get("sceneAssetId") or "").strip().lower()
    canonical_url = str(canonical.get("sceneImageUrl") or "").strip()
    if not canonical_asset or not canonical_url:
        raise _journey_proof_unavailable_error("canonical_scene_incomplete")

    # The first canonical scene wins, even if this worker generated another.
    if canonical_asset != str(asset_id or "").strip().lower():
        adopt_canonical_scene_binding(
            generation_id,
            scene_asset_id=canonical_asset,
            scene_image_url=canonical_url,
        )
    asset_id = canonical_asset
    persisted_url = canonical_url

    try:
        verified = await load_durable_journey_generation_proof(
            db,
            user_id=user_id,
            generation_id=generation_id,
            client_conversation_id=client_conversation_id,
        )
        assert_durable_scene_proof_matches(
            verified,
            generation_id=generation_id,
            user_id=user_id,
            source_conversation_id=seed.get("sourceConversationId")
            or client_conversation_id,
            journey_id=seed.get("journeyId"),
            journey_version=seed.get("journeyVersion"),
            scene_asset_id=asset_id,
            scene_image_url=persisted_url,
        )
    except DurableProofUnavailable as exc:
        raise _journey_proof_unavailable_error(exc.reason) from exc
    except Exception as exc:
        logger.exception(
            "durable_canonical_scene_verify_failed generationRequestId=%s",
            (generation_id or "")[:48],
        )
        raise _journey_proof_unavailable_error("proof_verify_failed") from exc

    return asset_id, persisted_url


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

    if body.generationRequestId:
        from backend.services.mirror.durable_journey_generation_proof import (
            GenerationProofConflict,
            lookup_canonical_generated_scene,
        )

        canonical = None
        try:
            async with db.begin_nested():
                canonical = await lookup_canonical_generated_scene(
                    db,
                    generation_id=body.generationRequestId,
                    user_id=actor.user.id if actor.user is not None else None,
                    client_conversation_id=body.conversationId,
                )
        except GenerationProofConflict as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "ok": False,
                    "code": "scene_authority_conflict",
                    "reason": exc.field,
                    "message": "Bu Yansı sahnesi zaten mühürlü. İkinci sahne kabul edilmedi.",
                },
            ) from exc
        except Exception:
            # A proof-store miss must not block the first generation.
            # Conflict is handled above and still fails closed.
            logger.exception(
                "canonical_scene_lookup_failed generationRequestId=%s",
                (body.generationRequestId or "")[:48],
            )
            canonical = None
        if canonical and canonical.get("sceneImageUrl"):
            return MirrorGenerateSceneResponse(
                sceneImageUrl=canonical["sceneImageUrl"],
                provider="openai",
                cached=True,
                generatedAt="",
                generationRequestId=body.generationRequestId,
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

    # Phase 3.6b — bind the first canonical scene. A second asset cannot replace it.
    if body.generationRequestId:
        from backend.services.mirror.journey_generation_record import (
            bind_canonical_scene_asset,
            get_journey_generation_record,
        )
        from backend.services.mirror.scene_asset_identity import (
            resolve_scene_asset_id_from_url,
        )

        asset_id = resolve_scene_asset_id_from_url(persisted_url)
        if asset_id and get_journey_generation_record(body.generationRequestId):
            outcome, canonical_record = bind_canonical_scene_asset(
                body.generationRequestId,
                scene_asset_id=asset_id,
                scene_image_url=persisted_url,
            )
            if outcome == "conflict" and canonical_record:
                canonical_url = str(canonical_record.get("sceneImageUrl") or "").strip()
                if canonical_url:
                    persisted_url = canonical_url
                    asset_id = str(canonical_record.get("sceneAssetId") or asset_id)
                else:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail={
                            "ok": False,
                            "code": "scene_authority_conflict",
                            "message": "Bu Yansı sahnesi zaten mühürlü. İkinci sahne kabul edilmedi.",
                        },
                    )
            elif outcome == "idempotent" and canonical_record:
                canonical_url = str(canonical_record.get("sceneImageUrl") or "").strip()
                if canonical_url:
                    persisted_url = canonical_url
                    asset_id = str(canonical_record.get("sceneAssetId") or asset_id)
        # Durable canonical scene bind. For an authenticated Journey this is
        # REQUIRED: without it the client must not be able to seal READY.
        if asset_id and actor.user is not None:
            asset_id, persisted_url = await _settle_durable_canonical_scene(
                db,
                user_id=actor.user.id,
                generation_id=body.generationRequestId,
                client_conversation_id=body.conversationId,
                asset_id=asset_id,
                persisted_url=persisted_url,
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

            try:
                existing_node = await get_mirror_network_node_by_slug_for_user(
                    db,
                    user_id=actor.user.id,
                    slug=journey_slug,
                )
                if existing_node is not None:
                    existing_published_version = int(
                        getattr(existing_node, "journey_version", None) or 1
                    )
            except Exception:
                logger.exception(
                    "journey slug lookup failed slug=%s — continuing without published version",
                    journey_slug[:48],
                )
                existing_published_version = None

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

        try:
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
            # Durable SERVER-authored proof (survives TTL / restart / other workers).
            # Authenticated Journey: REQUIRED. Without it the client must not be
            # able to seal READY, so a failure fails the preparation.
            if actor.user is not None:
                try:
                    from backend.services.mirror.durable_journey_generation_proof import (
                        persist_durable_journey_generation_proof,
                    )

                    stored_proof = await persist_durable_journey_generation_proof(
                        db,
                        user_id=actor.user.id,
                        client_conversation_id=body.conversationId,
                        fields={
                            "generationId": body.generationRequestId,
                            "sourceConversationId": lineage["sourceConversationId"],
                            "journeyId": lineage["journeyId"],
                            "journeyVersion": lineage["journeyVersion"],
                            "windowIndex": lineage["windowIndex"],
                            "windowStart": lineage["windowStart"],
                            "windowEnd": lineage["windowEnd"],
                            "windowHash": lineage["windowHash"],
                            "scopedInputHash": lineage["scopedInputHash"],
                            "selectedStepsHash": lineage["selectedStepsHash"],
                            "sourceBlockHash": lineage.get("sourceBlockHash"),
                            "interpretationHash": interp_hash,
                            "mappedPromptHash": mapped_hash,
                        },
                        commit=True,
                    )
                except HTTPException:
                    raise
                except Exception as exc:
                    logger.exception(
                        "durable_generation_proof_persist_failed generationRequestId=%s",
                        body.generationRequestId[:48],
                    )
                    raise _journey_proof_unavailable_error("proof_write_failed") from exc
                if stored_proof is None:
                    # No owned conversation row can hold the proof, so this
                    # Journey could never publish. Fail now instead of at publish.
                    logger.warning(
                        "durable_generation_proof_unavailable generationRequestId=%s",
                        body.generationRequestId[:48],
                    )
                    raise _journey_proof_unavailable_error("conversation_not_synced")
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
        except HTTPException:
            raise
        except Exception:
            logger.exception(
                "journey lineage bind failed after prepare generationRequestId=%s",
                body.generationRequestId[:48],
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
