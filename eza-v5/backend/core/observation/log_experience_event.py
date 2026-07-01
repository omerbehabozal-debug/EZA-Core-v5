# -*- coding: utf-8 -*-
"""
EZA Observation — persist experience events (non-blocking).

EZA observes. Products decide UX.
Never writes to governance eza_events table.
"""

from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.core.observation.experience_event_privacy import build_privacy_json
from backend.core.observation.normalize_experience_event import resolve_universal_event_type
from backend.models.experience_event import ExperienceEvent

logger = logging.getLogger(__name__)

EXPERIENCE_EVENT_SCHEMA_VERSION = 1


def hash_guest_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def resolve_observation_environment() -> str:
    settings = get_settings()
    raw = (settings.EZA_ENV or settings.ENV or "dev").lower()
    if raw in ("prod", "production"):
        return "production"
    if raw == "staging":
        return "staging"
    return "dev"


def _parse_timestamp(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc)


async def log_experience_event(db: AsyncSession, event: Dict[str, Any]) -> Optional[str]:
    """
    Persist one experience event row.

    Returns event id string, or None if validation/DB fails (no exception raised).
    """
    if not event or not isinstance(event, dict):
        logger.warning("log_experience_event: empty or invalid event dict")
        return None

    required = ("product_id", "environment", "event_type", "expires_at")
    for field in required:
        if not event.get(field):
            logger.warning("log_experience_event: missing required field %s", field)
            return None

    try:
        event_id = event.get("id")
        try:
            row_id = uuid.UUID(str(event_id)) if event_id else uuid.uuid4()
        except ValueError:
            row_id = uuid.uuid4()

        row = ExperienceEvent(
            id=row_id,
            product_id=str(event["product_id"])[:64],
            product_version=str(event["product_version"])[:64] if event.get("product_version") else None,
            tenant_id=str(event["tenant_id"])[:255] if event.get("tenant_id") else None,
            environment=str(event["environment"])[:32],
            event_type=str(event["event_type"])[:96],
            universal_event_type=str(event["universal_event_type"])[:96]
            if event.get("universal_event_type")
            else None,
            user_id=str(event["user_id"])[:255] if event.get("user_id") else None,
            guest_token_hash=str(event["guest_token_hash"])[:128]
            if event.get("guest_token_hash")
            else None,
            session_id=str(event["session_id"])[:255] if event.get("session_id") else None,
            conversation_id=str(event["conversation_id"])[:255]
            if event.get("conversation_id")
            else None,
            mirror_id=str(event["mirror_id"])[:255] if event.get("mirror_id") else None,
            root_mirror_id=str(event["root_mirror_id"])[:255]
            if event.get("root_mirror_id")
            else None,
            parent_mirror_id=str(event["parent_mirror_id"])[:255]
            if event.get("parent_mirror_id")
            else None,
            context_json=event.get("context_json"),
            metrics_json=event.get("metrics_json"),
            privacy_json=event.get("privacy_json"),
            schema_version=int(event.get("schema_version") or EXPERIENCE_EVENT_SCHEMA_VERSION),
            created_at=_parse_timestamp(event.get("created_at")),
            expires_at=_parse_timestamp(event["expires_at"]),
        )
        db.add(row)
        await db.commit()
        return str(row_id)
    except Exception as exc:
        logger.warning("log_experience_event failed: %s", exc)
        try:
            await db.rollback()
        except Exception:
            pass
        return None


def build_normalized_experience_event(
    *,
    product_id: str,
    event_type: str,
    product_version: Optional[str] = None,
    tenant_id: Optional[str] = None,
    user_id: Optional[str] = None,
    guest_token_hash: Optional[str] = None,
    session_id: Optional[str] = None,
    conversation_id: Optional[str] = None,
    mirror_id: Optional[str] = None,
    root_mirror_id: Optional[str] = None,
    parent_mirror_id: Optional[str] = None,
    context_json: Optional[Dict[str, Any]] = None,
    metrics_json: Optional[Dict[str, Any]] = None,
    privacy_json: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    retention_days = max(1, int(settings.EXPERIENCE_EVENT_RETENTION_DAYS or 30))

    from backend.core.observation.experience_event_privacy import build_privacy_json

    resolved_privacy = privacy_json if privacy_json else build_privacy_json(pii_scan_passed=False)

    return {
        "product_id": product_id,
        "product_version": product_version,
        "tenant_id": tenant_id,
        "environment": resolve_observation_environment(),
        "event_type": event_type,
        "universal_event_type": resolve_universal_event_type(event_type),
        "user_id": user_id,
        "guest_token_hash": guest_token_hash,
        "session_id": session_id,
        "conversation_id": conversation_id,
        "mirror_id": mirror_id,
        "root_mirror_id": root_mirror_id,
        "parent_mirror_id": parent_mirror_id,
        "context_json": context_json,
        "metrics_json": metrics_json,
        "privacy_json": resolved_privacy,
        "schema_version": EXPERIENCE_EVENT_SCHEMA_VERSION,
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(days=retention_days)).isoformat(),
    }
