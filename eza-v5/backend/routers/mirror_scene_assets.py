# -*- coding: utf-8 -*-
"""Public read-only mirror scene asset delivery."""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from backend.services.mirror.mirror_scene_asset_store import (
    detect_image_mime,
    resolve_mirror_scene_asset_path,
)

router = APIRouter()


@router.get(
    "/mirror-scene-assets/{asset_filename}",
    summary="Get persisted mirror scene image",
    response_class=FileResponse,
)
async def get_mirror_scene_asset(asset_filename: str) -> FileResponse:
    path = resolve_mirror_scene_asset_path(asset_filename)
    if path is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    data = path.read_bytes()
    media_type = detect_image_mime(data) or "application/octet-stream"
    return FileResponse(
        path,
        media_type=media_type,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    )
