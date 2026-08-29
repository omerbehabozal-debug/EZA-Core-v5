# -*- coding: utf-8 -*-
"""Public read-only profile avatar delivery."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.utils.dependencies import get_db
from backend.services.production_auth import load_public_avatar_blob
from backend.services.profile_avatar_store import (
    detect_image_mime,
    profile_avatar_response_headers,
    resolve_profile_avatar_path,
    user_id_from_avatar_filename,
)

router = APIRouter()


@router.get(
    "/profile-avatars/{asset_filename}",
    summary="Get persisted user profile avatar",
)
async def get_profile_avatar(
    asset_filename: str,
    db: AsyncSession = Depends(get_db),
):
    user_id = user_id_from_avatar_filename(asset_filename)
    if user_id:
        loaded = await load_public_avatar_blob(db, user_id)
        if loaded is not None:
            data, media_type = loaded
            return Response(
                content=data,
                media_type=media_type,
                headers=profile_avatar_response_headers(media_type),
            )

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
