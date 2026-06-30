# -*- coding: utf-8 -*-
"""
EZA Observation — experience event ingest API.

POST /api/eza/experience-events

EZA observes. Products decide UX.
This endpoint never returns actions, prompts, or UX decisions.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.observation.experience_event_service import ingest_experience_event
from backend.core.utils.dependencies import get_db

router = APIRouter(prefix="/api/eza", tags=["EZA Observation"])


class ExperienceEventRequest(BaseModel):
    productId: str = Field(..., min_length=1, max_length=64)
    productVersion: Optional[str] = Field(None, max_length=64)
    tenantId: Optional[str] = Field(None, max_length=255)
    eventType: str = Field(..., min_length=1, max_length=96)
    sessionId: Optional[str] = Field(None, max_length=255)
    userId: Optional[str] = Field(None, max_length=255)
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
    body: ExperienceEventRequest,
    db: AsyncSession = Depends(get_db),
) -> ExperienceEventResponse:
    """
  Ingest a product experience event.

  EZA observes only — never returns actions like show_mirror_prompt.
  """
    result = await ingest_experience_event(db, body.model_dump())
    return ExperienceEventResponse(**result)
