# -*- coding: utf-8 -*-
"""EZA Mirror — standalone scene image generation (provider adapter)."""

from fastapi import APIRouter, Depends, Header, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.deps import security
from backend.auth.mirror_entitlement import MirrorSceneActor, require_mirror_scene_actor
from backend.core.account.guest_identity import GUEST_TOKEN_HEADER
from backend.core.account.guards import assert_can_create_visual
from backend.core.account.quota_events import MIRROR_CREATED
from backend.core.account.usage_service import record_account_usage_event
from backend.core.schemas.mirror_scene import (
    MirrorGenerateSceneRequest,
    MirrorGenerateSceneResponse,
)
from backend.core.utils.dependencies import get_db
from backend.security.rate_limit import rate_limit_standalone
from backend.services.mirror.mirror_scene_asset_store import ensure_persistable_mirror_scene_url
from backend.services.mirror.mirror_image_service import generate_mirror_scene

router = APIRouter(prefix="/api/standalone/mirror", tags=["Standalone — Mirror"])


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
    await assert_can_create_visual(
        db,
        credentials=credentials,
        guest_token=x_guest_token,
        user=actor.user,
    )

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
        from fastapi import HTTPException

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "ok": False,
                "code": "scene_asset_persist_failed",
                "message": "Mirror sahnesi şu an hazırlanamadı.",
            },
        )

    await record_account_usage_event(
        db,
        event_type=MIRROR_CREATED,
        user_id=user_id,
        guest_fingerprint=actor.guest_fingerprint,
        source_id=body.cardDate,
        metadata={"provider": provider},
    )
    await db.commit()

    return MirrorGenerateSceneResponse(
        sceneImageUrl=persisted_url,
        provider=provider,  # type: ignore[arg-type]
        cached=result.cached,
        generatedAt=result.generated_at or "",
    )
