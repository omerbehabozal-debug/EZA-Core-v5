# -*- coding: utf-8 -*-
"""Katkılar Phase 5 — authenticated create on one exact frozen Yansı version.

The parent is slug + journeyVersion from resolve_katki_target. There is no
current-version fallback. Contributor identity comes from the session.

Successful-create quota is a count of yansi_contributions rows for that
user, including withdrawn and hidden rows. Redis request limiters are not
used: they count attempts, and their fallback is process-local.
"""

from __future__ import annotations

import logging
import zlib
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping
from uuid import UUID, uuid4

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.mirror_network import (
    KATKI_CONTRIBUTION_TYPES,
    YansiContribution,
)
from backend.services.mirror_network.katki_read import (
    _author_for_node,
    _created_at_iso,
    _load_discover_authors,
    project_public_katki_contributor,
)
from backend.services.mirror_network.katki_target import (
    KATKI_FORBIDDEN_ATTACHMENT_KEYS,
    KatkiTargetResolutionError,
    reject_forbidden_katki_attachment,
    resolve_katki_target,
)

logger = logging.getLogger(__name__)

_CONTRIBUTIONS = YansiContribution.__table__

KATKI_CREATE_HOURLY_LIMIT = 10
KATKI_CREATE_DAILY_LIMIT = 30
_HOUR = timedelta(hours=1)
_DAY = timedelta(days=1)
_BODY_MIN = 20
_BODY_MAX = 2000
_SOURCE_NOTE_MAX = 500
_ACTIVE_TYPE_INDEX = "uq_yansi_contributions_active_type"

# Phase 1 keys, plus the attachment and identity names create must refuse.
_CREATE_FORBIDDEN_KEYS = KATKI_FORBIDDEN_ATTACHMENT_KEYS | frozenset(
    {
        "conversationId",
        "scene_asset_id",
        "generation_id",
        "userId",
        "contributorUserId",
        "contributor_user_id",
        "messageId",
        "message_id",
        "sourceMessageId",
        "source_message_id",
    }
)


class KatkiCreateError(Exception):
    def __init__(self, code: str, *, status_code: int) -> None:
        super().__init__(code)
        self.code = code
        self.status_code = status_code


def _utc(now: datetime | None) -> datetime:
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        return current.replace(tzinfo=timezone.utc)
    return current


def _invalid(code: str) -> KatkiCreateError:
    return KatkiCreateError(code, status_code=422)


def _normalize_source_note(source_note: str | None) -> str | None:
    if source_note is None:
        return None
    if not isinstance(source_note, str):
        raise _invalid("invalid_source_note")
    trimmed = source_note.strip()
    if not trimmed:
        return None
    if len(trimmed) > _SOURCE_NOTE_MAX:
        raise _invalid("invalid_source_note")
    return trimmed


def _normalize_body(contribution_type: str, body: str | None) -> str | None:
    if body is None:
        trimmed = None
    elif not isinstance(body, str):
        raise _invalid("invalid_body")
    else:
        stripped = body.strip()
        trimmed = stripped or None

    if contribution_type == "verify" and trimmed is None:
        return None
    if trimmed is None or len(trimmed) < _BODY_MIN or len(trimmed) > _BODY_MAX:
        raise _invalid("invalid_body")
    return trimmed


def _reject_attachment_fields(fields: Mapping[str, Any]) -> None:
    try:
        reject_forbidden_katki_attachment(fields)
    except KatkiTargetResolutionError as exc:
        raise _invalid("forbidden_attachment") from exc
    if _CREATE_FORBIDDEN_KEYS.intersection(fields):
        raise _invalid("forbidden_attachment")


async def _acquire_create_lock(db: AsyncSession, actor_user_id: UUID) -> None:
    """Same transaction advisory lock the account quota uses. No-op off Postgres."""
    bind = db.get_bind()
    if bind is None or bind.dialect.name != "postgresql":
        return
    lock_id = zlib.crc32(f"{actor_user_id}:katki_create".encode("utf-8")) & 0x7FFFFFFF
    await db.execute(text("SELECT pg_advisory_xact_lock(:lock_id)"), {"lock_id": lock_id})


async def _created_since(db: AsyncSession, actor_user_id: UUID, since: datetime) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(_CONTRIBUTIONS)
        .where(
            _CONTRIBUTIONS.c.contributor_user_id == actor_user_id,
            _CONTRIBUTIONS.c.created_at > since,
        )
    )
    return int(result.scalar_one())


