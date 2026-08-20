# -*- coding: utf-8 -*-
"""Phase 8.4 — owner unpublish + post-publish safety removal."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.mirror_network import MirrorNetworkNode
from backend.services.mirror_network.repository import get_mirror_network_node_by_slug

logger = logging.getLogger(__name__)

UnpublishStatus = Literal["unpublished", "already_unpublished"]
SafetyRemoveStatus = Literal["removed", "already_removed"]
VisibilitySetStatus = Literal["updated", "unchanged", "rejected"]


@dataclass(frozen=True)
class UnpublishResult:
    status: UnpublishStatus
    slug: str
    visibility: str
    safety_status: str


@dataclass(frozen=True)
class SafetyRemoveResult:
    status: SafetyRemoveStatus
    slug: str
    visibility: str
    safety_status: str


@dataclass(frozen=True)
class VisibilitySetResult:
    status: VisibilitySetStatus
    slug: str
    visibility: str
    safety_status: str
    reason: str | None = None


class YansiOwnershipError(Exception):
    """Caller is not the owner."""


class YansiNotFoundError(Exception):
    """Slug missing."""


async def _load_owned_node(
    db: AsyncSession,
    *,
    slug: str,
    owner_user_id: UUID,
) -> MirrorNetworkNode:
    node = await get_mirror_network_node_by_slug(db, slug)
    if node is None:
        raise YansiNotFoundError(slug)
    if UUID(str(node.user_id)) != UUID(str(owner_user_id)):
        raise YansiOwnershipError(slug)
    return node


async def unpublish_yansi_for_owner(
    db: AsyncSession,
    *,
    slug: str,
    owner_user_id: UUID,
) -> UnpublishResult:
    """
    Owner withdraw: visibility → private.
    Idempotent. Does not delete metrics, children, or freeze seal.
    """
    node = await _load_owned_node(db, slug=slug, owner_user_id=owner_user_id)
    visibility = (node.visibility or "").strip().lower()
    if visibility == "private":
        return UnpublishResult(
            status="already_unpublished",
            slug=node.slug,
            visibility="private",
            safety_status=(node.safety_status or "open"),
        )

    node.visibility = "private"
    node.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(node)
    logger.info(
        "yansi_unpublished slug=%s user_id=%s",
        node.slug,
        str(owner_user_id),
    )
    return UnpublishResult(
        status="unpublished",
        slug=node.slug,
        visibility="private",
        safety_status=(node.safety_status or "open"),
    )


async def set_yansi_visibility_for_owner(
    db: AsyncSession,
    *,
    slug: str,
    owner_user_id: UUID,
    visibility: str,
) -> VisibilitySetResult:
    """
    Owner may toggle public ↔ unlisted while safety remains open.
    Cannot reopen restricted / private-via-safety rows through this path —
    use unpublish for withdraw; safety-remove stays restricted until admin path.
    """
    target = (visibility or "").strip().lower()
    if target not in ("public", "unlisted"):
        return VisibilitySetResult(
            status="rejected",
            slug=slug,
            visibility=target,
            safety_status="open",
            reason="invalid_visibility",
        )

    node = await _load_owned_node(db, slug=slug, owner_user_id=owner_user_id)
    current = (node.visibility or "").strip().lower()
    safety = (node.safety_status or "open").strip().lower()

    if safety == "restricted":
        return VisibilitySetResult(
            status="rejected",
            slug=node.slug,
            visibility=current,
            safety_status=safety,
            reason="restricted_safety",
        )
    if current == "private":
        return VisibilitySetResult(
            status="rejected",
            slug=node.slug,
            visibility=current,
            safety_status=safety,
            reason="unpublished",
        )

    if current == target:
        return VisibilitySetResult(
            status="unchanged",
            slug=node.slug,
            visibility=current,
            safety_status=safety,
        )

    # Sensitive review rows stay unlisted — do not allow elevating to public
    # without clearing review (no review-approval workflow in 8.4).
    if safety == "review" and target == "public":
        return VisibilitySetResult(
            status="rejected",
            slug=node.slug,
            visibility=current,
            safety_status=safety,
            reason="pending_review",
        )

    node.visibility = target
    node.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(node)
    return VisibilitySetResult(
        status="updated",
        slug=node.slug,
        visibility=target,
        safety_status=(node.safety_status or "open"),
    )


async def apply_yansi_safety_removal(
    db: AsyncSession,
    *,
    slug: str,
) -> SafetyRemoveResult:
    """
    Post-publish safety removal: restricted + private.
    Idempotent. Preserves children / metrics / freeze rows.
    """
    node = await get_mirror_network_node_by_slug(db, slug)
    if node is None:
        raise YansiNotFoundError(slug)

    visibility = (node.visibility or "").strip().lower()
    safety = (node.safety_status or "").strip().lower()
    if visibility == "private" and safety == "restricted":
        return SafetyRemoveResult(
            status="already_removed",
            slug=node.slug,
            visibility="private",
            safety_status="restricted",
        )

    node.visibility = "private"
    node.safety_status = "restricted"
    node.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(node)
    logger.info("yansi_safety_removed slug=%s", node.slug)
    return SafetyRemoveResult(
        status="removed",
        slug=node.slug,
        visibility="private",
        safety_status="restricted",
    )
