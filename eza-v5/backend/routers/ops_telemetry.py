# -*- coding: utf-8 -*-
"""Phase 8.8 / 8.8.1 — allowlisted client operational events (abuse-hardened)."""

from __future__ import annotations

import json
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from backend.observability.error_codes import CLIENT_OPS_CODES
from backend.observability.ops_events import emit_ops_event
from backend.security.rate_limit import rate_limit_ops_client

router = APIRouter(prefix="/api/ops", tags=["ops"])

# Tiny JSON only: {"event","code?","outcome"} — keep well under infra defaults.
CLIENT_OPS_MAX_BODY_BYTES = 1024

_CLIENT_EVENTS = frozenset(
    {
        "discover_load_failed",
        "public_yansi_load_failed",
        "frozen_replay_load_failed",
        "sohbet_session_create_failed",
        "ayna_generation_failed",
        "yansi_publish_failed",
        "share_route_load_failed",
        "auth_login_failed",
        "auth_register_failed",
        "social_auth_failed",
        "guest_claim_failed",
        "journey_rebind_failed",
    }
)

_INVALID = {"ok": False, "error": "invalid_ops_event"}
_TOO_LARGE = {"ok": False, "error": "payload_too_large"}


class ClientOpsEventRequest(BaseModel):
    """Strict client ops body — no free-form keys, no content fields."""

    model_config = ConfigDict(extra="forbid")

    event: str = Field(min_length=1, max_length=64)
    code: Optional[str] = Field(default=None, min_length=1, max_length=64)
    outcome: Literal["failure", "success"] = "failure"


class ClientOpsEventResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True


def _reject(status_code: int, body: dict) -> JSONResponse:
    """Generic 4xx — never echoes submitted payload."""
    return JSONResponse(status_code=status_code, content=body)


@router.post("/client-event", response_model=ClientOpsEventResponse)
async def post_client_ops_event(
    request: Request,
    _: None = Depends(rate_limit_ops_client),
) -> ClientOpsEventResponse | JSONResponse:
    """
    Fire-and-forget client ops signal (Phase 8.8.1 abuse-hardened).

    - Body ≤ 1024 bytes (Content-Length + measured)
    - extra=forbid schema
    - event + code allowlists only
    - Quiet 4xx on abuse; no ERROR log amplification
    """
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            if int(content_length) > CLIENT_OPS_MAX_BODY_BYTES:
                return _reject(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, _TOO_LARGE)
        except ValueError:
            return _reject(status.HTTP_422_UNPROCESSABLE_ENTITY, _INVALID)

    raw = await request.body()
    if len(raw) > CLIENT_OPS_MAX_BODY_BYTES:
        return _reject(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, _TOO_LARGE)

    if not raw:
        return _reject(status.HTTP_422_UNPROCESSABLE_ENTITY, _INVALID)

    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
        return _reject(status.HTTP_422_UNPROCESSABLE_ENTITY, _INVALID)

    if not isinstance(parsed, dict):
        return _reject(status.HTTP_422_UNPROCESSABLE_ENTITY, _INVALID)

    try:
        body = ClientOpsEventRequest.model_validate(parsed)
    except ValidationError:
        return _reject(status.HTTP_422_UNPROCESSABLE_ENTITY, _INVALID)

    if body.event not in _CLIENT_EVENTS:
        return _reject(status.HTTP_422_UNPROCESSABLE_ENTITY, _INVALID)

    if body.code is not None and body.code not in CLIENT_OPS_CODES:
        return _reject(status.HTTP_422_UNPROCESSABLE_ENTITY, _INVALID)

    # Single intentional log line for accepted events only.
    emit_ops_event(
        "client_ops_event",
        code=body.code,
        outcome=body.outcome,
        fields={"client_event": body.event},
    )
    return ClientOpsEventResponse(ok=True)
