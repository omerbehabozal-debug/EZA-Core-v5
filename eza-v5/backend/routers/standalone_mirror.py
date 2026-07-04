# -*- coding: utf-8 -*-
"""EZA Mirror — standalone scene image generation (provider adapter)."""

from fastapi import APIRouter, Depends, status

from backend.auth.mirror_entitlement import require_mirror_authenticated_user
from backend.core.schemas.mirror_scene import (
    MirrorGenerateSceneRequest,
    MirrorGenerateSceneResponse,
)
from backend.models.production import User
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
    _user: User = Depends(require_mirror_authenticated_user),
    _: None = Depends(rate_limit_standalone),
) -> MirrorGenerateSceneResponse:
    """
    Generate a textless Daily Mirror scene image from visual prompt metadata only.
    No chat/message content is accepted or forwarded to providers.
    """
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
    return MirrorGenerateSceneResponse(
        sceneImageUrl=persisted_url,
        provider=provider,  # type: ignore[arg-type]
        cached=result.cached,
        generatedAt=result.generated_at or "",
    )
