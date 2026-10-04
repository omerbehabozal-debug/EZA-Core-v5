# -*- coding: utf-8 -*-
"""Katkılar public read — version-scoped visible rows and live public identity.

The parent Yansı is resolved through resolve_katki_target before any
contribution row is read. Counts are visibility='visible' only.
Contributor identity is the existing Discover card projection, not a
second profile system.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.api_key import APIKey  # noqa: F401
from backend.models.application import Application  # noqa: F401
from backend.models.institution import Institution  # noqa: F401
from backend.models.mirror_network import KATKI_CONTRIBUTION_TYPES, YansiContribution
from backend.models.role import Role  # noqa: F401
from backend.models.user import LegacyUser  # noqa: F401
from backend.services.mirror_network.discover import (
    _author_for_node,
    _discover_public_avatar_revision,
    _discover_public_avatar_url,
    _load_discover_authors,
)
from backend.services.mirror_network.katki_target import (
    KatkiTargetResolutionError,
    resolve_katki_target,
)
from backend.services.mirror_network.public_identity import resolve_public_display_name

# Chronological. public_id breaks ties. Not rank, popularity, or trust.
_CONTRIBUTIONS = YansiContribution.__table__

PUBLIC_KATKI_RESPONSE_KEYS = frozenset(
    {
        "slug",
        "journeyVersion",
        "totalVisibleCount",
        "countsByType",
        "contributions",
        "viewerHasActiveVerify",
    }
)
PUBLIC_KATKI_CONTRIBUTION_KEYS = frozenset(
    {
        "contributionId",
        "type",
        "body",
        "sourceNote",
        "createdAt",
        "contributor",
    }
)
PUBLIC_KATKI_CONTRIBUTOR_KEYS = frozenset(
    {
        "displayName",
        "publicAvatarUrl",
        "publicAvatarRevision",
    }
)
PUBLIC_KATKI_COUNT_KEYS = frozenset(KATKI_CONTRIBUTION_TYPES)


class KatkiReadError(Exception):
    """Public read failed closed. Same 404 family as frozen replay."""

    def __init__(self, reason: str, *, status_code: int = 404) -> None:
        super().__init__(reason)
        self.reason = reason
        self.status_code = status_code


def _empty_counts() -> dict[str, int]:
    return {name: 0 for name in KATKI_CONTRIBUTION_TYPES}


def _created_at_iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def project_public_katki_contributor(author: Any) -> dict[str, Any]:
    """Same live name and avatar locator Discover puts on a public card."""
    return {
        "displayName": resolve_public_display_name(author),
        "publicAvatarUrl": _discover_public_avatar_url(author),
        "publicAvatarRevision": _discover_public_avatar_revision(author),
    }


def _visible_clause(slug: str, journey_version: int):
    return (
        _CONTRIBUTIONS.c.slug == slug,
        _CONTRIBUTIONS.c.journey_version == journey_version,
        _CONTRIBUTIONS.c.visibility == "visible",
    )


async def viewer_has_active_verify(
    db: AsyncSession,
    *,
    slug: str,
    journey_version: int,
    viewer_user_id: UUID | None,
) -> bool:
    """
    Exact active verify for this viewer.

    Hidden rows still occupy the active unique index, so they count.
    Withdrawn rows and other targets do not. This is not the public visible set.
    """
    if viewer_user_id is None:
        return False
    row = (
        await db.execute(
            select(_CONTRIBUTIONS.c.public_id)
            .where(
                _CONTRIBUTIONS.c.slug == slug,
                _CONTRIBUTIONS.c.journey_version == journey_version,
                _CONTRIBUTIONS.c.contributor_user_id == viewer_user_id,
                _CONTRIBUTIONS.c.contribution_type == "verify",
                _CONTRIBUTIONS.c.visibility != "withdrawn",
            )
            .limit(1)
        )
    ).first()
    return row is not None


async def get_public_katki_read(
    db: AsyncSession,
    *,
    slug: str,
    journey_version: int | None,
    viewer_user_id: UUID | None = None,
) -> dict[str, Any]:
    """
    Public Katkı list for one frozen version.

    Missing, unknown, unpublished, private, hidden, and not-replay-ready
    parents raise KatkiReadError and return nothing.
    """
    try:
        target = await resolve_katki_target(
            db,
            slug=slug,
            journey_version=journey_version,
        )
    except KatkiTargetResolutionError as exc:
        raise KatkiReadError("frozen_journey_not_found", status_code=404) from exc

    filters = _visible_clause(target.slug, target.journey_version)
    visible_rows = (
        await db.execute(
            select(
                _CONTRIBUTIONS.c.public_id,
                _CONTRIBUTIONS.c.contribution_type,
                _CONTRIBUTIONS.c.body,
                _CONTRIBUTIONS.c.source_note,
                _CONTRIBUTIONS.c.created_at,
                _CONTRIBUTIONS.c.contributor_user_id,
            )
            .where(*filters)
            .order_by(
                _CONTRIBUTIONS.c.created_at.asc(),
                _CONTRIBUTIONS.c.public_id.asc(),
            )
        )
    ).all()

    authors_by_id: dict[Any, Any] = {}
    if visible_rows:
        authors_by_id = await _load_discover_authors(
            db,
            [row[5] for row in visible_rows],
        )

    counts = _empty_counts()
    contributions: list[dict[str, Any]] = []
    for public_id, contribution_type, body, source_note, created_at, contributor_user_id in visible_rows:
        if contribution_type not in counts:
            raise KatkiReadError("frozen_journey_not_found", status_code=404)
        counts[contribution_type] += 1
        author = _author_for_node(authors_by_id, contributor_user_id)
        contributions.append(
            {
                "contributionId": str(public_id),
                "type": contribution_type,
                "body": body,
                "sourceNote": source_note,
                "createdAt": _created_at_iso(created_at),
                "contributor": project_public_katki_contributor(author),
            }
        )

    active_verify = await viewer_has_active_verify(
        db,
        slug=target.slug,
        journey_version=target.journey_version,
        viewer_user_id=viewer_user_id,
    )
    return {
        "slug": target.slug,
        "journeyVersion": target.journey_version,
        "totalVisibleCount": len(contributions),
        "countsByType": counts,
        "contributions": contributions,
        "viewerHasActiveVerify": active_verify,
    }
