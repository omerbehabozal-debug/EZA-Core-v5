# -*- coding: utf-8 -*-
"""
Admin / feedback helpers for Universal Events (Stage 2).

Read-only event views and feedback authorization; does not alter safety decisions.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.eza_event import EzaEvent
from backend.models.behavioral import BehavioralFeedback
from backend.services.production_org import check_user_organization_membership

logger = logging.getLogger(__name__)


def _event_to_summary(row: EzaEvent) -> Dict[str, Any]:
    return {
        "id": str(row.id),
        "source_mode": row.source_mode,
        "entity_type": row.entity_type,
        "entity_id": row.entity_id,
        "event_type": row.event_type,
        "calibration_scope": row.calibration_scope,
        "regulation_scope": row.regulation_scope,
        "user_id": row.user_id,
        "org_id": row.org_id,
        "session_id": row.session_id,
        "timestamp": row.timestamp.isoformat() if row.timestamp else None,
        "risk_label": row.risk_label,
        "risk_score": row.risk_score,
        "confidence_score": row.confidence_score,
        "reliability_score": row.reliability_score,
        "can_interpret": row.can_interpret,
        "schema_version": row.schema_version,
    }


def _event_to_detail(row: EzaEvent) -> Dict[str, Any]:
    detail = _event_to_summary(row)
    detail.update({
        "score_vector": row.score_vector,
        "engine_votes": row.engine_votes,
        "decision_trace": row.decision_trace,
        "metadata": row.event_metadata,
    })
    return detail


def _feedback_to_dict(row: BehavioralFeedback) -> Dict[str, Any]:
    return {
        "id": str(row.id),
        "user_id": row.user_id,
        "org_id": row.org_id,
        "timestamp": row.timestamp.isoformat() if row.timestamp else None,
        "event_id": str(row.event_id) if row.event_id else None,
        "analysis_id": str(row.analysis_id) if row.analysis_id else None,
        "feedback_type": row.feedback_type,
        "metric_name": row.metric_name,
        "original_label": row.original_label,
        "corrected_label": row.corrected_label,
        "original_score": row.original_score,
        "corrected_score": row.corrected_score,
        "notes": row.notes,
        "is_reviewed": row.is_reviewed,
    }


async def get_event_by_id(db: AsyncSession, event_id: str) -> Optional[EzaEvent]:
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return None
    result = await db.execute(select(EzaEvent).where(EzaEvent.id == eid))
    return result.scalar_one_or_none()


async def list_events_for_org(
    db: AsyncSession,
    org_id: str,
    *,
    source_mode: Optional[str] = None,
    entity_type: Optional[str] = None,
    event_type: Optional[str] = None,
    user_id: Optional[str] = None,
    days: int = 30,
    limit: int = 50,
) -> List[EzaEvent]:
    """List events scoped to organization."""
    limit = max(1, min(int(limit), 200))
    days = max(1, min(int(days), 365))
    since = datetime.now(timezone.utc) - timedelta(days=days)

    conditions = [
        EzaEvent.org_id == str(org_id),
        EzaEvent.timestamp >= since,
    ]
    if source_mode:
        conditions.append(EzaEvent.source_mode == source_mode)
    if entity_type:
        conditions.append(EzaEvent.entity_type == entity_type)
    if event_type:
        conditions.append(EzaEvent.event_type == event_type)
    if user_id:
        conditions.append(EzaEvent.user_id == str(user_id))

    q = (
        select(EzaEvent)
        .where(and_(*conditions))
        .order_by(desc(EzaEvent.timestamp))
        .limit(limit)
    )
    result = await db.execute(q)
    return list(result.scalars().all())


async def fetch_feedback_for_event(db: AsyncSession, event_id: uuid.UUID) -> List[BehavioralFeedback]:
    result = await db.execute(
        select(BehavioralFeedback)
        .where(BehavioralFeedback.event_id == event_id)
        .order_by(desc(BehavioralFeedback.timestamp))
    )
    return list(result.scalars().all())


async def get_event_detail_for_org(
    db: AsyncSession,
    org_id: str,
    event_id: str,
) -> Tuple[Optional[Dict[str, Any]], Optional[int]]:
    """
    Return (detail_dict, error_status).
    error_status: 404 not found / wrong org, 403 forbidden.
    """
    row = await get_event_by_id(db, event_id)
    if row is None:
        return None, 404
    if row.org_id != str(org_id):
        return None, 403

    detail = _event_to_detail(row)
    feedback_rows = await fetch_feedback_for_event(db, row.id)
    detail["feedback_history"] = [_feedback_to_dict(f) for f in feedback_rows]
    return detail, None


async def authorize_event_feedback(
    db: AsyncSession,
    *,
    actor_user_id: str,
    actor_role: str,
    org_id: Optional[str],
    event_id: str,
) -> Tuple[Optional[EzaEvent], Optional[int], Optional[str]]:
    """
    Verify actor may submit feedback for event.

    Returns (event, http_status_error, error_code).
    """
    row = await get_event_by_id(db, event_id)
    if row is None:
        return None, 404, "event_not_found"

    role = (actor_role or "").lower()

    if role == "admin":
        if not org_id:
            return None, 400, "org_id_required"
        if row.org_id != str(org_id):
            return None, 403, "cross_org_event"
        admin_ok = await check_user_organization_membership(db, actor_user_id, org_id)
        if not admin_ok:
            return None, 403, "cross_org_event"
        return row, None, None

    # Regular user: must own the event
    if row.user_id != str(actor_user_id):
        return None, 403, "foreign_event"

    if org_id and row.org_id and row.org_id != str(org_id):
        return None, 403, "foreign_event"

    return row, None, None
