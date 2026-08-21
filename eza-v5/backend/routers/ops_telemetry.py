# -*- coding: utf-8 -*-
"""Phase 8.8 — allowlisted client operational events (no content payloads)."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.observability.error_codes import EXPECTED_CODES
from backend.observability.ops_events import emit_ops_event

router = APIRouter(prefix="/api/ops", tags=["ops"])

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


class ClientOpsEventRequest(BaseModel):
    event: str = Field(max_length=64)
    code: str | None = Field(default=None, max_length=64)
    outcome: Literal["failure", "success"] = "failure"


class ClientOpsEventResponse(BaseModel):
    ok: bool = True


@router.post("/client-event", response_model=ClientOpsEventResponse)
async def post_client_ops_event(body: ClientOpsEventRequest) -> ClientOpsEventResponse:
    """
    Fire-and-forget client ops signal.

    Rejects unknown events. Never accepts free-text message / stack / URL body.
    """
    if body.event not in _CLIENT_EVENTS:
        return ClientOpsEventResponse(ok=True)  # ignore quietly — no probing aid

    code = body.code
    if code and code not in EXPECTED_CODES and not code.isupper() and "_" not in code:
        # Allow stable taxonomy-like codes (UPPER_SNAKE) only
        if not all(c.isalnum() or c == "_" for c in code):
            code = None
        elif not code.replace("_", "").isalnum():
            code = None

    if code and len(code) > 64:
        code = None

    # Normalize: only accept UPPER_SNAKE-ish codes
    if code and not all(c.isupper() or c.isdigit() or c == "_" for c in code):
        code = None

    emit_ops_event(
        "client_ops_event",
        code=code,
        outcome=body.outcome,
        fields={"client_event": body.event},
    )
    return ClientOpsEventResponse(ok=True)
