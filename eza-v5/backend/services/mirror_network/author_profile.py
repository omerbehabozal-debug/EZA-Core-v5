# -*- coding: utf-8 -*-
"""Phase 3.8 — public author published Yansılar + direct child listing."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.mirror_network import MirrorNetworkNode
from backend.models.production import User
from backend.services.mirror_network.impact import is_eligible_yansi_child
from backend.services.mirror_network.repository import get_mirror_network_node_by_slug
from backend.services.mirror_network.safety_gate import evaluate_mirror_network_safety
from backend.services.mirror_network.slug import build_mirror_share_url


def _public_display_name_from_email(email: str | None) -> str:
    raw = (email or "").strip()
    if "@" in raw:
        local = raw.split("@", 1)[0].strip()
        if local:
            return local
    return "Yazar"


def _item_from_node(node: MirrorNetworkNode) -> dict[str, Any]:
    public = node.public_payload if isinstance(node.public_payload, dict) else {}
    frozen_landing: dict[str, Any] = {}
    frozen_scene = None
    try:
        from backend.services.mirror_network.frozen_journey_artifact import (
            read_frozen_journey_artifact_from_private,
        )

        frozen = read_frozen_journey_artifact_from_private(
            node.private_payload if isinstance(node.private_payload, dict) else None
        )
        if frozen:
            raw_landing = frozen.get("publicLanding")
            if isinstance(raw_landing, dict):
                frozen_landing = raw_landing
            frozen_scene = frozen.get("sceneImageUrl")
    except Exception:
        pass
    title = (
        str(frozen_landing.get("publicTitle") or "").strip()
        or str(public.get("publicTitle") or "").strip()
        or str(node.card_title or "").strip()
        or "Yansı"
    )
    summary = (
        str(frozen_landing.get("publicSummary") or "").strip()
        or str(public.get("publicSummary") or "").strip()
        or str(public.get("curiosityContext") or "").strip()
        or None
    )
    return {
        "slug": node.slug,
        "shareUrl": build_mirror_share_url(node.slug),
        "publicTitle": title,
        "publicSummary": summary,
        "sceneImageUrl": frozen_scene or node.scene_image_url,
        "publishedAt": node.published_at.isoformat() if node.published_at else None,
        "parentSlug": (node.parent_slug or None),
    }


def _is_public_published(node: MirrorNetworkNode) -> bool:
    visibility = (node.visibility or "public").lower()
    if visibility == "private":
        return False
    if not evaluate_mirror_network_safety(node).passed:
        return False
    return True


async def list_published_mirrors_for_author(
    db: AsyncSession,
    *,
    user_id: UUID,
    limit: int = 48,
    offset: int = 0,
) -> dict[str, Any] | None:
    """
    Public profile contract: published/public Yansılar only.
    Never returns generating/ready/failed private panel states.
    """
    user = await db.get(User, user_id)
    if user is None or not bool(getattr(user, "is_active", True)):
        return None

    result = await db.execute(
        select(MirrorNetworkNode)
        .where(MirrorNetworkNode.user_id == user_id)
        .order_by(MirrorNetworkNode.published_at.desc().nullslast(), MirrorNetworkNode.created_at.desc())
    )
    nodes = [n for n in result.scalars().all() if _is_public_published(n)]
    total = len(nodes)
    page = nodes[offset : offset + max(1, min(limit, 100))]
    return {
        "userId": str(user_id),
        "displayName": _public_display_name_from_email(getattr(user, "email", None)),
        "items": [_item_from_node(n) for n in page],
        "total": total,
    }


async def list_published_direct_children(
    db: AsyncSession,
    *,
    parent_slug: str,
    limit: int = 48,
    offset: int = 0,
) -> dict[str, Any] | None:
    """Direct published children of a public parent Yansı — not a follower graph."""
    normalized = (parent_slug or "").strip().lower()
    if not normalized:
        return None
    parent = await get_mirror_network_node_by_slug(db, normalized)
    if parent is None or not _is_public_published(parent):
        return None

    result = await db.execute(
        select(MirrorNetworkNode)
        .where(func.lower(MirrorNetworkNode.parent_slug) == normalized)
        .order_by(MirrorNetworkNode.published_at.desc().nullslast(), MirrorNetworkNode.created_at.desc())
    )
    children = [n for n in result.scalars().all() if is_eligible_yansi_child(n)]
    total = len(children)
    page = children[offset : offset + max(1, min(limit, 100))]
    return {
        "parentSlug": normalized,
        "parentTitle": (
            str((parent.public_payload or {}).get("publicTitle") or "").strip()
            if isinstance(parent.public_payload, dict)
            else None
        )
        or parent.card_title,
        "items": [_item_from_node(n) for n in page],
        "total": total,
    }
