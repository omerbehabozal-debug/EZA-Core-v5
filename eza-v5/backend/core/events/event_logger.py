# -*- coding: utf-8 -*-
"""
Universal Event logger — Stage 1.

Persists normalized events to eza_events. Non-blocking: never raises to callers.
Not wired into pipeline in this stage.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.events.event_normalizer import _resolve_case_snapshot
from backend.models.eza_event import EzaEvent

logger = logging.getLogger(__name__)

REQUIRED_FIELDS = (
    "source_mode",
    "entity_type",
    "entity_id",
    "event_type",
    "calibration_scope",
)


def _parse_timestamp(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            pass
    return datetime.now(timezone.utc)


async def log_eza_event(db: AsyncSession, event: Dict[str, Any]) -> Optional[str]:
    """
    Persist one universal event row.

    Returns event id string, or None if validation/DB fails (no exception raised).
    """
    if not event or not isinstance(event, dict):
        logger.warning("log_eza_event: empty or invalid event dict")
        return None

    for field in REQUIRED_FIELDS:
        if not event.get(field):
            logger.warning("log_eza_event: missing required field %s", field)
            return None

    try:
        event_id = event.get("id")
        try:
            row_id = uuid.UUID(str(event_id)) if event_id else uuid.uuid4()
        except ValueError:
            row_id = uuid.uuid4()

        snapshot = _resolve_case_snapshot(event.get("case_snapshot"))

        row = EzaEvent(
            id=row_id,
            source_mode=str(event["source_mode"])[:64],
            entity_type=str(event["entity_type"])[:64],
            entity_id=str(event["entity_id"])[:255],
            event_type=str(event["event_type"])[:64],
            calibration_scope=str(event["calibration_scope"])[:64],
            regulation_scope=str(event.get("regulation_scope") or "none")[:64],
            user_id=str(event["user_id"])[:255] if event.get("user_id") else None,
            org_id=str(event["org_id"])[:255] if event.get("org_id") else None,
            session_id=str(event["session_id"])[:255] if event.get("session_id") else None,
            timestamp=_parse_timestamp(event.get("timestamp")),
            score_vector=event.get("score_vector"),
            engine_votes=event.get("engine_votes"),
            decision_trace=event.get("decision_trace"),
            event_metadata=event.get("metadata"),
            risk_label=str(event["risk_label"])[:64] if event.get("risk_label") else None,
            risk_score=event.get("risk_score"),
            confidence_score=event.get("confidence_score"),
            reliability_score=event.get("reliability_score"),
            can_interpret=bool(event.get("can_interpret", False)),
            case_snapshot=snapshot,
            schema_version=int(event.get("schema_version") or 1),
        )
        db.add(row)
        await db.commit()
        return str(row_id)
    except Exception as exc:
        logger.warning("log_eza_event failed: %s", exc)
        try:
            await db.rollback()
        except Exception:
            pass
        return None
