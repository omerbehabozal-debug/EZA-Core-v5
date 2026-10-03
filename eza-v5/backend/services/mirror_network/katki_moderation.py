# -*- coding: utf-8 -*-
"""Katkılar Phase 4 — withdraw, report, owner hide/restore, trust hide/restore.

A contribution is addressed by its public id. The stored slug + journeyVersion
is the parent. Nothing here creates a contribution or edits its text.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.mirror_network import (
    KATKI_REPORT_REASONS,
    MirrorNetworkNode,
    YansiContribution,
    YansiContributionReport,
)
from backend.services.mirror_network.katki_target import (
    KatkiTargetResolutionError,
    resolve_katki_target,
)

logger = logging.getLogger(__name__)

_CONTRIBUTIONS = YansiContribution.__table__
_NODES = MirrorNetworkNode.__table__
_REPORTS = YansiContributionReport.__table__

_WITHDRAWABLE = ("visible", "hidden_by_owner", "hidden_by_trust")


class KatkiModerationError(Exception):
    def __init__(self, code: str, *, status_code: int) -> None:
        super().__init__(code)
        self.code = code
        self.status_code = status_code


@dataclass(frozen=True)
class KatkiMutationResult:
    status: str
    contribution_id: str
    visibility: str


@dataclass(frozen=True)
class KatkiReportResult:
    status: str
    contribution_id: str
    reason: str


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_uuid(value: Any) -> UUID:
    if isinstance(value, UUID):
        return value
    return UUID(str(value))


def _same_user(left: Any, right: Any) -> bool:
    return _as_uuid(left).hex == _as_uuid(right).hex


def _not_found() -> KatkiModerationError:
    return KatkiModerationError("not_found", status_code=404)


def _forbidden() -> KatkiModerationError:
    return KatkiModerationError("forbidden", status_code=403)


def _conflict(code: str) -> KatkiModerationError:
    return KatkiModerationError(code, status_code=409)


async def _load(db: AsyncSession, public_id: UUID):
    result = await db.execute(
        select(
            _CONTRIBUTIONS.c.id,
            _CONTRIBUTIONS.c.public_id,
            _CONTRIBUTIONS.c.slug,
            _CONTRIBUTIONS.c.journey_version,
            _CONTRIBUTIONS.c.visibility,
            _CONTRIBUTIONS.c.contributor_user_id,
        ).where(_CONTRIBUTIONS.c.public_id == public_id)
    )
    return result.mappings().first()


async def _parent_owner_id(db: AsyncSession, slug: str) -> Any:
    result = await db.execute(select(_NODES.c.user_id).where(_NODES.c.slug == slug))
    return result.scalar_one_or_none()


async def _apply(
    db: AsyncSession,
    *,
    public_id: UUID,
    from_states: tuple[str, ...],
    values: dict[str, Any],
    extra_where: tuple = (),
) -> bool:
    result = await db.execute(
        update(_CONTRIBUTIONS)
        .where(
            _CONTRIBUTIONS.c.public_id == public_id,
            _CONTRIBUTIONS.c.visibility.in_(from_states),
            *extra_where,
        )
        .values(**values)
        .returning(_CONTRIBUTIONS.c.public_id)
    )
    updated = result.first()
    if updated is None:
        return False
    await db.commit()
    return True


async def withdraw_katki(
    db: AsyncSession,
    *,
    public_id: UUID,
    actor_user_id: UUID,
) -> KatkiMutationResult:
    """Contributor removes their own row from the public read. Terminal."""
    row = await _load(db, public_id)
    if row is None:
        raise _not_found()
    if not _same_user(row["contributor_user_id"], actor_user_id):
        raise _forbidden()
    if row["visibility"] == "withdrawn":
        raise _conflict("already_withdrawn")
    if row["visibility"] not in _WITHDRAWABLE:
        raise _conflict("transition_forbidden")

    applied = await _apply(
        db,
        public_id=public_id,
        from_states=_WITHDRAWABLE,
        values={"visibility": "withdrawn", "withdrawn_at": _now()},
        extra_where=(_CONTRIBUTIONS.c.contributor_user_id == actor_user_id,),
    )
    if not applied:
        raise _conflict("already_withdrawn")
    logger.info("katki_withdrawn contribution_id=%s", public_id)
    return KatkiMutationResult(
        status="withdrawn",
        contribution_id=str(public_id),
        visibility="withdrawn",
    )


async def report_katki(
    db: AsyncSession,
    *,
    public_id: UUID,
    reporter_user_id: UUID,
    reason: str,
) -> KatkiReportResult:
    """One report per reporter. Does not change visibility or text."""
    normalized = (reason or "").strip().lower()
    if normalized not in KATKI_REPORT_REASONS:
        raise KatkiModerationError("invalid_reason", status_code=400)

    row = await _load(db, public_id)
    if row is None or row["visibility"] != "visible":
        raise _not_found()
    try:
        await resolve_katki_target(
            db,
            slug=row["slug"],
            journey_version=int(row["journey_version"]),
        )
    except KatkiTargetResolutionError as exc:
        raise _not_found() from exc

    try:
        await db.execute(
            _REPORTS.insert().values(
                id=uuid.uuid4(),
                contribution_id=row["id"],
                reporter_user_id=reporter_user_id,
                reason=normalized,
                created_at=_now(),
            )
        )
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise _conflict("already_reported") from exc

    logger.info("katki_reported contribution_id=%s reason=%s", public_id, normalized)
    return KatkiReportResult(
        status="reported",
        contribution_id=str(public_id),
        reason=normalized,
    )


async def owner_hide_katki(
    db: AsyncSession,
    *,
    public_id: UUID,
    actor_user_id: UUID,
) -> KatkiMutationResult:
    row = await _load(db, public_id)
    if row is None:
        raise _not_found()
    owner_id = await _parent_owner_id(db, row["slug"])
    if owner_id is None:
        raise _not_found()
    if not _same_user(owner_id, actor_user_id):
        raise _forbidden()
    if row["visibility"] == "hidden_by_owner":
        raise _conflict("already_hidden")
    if row["visibility"] != "visible":
        raise _conflict("transition_forbidden")

    applied = await _apply(
        db,
        public_id=public_id,
        from_states=("visible",),
        values={
            "visibility": "hidden_by_owner",
            "hidden_at": _now(),
            "hidden_by_user_id": actor_user_id,
        },
    )
    if not applied:
        raise _conflict("already_hidden")
    logger.info("katki_owner_hidden contribution_id=%s", public_id)
    return KatkiMutationResult(
        status="hidden",
        contribution_id=str(public_id),
        visibility="hidden_by_owner",
    )


async def owner_restore_katki(
    db: AsyncSession,
    *,
    public_id: UUID,
    actor_user_id: UUID,
) -> KatkiMutationResult:
    row = await _load(db, public_id)
    if row is None:
        raise _not_found()
    owner_id = await _parent_owner_id(db, row["slug"])
    if owner_id is None:
        raise _not_found()
    if not _same_user(owner_id, actor_user_id):
        raise _forbidden()
    if row["visibility"] == "visible":
        raise _conflict("already_visible")
    if row["visibility"] != "hidden_by_owner":
        raise _conflict("transition_forbidden")

    applied = await _apply(
        db,
        public_id=public_id,
        from_states=("hidden_by_owner",),
        values={"visibility": "visible", "hidden_at": None, "hidden_by_user_id": None},
    )
    if not applied:
        raise _conflict("transition_forbidden")
    logger.info("katki_owner_restored contribution_id=%s", public_id)
    return KatkiMutationResult(
        status="restored",
        contribution_id=str(public_id),
        visibility="visible",
    )


async def trust_hide_katki(
    db: AsyncSession,
    *,
    public_id: UUID,
) -> KatkiMutationResult:
    """Trust API key. Does not write a production user into hidden_by_user_id."""
    row = await _load(db, public_id)
    if row is None:
        raise _not_found()
    if row["visibility"] == "hidden_by_trust":
        raise _conflict("already_hidden")
    if row["visibility"] != "visible":
        raise _conflict("transition_forbidden")

    applied = await _apply(
        db,
        public_id=public_id,
        from_states=("visible",),
        values={"visibility": "hidden_by_trust", "hidden_at": _now()},
    )
    if not applied:
        raise _conflict("already_hidden")
    logger.info("katki_trust_hidden contribution_id=%s", public_id)
    return KatkiMutationResult(
        status="hidden",
        contribution_id=str(public_id),
        visibility="hidden_by_trust",
    )


async def trust_restore_katki(
    db: AsyncSession,
    *,
    public_id: UUID,
) -> KatkiMutationResult:
    """Restores only a trust hide. Owner hides and withdrawals stay in place."""
    row = await _load(db, public_id)
    if row is None:
        raise _not_found()
    if row["visibility"] == "visible":
        raise _conflict("already_visible")
    if row["visibility"] != "hidden_by_trust":
        raise _conflict("transition_forbidden")

    applied = await _apply(
        db,
        public_id=public_id,
        from_states=("hidden_by_trust",),
        values={"visibility": "visible", "hidden_at": None},
    )
    if not applied:
        raise _conflict("transition_forbidden")
    logger.info("katki_trust_restored contribution_id=%s", public_id)
    return KatkiMutationResult(
        status="restored",
        contribution_id=str(public_id),
        visibility="visible",
    )
