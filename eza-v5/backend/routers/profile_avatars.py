# -*- coding: utf-8 -*-
"""Public read-only profile avatar delivery."""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from backend.services.profile_avatar_store import (
    detect_image_mime,
    profile_avatar_response_headers,
    resolve_profile_avatar_path,
)

router = APIRouter()


@router.get(
    "/profile-avatars/{asset_filename}",
    summary="Get persisted user profile avatar",
    response_class=FileResponse,
)
async def get_profile_avatar(asset_filename: str) -> FileResponse:
    path = resolve_profile_avatar_path(asset_filename)
    if path is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar not found")

    data = path.read_bytes()
    media_type = detect_image_mime(data) or "application/octet-stream"
    return FileResponse(
        path,
        media_type=media_type,
        headers=profile_avatar_response_headers(media_type),
    )
