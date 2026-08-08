# -*- coding: utf-8 -*-
"""Persistence layer for Mirror Network nodes."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.mirror_network import (
    ARTIFACT_KIND_LEGACY_LANDING,
    MirrorNetworkNode,
)


async def get_mirror_network_node_by_slug(
    db: AsyncSession,
    slug: str,
) -> Optional[MirrorNetworkNode]:
    normalized = (slug or "").strip().lower()
    if not normalized:
        return None
    result = await db.execute(
        select(MirrorNetworkNode).where(MirrorNetworkNode.slug == normalized)
    )
    return result.scalar_one_or_none()


async def get_mirror_network_node_by_slug_for_user(
    db: AsyncSession,
    *,
    user_id: UUID,
    slug: str,
) -> Optional[MirrorNetworkNode]:
    """Owner-scoped journey lookup (Phase 1 journeyId identity)."""
    normalized = (slug or "").strip().lower()
    if not normalized:
        return None
    result = await db.execute(
        select(MirrorNetworkNode).where(
            MirrorNetworkNode.user_id == user_id,
            MirrorNetworkNode.slug == normalized,
        )
    )
    return result.scalar_one_or_none()


async def slug_exists(db: AsyncSession, slug: str) -> bool:
    node = await get_mirror_network_node_by_slug(db, slug)
    return node is not None


async def create_mirror_network_node(
    db: AsyncSession,
    node: MirrorNetworkNode,
) -> MirrorNetworkNode:
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return node


async def get_mirror_network_node_by_id(
    db: AsyncSession,
    node_id: UUID,
) -> Optional[MirrorNetworkNode]:
    result = await db.execute(select(MirrorNetworkNode).where(MirrorNetworkNode.id == node_id))
    return result.scalar_one_or_none()


async def get_mirror_network_node_by_conversation(
    db: AsyncSession,
    *,
    user_id: UUID,
    conversation_id: str,
) -> Optional[MirrorNetworkNode]:
    """
    Legacy publish lookup: only legacy_landing for this conversation.

    After journey identity, multiple nodes may share conversation_id — never
    return a journey_v1 node as the legacy upsert target (would corrupt identity).
    Migration sets artifact_kind default; null kind treated as legacy.
    """
    from sqlalchemy import or_

    normalized = (conversation_id or "").strip()
    if not normalized:
        return None
    result = await db.execute(
        select(MirrorNetworkNode)
        .where(
            MirrorNetworkNode.user_id == user_id,
            MirrorNetworkNode.conversation_id == normalized,
            or_(
                MirrorNetworkNode.artifact_kind == ARTIFACT_KIND_LEGACY_LANDING,
                MirrorNetworkNode.artifact_kind.is_(None),
            ),
        )
        .order_by(MirrorNetworkNode.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def list_journey_nodes_for_conversation(
    db: AsyncSession,
    *,
    user_id: UUID,
    conversation_id: str,
) -> list[MirrorNetworkNode]:
    """Owner journey_v1 nodes for one source conversation (deterministic parent chain)."""
    from backend.models.mirror_network import ARTIFACT_KIND_JOURNEY_V1

    normalized = (conversation_id or "").strip()
    if not normalized:
        return []
    result = await db.execute(
        select(MirrorNetworkNode)
        .where(
            MirrorNetworkNode.user_id == user_id,
            MirrorNetworkNode.conversation_id == normalized,
            MirrorNetworkNode.artifact_kind == ARTIFACT_KIND_JOURNEY_V1,
        )
        .order_by(MirrorNetworkNode.created_at.asc())
    )
    return list(result.scalars().all())


async def update_mirror_network_node(
    db: AsyncSession,
    node: MirrorNetworkNode,
) -> MirrorNetworkNode:
    await db.commit()
    await db.refresh(node)
    return node