async def _has_active_contribution(
    db: AsyncSession,
    *,
    actor_user_id: UUID,
    slug: str,
    journey_version: int,
    contribution_type: str,
) -> bool:
    result = await db.execute(
        select(_CONTRIBUTIONS.c.id)
        .where(
            _CONTRIBUTIONS.c.contributor_user_id == actor_user_id,
            _CONTRIBUTIONS.c.slug == slug,
            _CONTRIBUTIONS.c.journey_version == journey_version,
            _CONTRIBUTIONS.c.contribution_type == contribution_type,
            _CONTRIBUTIONS.c.visibility != "withdrawn",
        )
        .limit(1)
    )
    return result.first() is not None


# SQLite reports the partial index by its column list, not by the index name.
_ACTIVE_TYPE_COLUMNS = (
    "contributor_user_id",
    "slug",
    "journey_version",
    "contribution_type",
)


def _is_active_type_conflict(exc: IntegrityError) -> bool:
    """True only for the active-type unique index, not for nearby column names."""
    orig = getattr(exc, "orig", None)
    diag = getattr(orig, "diag", None)
    constraint = getattr(diag, "constraint_name", None)
    if constraint == _ACTIVE_TYPE_INDEX:
        return True
    message = str(orig or exc)
    if _ACTIVE_TYPE_INDEX in message:
        return True
    lowered = message.lower()
    if "unique constraint failed" not in lowered:
        return False
    return all(column in lowered for column in _ACTIVE_TYPE_COLUMNS)


async def create_katki(
    db: AsyncSession,
    *,
    slug: str,
    actor_user_id: UUID,
    journey_version: int | None,
    contribution_type: str | None,
    body: str | None = None,
    source_note: str | None = None,
    raw_fields: Mapping[str, Any] | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    """
    Insert one visible Katkı for the authenticated user.

    `actor_user_id` is the session user. Payload fields cannot choose it.
    """
    if raw_fields is not None:
        _reject_attachment_fields(raw_fields)

    if not isinstance(contribution_type, str) or contribution_type not in KATKI_CONTRIBUTION_TYPES:
        raise _invalid("invalid_type")

    normalized_body = _normalize_body(contribution_type, body)
    normalized_note = _normalize_source_note(source_note)

    try:
        target = await resolve_katki_target(
            db,
            slug=slug,
            journey_version=journey_version,
        )
    except KatkiTargetResolutionError as exc:
        raise KatkiCreateError("frozen_journey_not_found", status_code=404) from exc

    created_at = _utc(now)
    await _acquire_create_lock(db, actor_user_id)
    hourly = await _created_since(db, actor_user_id, created_at - _HOUR)
    daily = await _created_since(db, actor_user_id, created_at - _DAY)
    if hourly >= KATKI_CREATE_HOURLY_LIMIT or daily >= KATKI_CREATE_DAILY_LIMIT:
        raise KatkiCreateError("katki_create_rate_limited", status_code=429)

    if await _has_active_contribution(
        db,
        actor_user_id=actor_user_id,
        slug=target.slug,
        journey_version=target.journey_version,
        contribution_type=contribution_type,
    ):
        raise KatkiCreateError("active_contribution_exists", status_code=409)

    public_id = uuid4()
    try:
        await db.execute(
            _CONTRIBUTIONS.insert().values(
                id=uuid4(),
                public_id=public_id,
                slug=target.slug,
                journey_version=target.journey_version,
                contribution_type=contribution_type,
                body=normalized_body,
                source_note=normalized_note,
                contributor_user_id=actor_user_id,
                visibility="visible",
                created_at=created_at,
            )
        )
        authors = await _load_discover_authors(db, [actor_user_id])
        author = _author_for_node(authors, actor_user_id)
        payload = {
            "contributionId": str(public_id),
            "type": contribution_type,
            "body": normalized_body,
            "sourceNote": normalized_note,
            "createdAt": _created_at_iso(created_at),
            "contributor": project_public_katki_contributor(author),
        }
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        if _is_active_type_conflict(exc):
            logger.info("katki_create_active_type_conflict")
            raise KatkiCreateError("active_contribution_exists", status_code=409)
        logger.exception("katki_create_integrity")
        raise KatkiCreateError("create_failed", status_code=500)

    logger.info("katki_created contribution_id=%s", public_id)
    return payload
