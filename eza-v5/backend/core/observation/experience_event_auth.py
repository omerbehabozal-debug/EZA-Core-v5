# -*- coding: utf-8 -*-
"""EZA Observation — trusted actor resolution for experience events."""

from __future__ import annotations

import re
from typing import Any, Dict, Optional

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials

from backend.auth.deps import security
from backend.auth.jwt import get_user_from_token

SESSION_ID_RE = re.compile(
    r"^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|sess-[a-zA-Z0-9\-_]{8,})$",
    re.IGNORECASE,
)


def is_valid_session_id(value: Optional[str]) -> bool:
    if not value or not isinstance(value, str):
        return False
    if len(value) < 8 or len(value) > 255:
        return False
    return bool(SESSION_ID_RE.match(value.strip()))


async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[Dict[str, Any]]:
    """Optional JWT — returns None when unauthenticated."""
    if credentials is None:
        return None
    return get_user_from_token(credentials.credentials)


def resolve_trusted_actor(
  *,
  auth_user: Optional[Dict[str, Any]],
  guest_token: Optional[str],
  session_id: Optional[str],
  client_user_id: Optional[str],
  client_tenant_id: Optional[str],
) -> Dict[str, Any]:
    """
    Resolve trusted identity for observation ingest.

    Client-supplied userId/tenantId are never trusted.
    """
    if client_user_id or client_tenant_id:
        return {"ok": False, "reason": "unauthorized"}

    user_id = None
    if auth_user and auth_user.get("user_id"):
        user_id = str(auth_user["user_id"])

    guest_token_hash = None
    if guest_token and isinstance(guest_token, str) and guest_token.strip():
        from backend.core.observation.log_experience_event import hash_guest_token

        guest_token_hash = hash_guest_token(guest_token.strip())

    has_session = is_valid_session_id(session_id)

    if not user_id and not guest_token_hash and not has_session:
        return {"ok": False, "reason": "unauthorized"}

    return {
        "ok": True,
        "user_id": user_id,
        "guest_token_hash": guest_token_hash,
        "session_id": session_id.strip() if has_session and session_id else None,
        "tenant_id": None,
    }
