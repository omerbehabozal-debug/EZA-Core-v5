# -*- coding: utf-8 -*-
"""
EZA Observation — experience event ingest API.

POST /api/eza/experience-events

EZA observes. SAINA decides.
When EXPERIENCE_EVENT_LOGGING_ENABLED=false the endpoint is a silent no-op:
no body read, auth, rate limit, or DB work.
"""

from __future__ import annotations

import json
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from fastapi.security import HTTPAuthorizationCredentials

from backend.auth.deps import security
from backend.auth.jwt import get_user_from_token
from backend.core.observation.experience_event_auth import (
    ExperienceAuthContext,
    payload_has_forbidden_client_ids,
)
from backend.core.observation.experience_event_body import (
    ExperienceBodyTooLarge,
    read_limited_experience_body,
)
from backend.core.observation.experience_event_flags import is_experience_event_logging_enabled
from backend.core.observation.experience_event_rate_limit import rate_limit_experience_events
from backend.core.observation.experience_event_service import ingest_experience_event
from backend.core.observation.log_experience_event import hash_guest_token
from backend.core.utils.dependencies import AsyncSessionLocal

router = APIRouter(prefix="/api/eza", tags=["EZA Observation"])


class ExperienceEventRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

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


async def _resolve_auth_context(request: Request) -> ExperienceAuthContext:
    credentials: Optional[HTTPAuthorizationCredentials] = await security(request)
    if credentials is None:
        return ExperienceAuthContext(kind="anonymous", user=None)
    user = get_user_from_token(credentials.credentials)
    if user is None:
        return ExperienceAuthContext(kind="invalid_token", user=None)
    return ExperienceAuthContext(kind="authenticated", user=user)


@router.post("/experience-events", response_model=ExperienceEventResponse)
async def post_experience_event(request: Request) -> ExperienceEventResponse:
    """
    Ingest a product experience event.

    EZA observes only — never returns actions like show_mirror_prompt.
    """
    if not is_experience_event_logging_enabled():
        return ExperienceEventResponse(ok=False, reason="disabled")

    auth_context = await _resolve_auth_context(request)
    if auth_context.kind == "invalid_token":
        return ExperienceEventResponse(ok=False, reason="unauthorized")

    try:
        raw_body = await read_limited_experience_body(request)
    except ExperienceBodyTooLarge:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"ok": False, "reason": "payload_too_large"},
        )

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return ExperienceEventResponse(ok=False, reason="invalid_event_type")

    if not isinstance(payload, dict):
        return ExperienceEventResponse(ok=False, reason="invalid_event_type")

    if payload_has_forbidden_client_ids(payload):
        return ExperienceEventResponse(ok=False, reason="unauthorized")

    try:
        body = ExperienceEventRequest.model_validate(payload)
    except ValidationError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"ok": False, "reason": "invalid_event_type"},
        )

    guest_hash = hash_guest_token(body.guestToken) if body.guestToken else None
    user_id = (
        str(auth_context.user["user_id"])
        if auth_context.kind == "authenticated" and auth_context.user
        else None
    )
    await rate_limit_experience_events(
        request,
        user_id=user_id,
        guest_token_hash=guest_hash,
    )

    async with AsyncSessionLocal() as db:
        result = await ingest_experience_event(
            db,
            body.model_dump(),
            auth_user=auth_context.user if auth_context.kind == "authenticated" else None,
        )
    return ExperienceEventResponse(**result)
