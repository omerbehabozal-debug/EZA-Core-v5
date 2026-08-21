# -*- coding: utf-8 -*-
"""Operational lifecycle events — system behavior only, never user content."""

from __future__ import annotations

import logging
import time
from typing import Any, Mapping

from backend.observability.error_codes import EXPECTED_CODES
from backend.observability.redaction import redact_mapping, redact_text
from backend.observability.request_id import get_request_id

logger = logging.getLogger("backend.ops")

# Allowlisted event names (ops funnel only).
ALLOWED_EVENTS = frozenset(
    {
        "discover_load_failed",
        "public_yansi_load_failed",
        "frozen_replay_load_failed",
        "sohbet_session_create_failed",
        "ayna_generation_requested",
        "ayna_generation_failed",
        "ayna_generation_succeeded",
        "yansi_publish_requested",
        "yansi_publish_failed",
        "yansi_publish_succeeded",
        "auth_login_failed",
        "auth_register_failed",
        "social_auth_failed",
        "guest_claim_failed",
        "journey_rebind_failed",
        "share_route_load_failed",
        "provider_request_failed",
        "provider_timeout",
        "internal_error",
        "client_ops_event",
    }
)

# Fields never accepted even if caller passes them.
_FORBIDDEN_FIELD_KEYS = frozenset(
    {
        "email",
        "password",
        "token",
        "access_token",
        "refresh_token",
        "id_token",
        "authorization",
        "guest_token",
        "lineageprooftoken",
        "prompt",
        "conversation",
        "messages",
        "user_id",
        "slug",
        "ip",
        "user_agent",
        "display_name",
        "public_display_name",
    }
)


def emit_ops_event(
    event: str,
    *,
    code: str | None = None,
    outcome: str = "failure",
    duration_ms: float | None = None,
    fields: Mapping[str, Any] | None = None,
) -> None:
    """
    Emit a single-line operational event.

    Never logs conversation, credentials, email, slug, or user ids.
    Expected product states log at INFO; system failures at ERROR/WARNING.
    """
    if event not in ALLOWED_EVENTS:
        logger.warning("ops_event_rejected reason=unknown_event")
        return

    safe_fields: dict[str, Any] = {}
    if fields:
        for key, value in fields.items():
            kl = str(key).lower().replace("-", "_")
            if kl in _FORBIDDEN_FIELD_KEYS or any(
                bad in kl for bad in ("email", "token", "password", "prompt", "slug", "user_id")
            ):
                continue
            if isinstance(value, (str, int, float, bool)) or value is None:
                if isinstance(value, str):
                    safe_fields[key] = redact_text(value)[:120]
                else:
                    safe_fields[key] = value

    payload = {
        "event": event,
        "outcome": outcome,
        "code": code,
        "request_id": get_request_id(),
        "duration_ms": int(duration_ms) if duration_ms is not None else None,
        "fields": redact_mapping(safe_fields) if safe_fields else {},
    }

    line = (
        f"ops_event event={payload['event']} outcome={payload['outcome']} "
        f"code={payload['code'] or '-'} request_id={payload['request_id'] or '-'} "
        f"duration_ms={payload['duration_ms'] if payload['duration_ms'] is not None else '-'} "
        f"fields={payload['fields']}"
    )
    line = redact_text(line)

    if code and code in EXPECTED_CODES:
        logger.info(line)
    elif outcome == "success":
        logger.info(line)
    elif outcome == "failure":
        logger.error(line)
    else:
        logger.warning(line)


class OpsTimer:
    """Simple duration helper for ops events."""

    def __init__(self) -> None:
        self._start = time.perf_counter()

    def ms(self) -> float:
        return (time.perf_counter() - self._start) * 1000.0
