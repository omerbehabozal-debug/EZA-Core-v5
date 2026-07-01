# -*- coding: utf-8 -*-
"""
EZA Observation — experience event ingest API.

POST /api/eza/experience-events

EZA observes. SAINA decides.
This endpoint never returns actions, prompts, or UX decisions.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.observation.experience_event_auth import get_optional_current_user
from backend.core.observation.experience_event_privacy import validate_body_size
from backend.core.observation.experience_event_rate_limit import rate_limit_experience_events
from backend.core.observation.experience_event_service import ingest_experience_event
from backend.core.observation.log_experience_event import hash_guest_token
from backend.core.utils.dependencies import get_db

router = APIRouter(prefix="/api/eza", tags=["EZA Observation"])


class ExperienceEventRequest(BaseModel):
    productId: str = Field(..., min_length=1, max_length=64)
    productVersion: Optional[str] = Field(None, max_length=64)
    eventType: str = Field(..., min_length=1, max_length=96)
    sessionId: Optional[str] = Field(None, max_length=255)
    guestToken: Optional[str] = Field(None, max_length=512)
    conversationId: Optional[str] = Field(None, max_length=255)
    mirrorId: Optional[str] = Field(None, max_length=255)
    rootMirrorId: Optional[str] = Field(None, max_length=255)
    parentMirrorId: Optional[str] = Field(None, max_length=255)
    context: Optional[Dict[str, Any]] = None
    metrics: Optional[Dict[str, Any]] = None


class ExperienceEventResponse(BaseModel):
    ok: bool
    reason: Optional[str] = None


@router.post("/experience-events", response_model=ExperienceEventResponse)
async def post_experience_event(
    request: Request,
    body: ExperienceEventRequest,
    db: AsyncSession = Depends(get_db),
    auth_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user),
) -> ExperienceEventResponse:
    """
    Ingest a product experience event.

    EZA observes only — never returns actions like show_mirror_prompt.
    Client-supplied userId/tenantId are not accepted.
    """
    size_ok, size_reason = validate_body_size(
        request.headers.get("content-length")
    )
    if not size_ok:
        return ExperienceEventResponse(ok=False, reason=size_reason)

    guest_hash = hash_guest_token(body.guestToken) if body.guestToken else None
    user_id = str(auth_user["user_id"]) if auth_user and auth_user.get("user_id") else None
    await rate_limit_experience_events(
        request,
        user_id=user_id,
        guest_token_hash=guest_hash,
    )

    payload = body.model_dump()
    result = await ingest_experience_event(db, payload, auth_user=auth_user)
    return ExperienceEventResponse(**result)
