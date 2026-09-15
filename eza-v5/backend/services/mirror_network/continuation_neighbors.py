# -*- coding: utf-8 -*-
"""
Slice 4 — true horizontal continuation neighbors.

Authority:
  same owner
  + same conversation_id
  + exact adjacent window_index (N±1)
  + agreeing window_start/window_end boundaries
  + independently public / frozen / replayReady

parent_slug is NEVER continuation authority (inspiration/provenance only).
Gaps fail closed — never skip private/unpublished windows.
"""

from __future__ import annotations

import logging
from typing import Any, Literal, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.mirror_network import ARTIFACT_KIND_JOURNEY_V1, MirrorNetworkNode
from backend.services.mirror_network.discover import is_canonical_discover_node_structure
from backend.services.mirror_network.frozen_journey_artifact import (
    get_public_frozen_journey_artifact,
)
from backend.services.mirror_network.journey_window_contract import block_range
from backend.services.mirror_network.repository import get_mirror_network_node_by_slug

logger = logging.getLogger(__name__)

ContinuationDirection = Literal["previous", "next"]


class ContinuationNeighborsError(Exception):
    def __init__(self, reason: str, *, status_code: int = 404):
        super().__init__(reason)
        self.reason = reason
        self.status_code = status_code


def _normalize_slug(value: str | None) -> str:
    return (value or "").strip().lower()


def _window_identity_agrees(node: MirrorNetworkNode) -> bool:
    """Fail closed when stored window fields disagree with Journey block arithmetic."""
    try:
        w_index = int(getattr(node, "window_index", None))
        w_start = int(getattr(node, "window_start", None))
        w_end = int(getattr(node, "window_end", None))
    except (TypeError, ValueError):
        return False
    if w_index < 0:
        return False
    expected_start, expected_end = block_range(w_index)
    return w_start == expected_start and w_end == expected_end


def _adjacent_boundary_ok(
    *,
    current: MirrorNetworkNode,
    candidate: MirrorNetworkNode,
    direction: ContinuationDirection,
) -> bool:
    if not _window_identity_agrees(current) or not _window_identity_agrees(candidate):
        return False
    try:
        c_index = int(current.window_index)
        c_start = int(current.window_start)
        c_end = int(current.window_end)
        n_index = int(candidate.window_index)
        n_start = int(candidate.window_start)
        n_end = int(candidate.window_end)
    except (TypeError, ValueError):
        return False

    if direction == "next":
        if n_index != c_index + 1:
            return False
        if n_start != c_end + 1:
            return False
        return True

    # previous
    if n_index != c_index - 1:
        return False
    if c_start != n_end + 1:
        return False
    return True


def _to_public_neighbor(node: MirrorNetworkNode) -> dict[str, Any]:
    return {
        "slug": _normalize_slug(node.slug),
        "journeyVersion": int(getattr(node, "journey_version", None) or 1),
    }


async def _is_public_continuation_eligible(
    db: AsyncSession,
    node: MirrorNetworkNode,
) -> bool:
    """Same essential public /m gates as Discover structure + frozen replayReady."""
    if not is_canonical_discover_node_structure(node):
        return False
    if not _window_identity_agrees(node):
        return False
    public = await get_public_frozen_journey_artifact(
        db,
        slug=node.slug,
        journey_version=int(getattr(node, "journey_version", None) or 1),
    )
    return public is not None and bool(public.get("replayReady"))


async def _nodes_at_window(
    db: AsyncSession,
    *,
    user_id: UUID,
    conversation_id: str,
    window_index: int,
) -> list[MirrorNetworkNode]:
    result = await db.execute(
        select(MirrorNetworkNode).where(
            MirrorNetworkNode.user_id == user_id,
            MirrorNetworkNode.conversation_id == conversation_id,
            MirrorNetworkNode.artifact_kind == ARTIFACT_KIND_JOURNEY_V1,
            MirrorNetworkNode.window_index == window_index,
        )
    )
    return list(result.scalars().all())


async def _resolve_adjacent_neighbor(
    db: AsyncSession,
    *,
    current: MirrorNetworkNode,
    direction: ContinuationDirection,
) -> Optional[dict[str, Any]]:
    if not _window_identity_agrees(current):
        return None

    try:
        current_index = int(current.window_index)
    except (TypeError, ValueError):
        return None

    if direction == "previous":
        if current_index <= 0:
            return None
        target_index = current_index - 1
    else:
        target_index = current_index + 1

    conv = (current.conversation_id or "").strip()
    user_id = getattr(current, "user_id", None)
    if not conv or user_id is None:
        return None

    candidates = await _nodes_at_window(
        db,
        user_id=user_id,
        conversation_id=conv,
        window_index=target_index,
    )
    # Ambiguous window occupancy (corruption/legacy) → fail closed, no leak.
    if len(candidates) != 1:
        if len(candidates) > 1:
            logger.info(
                "continuation_neighbors ambiguous window slug=%s direction=%s count=%s",
                _normalize_slug(current.slug),
                direction,
                len(candidates),
            )
        return None

    candidate = candidates[0]
    if not _adjacent_boundary_ok(
        current=current, candidate=candidate, direction=direction
    ):
        return None

    # parent_slug is ignored as authority (inspiration may set parent_slug across owners).

    if not await _is_public_continuation_eligible(db, candidate):
        return None

    return _to_public_neighbor(candidate)


async def get_continuation_neighbors(
    db: AsyncSession,
    *,
    slug: str,
) -> dict[str, Any]:
    """
    Resolve public previous/next continuation neighbors for a public consumable slug.

    Raises ContinuationNeighborsError(404) when the current slug is not publicly
    consumable — same posture as GET /{slug}/frozen.
    """
    normalized = _normalize_slug(slug)
    if not normalized:
        raise ContinuationNeighborsError("frozen_journey_not_found", status_code=404)

    current = await get_mirror_network_node_by_slug(db, normalized)
    if current is None:
        raise ContinuationNeighborsError("frozen_journey_not_found", status_code=404)

    # Current must itself be publicly consumable via frozen replay.
    public_current = await get_public_frozen_journey_artifact(
        db,
        slug=normalized,
        journey_version=int(getattr(current, "journey_version", None) or 1),
    )
    if public_current is None or not public_current.get("replayReady"):
        raise ContinuationNeighborsError("frozen_journey_not_found", status_code=404)

    previous = await _resolve_adjacent_neighbor(
        db, current=current, direction="previous"
    )
    next_neighbor = await _resolve_adjacent_neighbor(
        db, current=current, direction="next"
    )

    return {
        "slug": normalized,
        "journeyVersion": int(getattr(current, "journey_version", None) or 1),
        "previous": previous,
        "next": next_neighbor,
    }
