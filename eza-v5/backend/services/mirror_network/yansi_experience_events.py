# -*- coding: utf-8 -*-
"""
Phase 6.0 — durable Yansı experience event ingest.

Skip is a transition, not a terminal state. One STARTED and one COMPLETED
per experience session; skip rows unique per (session, step-count, destination).

COMPLETED without STARTED uses Option B: atomically synthesize STARTED
(stable uuid5 event id) so a lost start plus a verified completion still
records a started session. SKIPPED without STARTED is rejected.

Phase 6.2.2: STARTED authorization for SKIPPED (and _ensure_started) is
scoped to exact experience_session_id + mirror_slug + journey_version.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.yansi_experience_event import (
    YANSI_EXPERIENCE_COMPLETED,
    YANSI_EXPERIENCE_EVENT_TYPES,
    YANSI_EXPERIENCE_SKIPPED,
    YANSI_EXPERIENCE_STARTED,
    YansiExperienceEvent,
)
from backend.services.mirror_network.frozen_journey_artifact import (
    get_public_frozen_journey_artifact,
)

_SLUG_MAX = 128
_SYNTHETIC_STARTED_NS = uuid.UUID("a7c4e1d0-6b31-4f2e-9c0a-12f8e3b7d451")

FORBIDDEN_CLIENT_KEYS = frozenset(
    {
        "publicquestion",
        "publicanswer",
        "ezasnapshot",
        "relationshipmap",
        "prompt",
        "response",
        "lineageprooftoken",
        "guesttoken",
        "conversationid",
        "userid",
        "user_id",
        "ip",
        "useragent",
        "user_agent",
        "behavioralvector",
        "rawmessage",
    }
)


class YansiExperienceIngestError(Exception):
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
        raise YansiExperienceIngestError(f"invalid_{field}") from None


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


def synthetic_started_event_id(experience_session_id: str) -> str:
    return str(
        uuid.uuid5(_SYNTHETIC_STARTED_NS, f"{experience_session_id}:started")
    )


def payload_has_forbidden_fields(payload: dict[str, Any] | None) -> bool:
    if not payload:
        return False
    for key in payload.keys():
        if str(key).replace("-", "").replace("_", "").lower() in FORBIDDEN_CLIENT_KEYS:
            return True
        nested = payload.get(key)
        if isinstance(nested, dict) and payload_has_forbidden_fields(nested):
            return True
    return False


async def _require_public_frozen(
    db: AsyncSession, *, slug: str, journey_version: int
) -> dict[str, Any]:
    public = await get_public_frozen_journey_artifact(
        db, slug=slug, journey_version=journey_version
    )
    if public is None:
        raise YansiExperienceIngestError("frozen_journey_not_found", status_code=404)
    if int(public.get("journeyVersion") or 0) != journey_version:
        raise YansiExperienceIngestError("wrong_journey_version", status_code=404)
    selected = int(public.get("selectedCount") or 0)
    if selected < 6 or selected > 8:
        raise YansiExperienceIngestError("malformed_frozen_artifact", status_code=400)
    if public.get("replayReady") is not True:
        raise YansiExperienceIngestError("not_replay_ready", status_code=404)
    return public


async def _session_has_event(
    db: AsyncSession,
    *,
    experience_session_id: str,
    event_type: str,
    mirror_slug: str,
    journey_version: int,
) -> bool:
    """True only when the event exists for this exact session + slug + version."""
    result = await db.execute(
        select(YansiExperienceEvent.id).where(
            YansiExperienceEvent.experience_session_id == experience_session_id,
            YansiExperienceEvent.event_type == event_type,
            YansiExperienceEvent.mirror_slug == mirror_slug,
            YansiExperienceEvent.journey_version == journey_version,
        ).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def _find_semantic_duplicate(
    db: AsyncSession,
    *,
    event_type: str,
    experience_session_id: str,
    completed_step_count: int | None,
    destination_slug: str | None,
) -> YansiExperienceEvent | None:
    filters = [
        YansiExperienceEvent.experience_session_id == experience_session_id,
        YansiExperienceEvent.event_type == event_type,
    ]
    if event_type == YANSI_EXPERIENCE_SKIPPED:
        filters.append(YansiExperienceEvent.completed_step_count == completed_step_count)
        filters.append(YansiExperienceEvent.destination_slug == destination_slug)
    result = await db.execute(select(YansiExperienceEvent).where(*filters).limit(1))
    return result.scalar_one_or_none()


async def _get_by_event_id(
    db: AsyncSession, *, event_id: str
) -> YansiExperienceEvent | None:
    result = await db.execute(
        select(YansiExperienceEvent).where(YansiExperienceEvent.event_id == event_id)
    )
    return result.scalar_one_or_none()


async def list_yansi_experience_events(
    db: AsyncSession, *, experience_session_id: str
) -> list[YansiExperienceEvent]:
    result = await db.execute(
        select(YansiExperienceEvent)
        .where(YansiExperienceEvent.experience_session_id == experience_session_id)
        .order_by(YansiExperienceEvent.id.asc())
    )
    return list(result.scalars().all())


async def _insert_row(
    db: AsyncSession, row: YansiExperienceEvent
) -> tuple[bool, YansiExperienceEvent]:
    """Return (duplicate, row)."""
    try:
        db.add(row)
        await db.commit()
        await db.refresh(row)
        return False, row
    except IntegrityError:
        await db.rollback()
        existing = await _get_by_event_id(db, event_id=row.event_id)
        if existing is not None:
            return True, existing
        semantic = await _find_semantic_duplicate(
            db,
            event_type=row.event_type,
            experience_session_id=row.experience_session_id,
            completed_step_count=row.completed_step_count,
            destination_slug=row.destination_slug,
        )
        if semantic is not None:
            return True, semantic
        return True, row


async def _ensure_started(
    db: AsyncSession,
    *,
    slug: str,
    journey_version: int,
    experience_session_id: str,
    viewer_user_id: str | None,
    occurred_at: datetime | None,
) -> None:
    if await _session_has_event(
        db,
        experience_session_id=experience_session_id,
        event_type=YANSI_EXPERIENCE_STARTED,
        mirror_slug=slug,
        journey_version=journey_version,
    ):
        return
    row = YansiExperienceEvent(
        event_id=synthetic_started_event_id(experience_session_id),
        experience_session_id=experience_session_id,
        event_type=YANSI_EXPERIENCE_STARTED,
        mirror_slug=slug,
        journey_version=journey_version,
        viewer_user_id=viewer_user_id,
        completed_step_count=0,
        occurred_at=occurred_at,
    )
    await _insert_row(db, row)


async def ingest_yansi_experience_event(
    db: AsyncSession,
    *,
    slug: str,
    payload: dict[str, Any],
    viewer_user_id: str | None = None,
) -> dict[str, Any]:
    if payload_has_forbidden_fields(payload):
        raise YansiExperienceIngestError("privacy_rejected")

    slug_n = _norm_slug(slug)
    if not slug_n or len(slug_n) > _SLUG_MAX:
        raise YansiExperienceIngestError("invalid_slug")

    event_type = str(payload.get("eventType") or "").strip()
    if event_type not in YANSI_EXPERIENCE_EVENT_TYPES:
        raise YansiExperienceIngestError("invalid_event_type")

    event_id = _parse_uuid(str(payload.get("eventId") or ""), field="event_id")
    session_id = _parse_uuid(
        str(payload.get("experienceSessionId") or ""), field="experience_session_id"
    )

    try:
        journey_version = int(payload.get("journeyVersion"))
    except (TypeError, ValueError):
        raise YansiExperienceIngestError("invalid_journey_version")
    if journey_version < 1:
        raise YansiExperienceIngestError("invalid_journey_version")

    existing = await _get_by_event_id(db, event_id=event_id)
    if existing is not None:
        if (
            existing.experience_session_id != session_id
            or existing.event_type != event_type
        ):
            raise YansiExperienceIngestError("event_id_conflict")
        return {"accepted": True, "duplicate": True}

    public = await _require_public_frozen(
        db, slug=slug_n, journey_version=journey_version
    )
    selected_count = int(public["selectedCount"])
    occurred_at = _parse_occurred_at(
        str(payload["occurredAt"]) if payload.get("occurredAt") is not None else None
    )

    raw_steps = payload.get("completedStepCount")
    completed_step_count: Optional[int]
    if raw_steps is None or raw_steps == "":
        completed_step_count = 0 if event_type == YANSI_EXPERIENCE_STARTED else None
    else:
        try:
            completed_step_count = int(raw_steps)
        except (TypeError, ValueError):
            raise YansiExperienceIngestError("invalid_completed_step_count")

    destination = _norm_slug(payload.get("destinationSlug")) or None

    if event_type == YANSI_EXPERIENCE_STARTED:
        if completed_step_count is None:
            completed_step_count = 0
        if completed_step_count < 0 or completed_step_count >= selected_count:
            raise YansiExperienceIngestError("invalid_completed_step_count")
        if destination:
            raise YansiExperienceIngestError("unexpected_destination")

    elif event_type == YANSI_EXPERIENCE_COMPLETED:
        if completed_step_count != selected_count:
            raise YansiExperienceIngestError("invalid_completed_step_count")
        if destination:
            raise YansiExperienceIngestError("unexpected_destination")
        await _ensure_started(
            db,
            slug=slug_n,
            journey_version=journey_version,
            experience_session_id=session_id,
            viewer_user_id=viewer_user_id,
            occurred_at=occurred_at,
        )

    elif event_type == YANSI_EXPERIENCE_SKIPPED:
        if completed_step_count is None or completed_step_count < 1:
            raise YansiExperienceIngestError("skipped_requires_progress")
        if completed_step_count >= selected_count:
            raise YansiExperienceIngestError("skipped_requires_incomplete")
        if not destination or destination == slug_n:
            raise YansiExperienceIngestError("invalid_destination")
        # Destination must be a real public replayable Yansı. Direct-child
        # relationship is not required (alternate valid paths may exist).
        dest_public = await get_public_frozen_journey_artifact(
            db, slug=destination, journey_version=None
        )
        if dest_public is None:
            raise YansiExperienceIngestError("invalid_destination", status_code=404)
        if not await _session_has_event(
            db,
            experience_session_id=session_id,
            event_type=YANSI_EXPERIENCE_STARTED,
            mirror_slug=slug_n,
            journey_version=journey_version,
        ):
            raise YansiExperienceIngestError("started_required")

    semantic = await _find_semantic_duplicate(
        db,
        event_type=event_type,
        experience_session_id=session_id,
        completed_step_count=completed_step_count,
        destination_slug=destination,
    )
    if semantic is not None:
        return {"accepted": True, "duplicate": True}

    row = YansiExperienceEvent(
        event_id=event_id,
        experience_session_id=session_id,
        event_type=event_type,
        mirror_slug=slug_n,
        journey_version=journey_version,
        viewer_user_id=viewer_user_id,
        completed_step_count=completed_step_count,
        destination_slug=destination,
        occurred_at=occurred_at,
    )
    duplicate, _stored = await _insert_row(db, row)
    return {"accepted": True, "duplicate": duplicate}
