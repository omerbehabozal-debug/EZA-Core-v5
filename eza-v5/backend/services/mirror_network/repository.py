# -*- coding: utf-8 -*-
"""Persistence layer for Mirror Network nodes."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.mirror_network import MirrorNetworkNode


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
    normalized = (conversation_id or "").strip()
    if not normalized:
        return None
    result = await db.execute(
        select(MirrorNetworkNode).where(
            MirrorNetworkNode.user_id == user_id,
            MirrorNetworkNode.conversation_id == normalized,
        )
    )
    return result.scalar_one_or_none()


async def update_mirror_network_node(
    db: AsyncSession,
    node: MirrorNetworkNode,
) -> MirrorNetworkNode:
    await db.commit()
    await db.refresh(node)
    return node
