# -*- coding: utf-8 -*-
"""EZA Observation — trusted actor resolution for experience events."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, Literal, Optional

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials

from backend.auth.deps import security
from backend.auth.jwt import get_user_from_token

SESSION_ID_RE = re.compile(
    r"^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|sess-[a-zA-Z0-9\-_]{8,})$",
    re.IGNORECASE,
)

FORBIDDEN_CLIENT_ID_FIELDS = frozenset({"userId", "tenantId"})

AuthKind = Literal["authenticated", "anonymous", "invalid_token"]


@dataclass
class ExperienceAuthContext:
    kind: AuthKind
    user: Optional[Dict[str, Any]] = None


def is_valid_session_id(value: Optional[str]) -> bool:
    if not value or not isinstance(value, str):
        return False
    if len(value) < 8 or len(value) > 255:
        return False
    return bool(SESSION_ID_RE.match(value.strip()))


def payload_has_forbidden_client_ids(payload: Dict[str, Any]) -> bool:
    return bool(FORBIDDEN_CLIENT_ID_FIELDS.intersection(payload.keys()))


async def get_experience_event_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> ExperienceAuthContext:
    """
    Resolve JWT for experience ingest.

    - No header → anonymous (session/guest rules apply later)
    - Invalid header → invalid_token (must not fall through to anonymous)
    - Valid header → authenticated
    """
    if credentials is None:
        return ExperienceAuthContext(kind="anonymous", user=None)

    user = get_user_from_token(credentials.credentials)
    if user is None:
        return ExperienceAuthContext(kind="invalid_token", user=None)

    return ExperienceAuthContext(kind="authenticated", user=user)


def resolve_trusted_actor(
    *,
    auth_user: Optional[Dict[str, Any]],
    guest_token: Optional[str],
    session_id: Optional[str],
    client_user_id: Optional[str] = None,
    client_tenant_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Resolve trusted identity for observation ingest.

    Rules:
    - Client userId/tenantId are never accepted.
    - Without JWT: valid sessionId is mandatory.
    - guestToken alone is never sufficient; guest events require sessionId + guestToken.
    """
    if client_user_id or client_tenant_id:
        return {"ok": False, "reason": "unauthorized"}

    has_session = is_valid_session_id(session_id)
    has_guest = bool(guest_token and isinstance(guest_token, str) and guest_token.strip())

    user_id = None
    if auth_user and auth_user.get("user_id"):
        user_id = str(auth_user["user_id"])

    if has_guest and not has_session:
        return {"ok": False, "reason": "unauthorized"}

    if not user_id and not has_session:
        return {"ok": False, "reason": "unauthorized"}

    guest_token_hash = None
    if has_guest:
        from backend.core.observation.log_experience_event import hash_guest_token

        guest_token_hash = hash_guest_token(guest_token.strip())

    return {
        "ok": True,
        "user_id": user_id,
        "guest_token_hash": guest_token_hash,
        "session_id": session_id.strip() if has_session and session_id else None,
        "tenant_id": None,
    }
