# -*- coding: utf-8 -*-
"""
Phase 6.4 — durable Yansı exposure ingest.

Canonical unit: one meaningful-visibility opportunity per
exposureSessionId + slug + journeyVersion + allowlisted context.

Not landingViews, IO-only UX, image load, or background-tab paint.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.yansi_exposure_event import (
    YANSI_EXPOSURE_CONTEXTS,
    YansiExposureEvent,
)
from backend.services.mirror_network.frozen_journey_artifact import (
    get_public_frozen_journey_artifact,
)
from backend.services.mirror_network.yansi_experience_events import (
    payload_has_forbidden_fields,
)

_SLUG_MAX = 128


class YansiExposureIngestError(Exception):
    def __init__(self, reason: str, *, status_code: int = 400):
        super().__init__(reason)
        self.reason = reason
        self.status_code = status_code


def _norm_slug(value: str | None) -> str:
    return (value or "").strip().lower()


def _parse_uuid(value: str | None, *, field: str) -> str:
    raw = (value or "").strip()
    try:
        return str(uuid.UUID(raw))
    except (ValueError, TypeError, AttributeError):
        raise YansiExposureIngestError(f"invalid_{field}") from None


def _parse_occurred_at(value: str | None) -> datetime | None:
    if not value:
        return None
    raw = value.strip()
    if not raw:
        return None
    try:
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        parsed = datetime.fromisoformat(raw)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        return None


async def ingest_yansi_exposure_event(
    db: AsyncSession,
    *,
    slug: str,
    payload: dict[str, Any],
    viewer_user_id: str | None = None,
) -> dict[str, Any]:
    if payload_has_forbidden_fields(payload):
        raise YansiExposureIngestError("privacy_rejected")

    slug_n = _norm_slug(slug)
    if not slug_n or len(slug_n) > _SLUG_MAX:
        raise YansiExposureIngestError("invalid_slug")

    context = str(payload.get("context") or "").strip()
    if context not in YANSI_EXPOSURE_CONTEXTS:
        raise YansiExposureIngestError("invalid_context")

    event_id = _parse_uuid(str(payload.get("eventId") or ""), field="event_id")
    session_id = _parse_uuid(
        str(payload.get("exposureSessionId") or ""), field="exposure_session_id"
    )
    try:
        journey_version = int(payload.get("journeyVersion"))
    except (TypeError, ValueError):
        raise YansiExposureIngestError("invalid_journey_version")
    if journey_version < 1:
        raise YansiExposureIngestError("invalid_journey_version")

    public = await get_public_frozen_journey_artifact(
        db, slug=slug_n, journey_version=journey_version
    )
    if public is None or int(public.get("journeyVersion") or 0) != journey_version:
        raise YansiExposureIngestError("frozen_journey_not_found", status_code=404)

    existing = await db.execute(
        select(YansiExposureEvent).where(YansiExposureEvent.event_id == event_id)
    )
    by_event = existing.scalar_one_or_none()
    if by_event is not None:
        return {"accepted": True, "duplicate": True}

    dup = await db.execute(
        select(YansiExposureEvent.id).where(
            YansiExposureEvent.exposure_session_id == session_id,
            YansiExposureEvent.mirror_slug == slug_n,
            YansiExposureEvent.journey_version == journey_version,
            YansiExposureEvent.context == context,
        )
    )
    if dup.scalar_one_or_none() is not None:
        return {"accepted": True, "duplicate": True}

    row = YansiExposureEvent(
        event_id=event_id,
        exposure_session_id=session_id,
        mirror_slug=slug_n,
        journey_version=journey_version,
        context=context,
        viewer_user_id=viewer_user_id,
        occurred_at=_parse_occurred_at(
            str(payload["occurredAt"]) if payload.get("occurredAt") is not None else None
        ),
    )
    try:
        db.add(row)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        return {"accepted": True, "duplicate": True}
    return {"accepted": True, "duplicate": False}


async def count_exposures_by_context(
    db: AsyncSession,
    *,
    slug: str,
    journey_version: int,
) -> dict[str, int]:
    slug_n = _norm_slug(slug)
    counts = {ctx: 0 for ctx in sorted(YANSI_EXPOSURE_CONTEXTS)}
    result = await db.execute(
        select(
            YansiExposureEvent.context,
            func.count(func.distinct(YansiExposureEvent.exposure_session_id)),
        )
        .where(
            YansiExposureEvent.mirror_slug == slug_n,
            YansiExposureEvent.journey_version == journey_version,
        )
        .group_by(YansiExposureEvent.context)
    )
    for context, n in result.all():
        key = str(context)
        if key in counts:
            counts[key] = int(n or 0)
    return counts
