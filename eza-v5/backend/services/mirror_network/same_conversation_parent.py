# -*- coding: utf-8 -*-
"""Same-conversation deterministic parent linkage (owner continuation)."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.mirror_network import ARTIFACT_KIND_JOURNEY_V1, MirrorNetworkNode
from backend.services.mirror_network.parent_lineage import normalize_parent_slug
from backend.services.mirror_network.repository import (
    get_mirror_network_node_by_slug,
    list_journey_nodes_for_conversation,
)


def _reject(code: str, message: str, http_status: int = status.HTTP_400_BAD_REQUEST) -> HTTPException:
    return HTTPException(
        status_code=http_status,
        detail={"code": code, "message": message},
    )


async def resolve_same_conversation_parent(
    db: AsyncSession,
    *,
    user_id: UUID,
    conversation_id: str,
    requested_parent_slug: str,
    child_slug: str,
    child_window_index: int,
    child_window_start: int,
) -> str:
    """
    Allow parentSlug without lineageProofToken when:

    - same authenticated owner
    - same sourceConversationId
    - parent is published journey_v1
    - parent window precedes child window
    - requested parent is the most recent eligible published parent
      (highest windowIndex / window_end among prior journeys)
    """
    parent_slug = normalize_parent_slug(requested_parent_slug)
    child = normalize_parent_slug(child_slug)
    conv = (conversation_id or "").strip()
    if not parent_slug or not conv:
        raise _reject(
            "journey_parent_invalid",
            "same-conversation parent requires parentSlug and conversationId",
        )
    if parent_slug == child:
        raise _reject("invalid_parent_slug", "parentSlug cannot reference the same mirror")

    parent = await get_mirror_network_node_by_slug(db, parent_slug)
    if parent is None:
        raise _reject("parent_not_found", "parentSlug does not reference an existing mirror")

    if parent.user_id != user_id:
        # Cross-user / external continuation — caller must use lineageProofToken.
        raise _reject(
            "lineage_proof_required",
            "cross-user parentSlug requires a server-verified lineageProofToken",
        )

    parent_conv = (parent.conversation_id or "").strip()
    if parent_conv != conv:
        raise _reject(
            "lineage_proof_required",
            "parent outside this conversation requires a lineageProofToken",
        )

    if (parent.artifact_kind or "").strip() != ARTIFACT_KIND_JOURNEY_V1:
        raise _reject(
            "journey_parent_invalid",
            "same-conversation parent must be a published journey_v1 node",
        )
    if parent.published_at is None:
        raise _reject(
            "journey_parent_invalid",
            "same-conversation parent must be published",
        )

    parent_window_index = getattr(parent, "window_index", None)
    parent_window_end = getattr(parent, "window_end", None)
    if parent_window_index is None or parent_window_end is None:
        raise _reject(
            "journey_parent_invalid",
            "parent journey is missing persisted window identity",
        )
    if int(parent_window_index) >= int(child_window_index):
        raise _reject(
            "journey_parent_invalid",
            "parent window must precede child window",
        )
    if int(parent_window_end) >= int(child_window_start):
        raise _reject(
            "journey_parent_invalid",
            "parent windowEnd must be before child windowStart",
        )

    siblings = await list_journey_nodes_for_conversation(
        db,
        user_id=user_id,
        conversation_id=conv,
    )
    eligible_parents = [
        node
        for node in siblings
        if node.published_at is not None
        and getattr(node, "window_index", None) is not None
        and int(node.window_index) < int(child_window_index)
        and getattr(node, "window_end", None) is not None
        and int(node.window_end) < int(child_window_start)
        and (node.slug or "").strip().lower() != (child or "")
    ]
    if not eligible_parents:
        raise _reject(
            "journey_parent_invalid",
            "no eligible published parent exists for this window",
        )

    eligible_parents.sort(
        key=lambda n: (
            int(n.window_index or -1),
            int(n.window_end or -1),
            n.published_at.isoformat() if n.published_at else "",
        ),
        reverse=True,
    )
    expected = (eligible_parents[0].slug or "").strip().lower()
    if expected != parent_slug:
        raise _reject(
            "journey_parent_invalid",
            "parentSlug must be the most recent published journey in this conversation",
        )

    return parent_slug


async def latest_eligible_same_conversation_parent_slug(
    db: AsyncSession,
    *,
    user_id: UUID,
    conversation_id: str,
    child_slug: str,
    child_window_index: int,
    child_window_start: int,
) -> Optional[str]:
    """Most recent published journey_v1 in this conversation that precedes the child window."""
    conv = (conversation_id or "").strip()
    child = normalize_parent_slug(child_slug)
    if not conv:
        return None
    siblings = await list_journey_nodes_for_conversation(
        db,
        user_id=user_id,
        conversation_id=conv,
    )
    eligible_parents = [
        node
        for node in siblings
        if node.published_at is not None
        and getattr(node, "window_index", None) is not None
        and int(node.window_index) < int(child_window_index)
        and getattr(node, "window_end", None) is not None
        and int(node.window_end) < int(child_window_start)
        and (node.slug or "").strip().lower() != (child or "")
        and (node.artifact_kind or "").strip() == ARTIFACT_KIND_JOURNEY_V1
    ]
    if not eligible_parents:
        return None
    eligible_parents.sort(
        key=lambda n: (
            int(n.window_index or -1),
            int(n.window_end or -1),
            n.published_at.isoformat() if n.published_at else "",
        ),
        reverse=True,
    )
    return (eligible_parents[0].slug or "").strip().lower() or None


async def resolve_verified_continuation_parent(
    db: AsyncSession,
    *,
    origin_parent_slug: str,
    requested_parent_slug: Optional[str],
    user_id: UUID,
    conversation_id: str | None,
    child_slug: str,
    child_window_index: int | None,
    child_window_start: int | None,
) -> str:
    """
    Phase 5.2 — parent for a Journey published from a verified Yansı continuation.

    window 0 (or missing): originating Yansı from lineage proof.
    later windows: latest READY/published prior Journey in this conversation,
    otherwise originating Yansı (never fail-open as root).

    Client parentSlug, when sent, must match the resolved parent (forged C rejected).
    """
    origin = normalize_parent_slug(origin_parent_slug)
    if not origin:
        raise _reject("lineage_proof_invalid", "continuation origin parent is missing")

    window_index = int(child_window_index) if child_window_index is not None else 0
    window_start = int(child_window_start) if child_window_start is not None else 0
    resolved = origin
    if window_index > 0 and (conversation_id or "").strip():
        latest = await latest_eligible_same_conversation_parent_slug(
            db,
            user_id=user_id,
            conversation_id=conversation_id or "",
            child_slug=child_slug,
            child_window_index=window_index,
            child_window_start=window_start,
        )
        if latest:
            resolved = latest

    requested = normalize_parent_slug(requested_parent_slug)
    if requested and requested != resolved:
        raise _reject(
            "journey_parent_invalid",
            "requested parentSlug does not match verified continuation lineage",
        )
    return resolved


def is_same_conversation_parent_candidate(
    *,
    parent_node: Optional[MirrorNetworkNode],
    user_id: UUID,
    conversation_id: str,
) -> bool:
    """True when parent looks like owner same-conversation continuation."""
    if parent_node is None:
        return False
    if parent_node.user_id != user_id:
        return False
    return (parent_node.conversation_id or "").strip() == (conversation_id or "").strip()
