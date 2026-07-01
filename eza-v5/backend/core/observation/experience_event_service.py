# -*- coding: utf-8 -*-
"""EZA Observation Architecture — experience event ingest service."""

from __future__ import annotations

from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.core.observation.experience_event_auth import resolve_trusted_actor
from backend.core.observation.experience_event_privacy import (
    scan_string_fields,
    validate_experience_payload,
)
from backend.core.observation.log_experience_event import (
    build_normalized_experience_event,
    log_experience_event,
)
from backend.core.observation.normalize_experience_event import ALLOWED_EXPERIENCE_EVENT_TYPES


async def ingest_experience_event(
    db: AsyncSession,
    payload: Dict[str, Any],
    *,
    auth_user: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Ingest one product experience event.

    EZA observes. Products decide UX.
    Never returns actions or recommendations.
    """
    if not get_settings().EXPERIENCE_EVENT_LOGGING_ENABLED:
        return {"ok": False, "reason": "disabled"}

    event_type = str(payload.get("eventType") or "").strip()
    product_id = str(payload.get("productId") or "").strip()

    if not product_id:
        return {"ok": False, "reason": "invalid_event_type"}
    if event_type not in ALLOWED_EXPERIENCE_EVENT_TYPES:
        return {"ok": False, "reason": "invalid_event_type"}

    actor = resolve_trusted_actor(
        auth_user=auth_user,
        guest_token=payload.get("guestToken"),
        session_id=payload.get("sessionId"),
        client_user_id=payload.get("userId"),
        client_tenant_id=payload.get("tenantId"),
    )
    if not actor.get("ok"):
        return {"ok": False, "reason": actor.get("reason", "unauthorized")}

    string_ok, string_reason = scan_string_fields(
        {
            "session_id": payload.get("sessionId"),
            "conversation_id": payload.get("conversationId"),
            "mirror_id": payload.get("mirrorId"),
            "root_mirror_id": payload.get("rootMirrorId"),
            "parent_mirror_id": payload.get("parentMirrorId"),
            "product_version": payload.get("productVersion"),
        }
    )
    if not string_ok:
        return {"ok": False, "reason": string_reason or "privacy_rejected"}

    context = payload.get("context") if isinstance(payload.get("context"), dict) else None
    metrics = payload.get("metrics") if isinstance(payload.get("metrics"), dict) else None

    ok, reason, cleaned_context, cleaned_metrics, privacy_json = validate_experience_payload(
        context, metrics
    )
    if not ok:
        return {"ok": False, "reason": reason or "privacy_rejected"}

    normalized = build_normalized_experience_event(
        product_id=product_id,
        product_version=payload.get("productVersion"),
        tenant_id=actor.get("tenant_id"),
        event_type=event_type,
        user_id=actor.get("user_id"),
        guest_token_hash=actor.get("guest_token_hash"),
        session_id=actor.get("session_id") or payload.get("sessionId"),
        conversation_id=payload.get("conversationId"),
        mirror_id=payload.get("mirrorId"),
        root_mirror_id=payload.get("rootMirrorId"),
        parent_mirror_id=payload.get("parentMirrorId"),
        context_json=cleaned_context,
        metrics_json=cleaned_metrics,
        privacy_json=privacy_json,
    )

    if db is None:
        return {"ok": False, "reason": "disabled"}

    event_id = await log_experience_event(db, normalized)
    if not event_id:
        return {"ok": False, "reason": "disabled"}

    return {"ok": True}
