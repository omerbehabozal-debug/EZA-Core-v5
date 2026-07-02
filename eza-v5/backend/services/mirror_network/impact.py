# -*- coding: utf-8 -*-
"""Owner-only Mirror Network impact stats (Faz 2 — Yansı)."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.observation.experience_event_flags import is_experience_event_logging_enabled
from backend.core.schemas.mirror_network import MirrorNetworkImpactStats
from backend.models.experience_event import ExperienceEvent
from backend.models.mirror_network import MirrorNetworkNode
from backend.services.mirror_network.repository import get_mirror_network_node_by_slug
from backend.services.mirror_network.slug import build_mirror_share_url

_IMPACT_FORBIDDEN_RESPONSE_KEYS = frozenset(
    {
        "userId",
        "guestToken",
        "guest_token_hash",
        "session_id",
        "sessionId",
        "conversationId",
        "mirrorBody",
        "private_payload",
        "behavioralSnapshot",
        "events",
        "event_list",
    }
)


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "mirror_not_found", "message": "Mirror not found"},
    )


def _forbidden() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": "mirror_impact_forbidden", "message": "Not allowed"},
    )


async def count_yansi_children(db: AsyncSession, parent_slug: str) -> int:
    normalized = (parent_slug or "").strip().lower()
    if not normalized:
        return 0
    result = await db.execute(
        select(func.count())
        .select_from(MirrorNetworkNode)
        .where(MirrorNetworkNode.parent_slug == normalized)
    )
    return int(result.scalar() or 0)


async def count_continuation_starts(db: AsyncSession, mirror_slug: str) -> int:
    if not is_experience_event_logging_enabled():
        return 0
    normalized = (mirror_slug or "").strip()
    if not normalized:
        return 0
    actor_key = func.coalesce(
        ExperienceEvent.user_id,
        ExperienceEvent.guest_token_hash,
        ExperienceEvent.session_id,
    )
    result = await db.execute(
        select(func.count(func.distinct(actor_key))).where(
            ExperienceEvent.event_type == "guest_conversation_started",
            ExperienceEvent.mirror_id == normalized,
            actor_key.isnot(None),
        )
    )
    return int(result.scalar() or 0)


async def count_landing_views(db: AsyncSession, mirror_slug: str) -> int:
    if not is_experience_event_logging_enabled():
        return 0
    normalized = (mirror_slug or "").strip()
    if not normalized:
        return 0
    result = await db.execute(
        select(func.count())
        .select_from(ExperienceEvent)
        .where(
            ExperienceEvent.event_type == "landing_viewed",
            ExperienceEvent.mirror_id == normalized,
        )
    )
    return int(result.scalar() or 0)


async def get_mirror_impact_stats(
    db: AsyncSession,
    slug: str,
    owner_user_id: UUID,
) -> MirrorNetworkImpactStats:
    node = await get_mirror_network_node_by_slug(db, slug)
    if not node:
        raise _not_found()
    if node.user_id != owner_user_id:
        raise _forbidden()

    normalized_slug = node.slug
    stats = MirrorNetworkImpactStats(
        mirrorId=normalized_slug,
        publicSlug=normalized_slug,
        shareUrl=build_mirror_share_url(normalized_slug),
        continuationStarts=await count_continuation_starts(db, normalized_slug),
        yansiCount=await count_yansi_children(db, normalized_slug),
        landingViews=await count_landing_views(db, normalized_slug),
    )
    payload = stats.model_dump()
    leaked = _IMPACT_FORBIDDEN_RESPONSE_KEYS.intersection(payload.keys())
    if leaked:
        raise RuntimeError(f"impact_response_privacy_violation:{','.join(sorted(leaked))}")
    return stats
