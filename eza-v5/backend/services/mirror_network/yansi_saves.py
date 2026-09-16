# -*- coding: utf-8 -*-
"""Slice 5 — Merakıma ekle / Meraklarım (account-bound Save bookmarks)."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.mirror_network import MirrorNetworkNode, MirrorNetworkSave
from backend.models.production import User
from backend.services.mirror_network.frozen_journey_artifact import (
    get_public_frozen_journey_artifact,
)
from backend.services.mirror_network.public_identity import (
    resolve_public_display_name,
    resolve_public_honorific,
)
from backend.services.mirror_network.repository import get_mirror_network_node_by_slug
from backend.services.mirror_network.visibility_access import is_direct_link_accessible
from backend.services.profile_avatar_store import normalize_profile_avatar_public_locator

logger = logging.getLogger(__name__)

SaveMutationStatus = Literal["saved", "already_saved", "removed", "already_removed"]
SaveAvailability = Literal["available", "unavailable"]

DEFAULT_SAVED_LIST_LIMIT = 48
MAX_SAVED_LIST_LIMIT = 100
MAX_SAVED_LIST_OFFSET = 500


class YansiSaveNotAllowedError(Exception):
    """Target missing or not currently consumable — fail closed."""

    def __init__(self, reason: str = "not_savable"):
        super().__init__(reason)
        self.reason = reason


class YansiSelfSaveNotAllowedError(Exception):
    """Owner must not bookmark their own Yansı."""


@dataclass(frozen=True)
class SaveMutationResult:
    status: SaveMutationStatus
    slug: str
    saved: bool


def _normalize_slug(value: str | None) -> str:
    return (value or "").strip().lower()


async def _load_savable_node(
    db: AsyncSession,
    *,
    slug: str,
) -> MirrorNetworkNode:
    """
    Save requires current consumability (same family as public /m frozen).

    Direct-link accessibility + public frozen/replay-ready artifact.
    Never confirms private/restricted existence distinctly.
    """
    node = await get_mirror_network_node_by_slug(db, slug)
    if node is None or not is_direct_link_accessible(node):
        raise YansiSaveNotAllowedError("not_savable")
    public = await get_public_frozen_journey_artifact(db, slug=node.slug)
    if public is None:
        raise YansiSaveNotAllowedError("not_savable")
    return node


def _build_save_row(
    *,
    user_id: UUID,
    slug: str,
    node_id: UUID,
    created_at: datetime,
) -> MirrorNetworkSave:
    return MirrorNetworkSave(
        id=uuid.uuid4(),
        user_id=user_id,
        mirror_slug=slug,
        mirror_node_id=node_id,
        created_at=created_at,
    )


async def is_slug_saved_for_user(
    db: AsyncSession,
    *,
    user_id: UUID,
    slug: str,
) -> bool:
    normalized = _normalize_slug(slug)
    if not normalized:
        return False
    result = await db.execute(
        select(MirrorNetworkSave.id).where(
            MirrorNetworkSave.user_id == user_id,
            MirrorNetworkSave.mirror_slug == normalized,
        )
    )
    return result.scalar_one_or_none() is not None


async def save_yansi_for_user(
    db: AsyncSession,
    *,
    user_id: UUID,
    slug: str,
) -> SaveMutationResult:
    node = await _load_savable_node(db, slug=slug)
    if UUID(str(node.user_id)) == UUID(str(user_id)):
        raise YansiSelfSaveNotAllowedError()

    normalized = _normalize_slug(node.slug)
    existing = await db.execute(
        select(MirrorNetworkSave).where(
            MirrorNetworkSave.user_id == user_id,
            MirrorNetworkSave.mirror_slug == normalized,
        )
    )
    prior = existing.scalar_one_or_none()
    if prior is not None:
        return SaveMutationResult(
            status="already_saved",
            slug=normalized,
            saved=True,
        )

    row = _build_save_row(
        user_id=user_id,
        slug=normalized,
        node_id=node.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        return SaveMutationResult(
            status="already_saved",
            slug=normalized,
            saved=True,
        )
    logger.info("yansi_saved slug=%s user_id=%s", normalized, str(user_id))
    return SaveMutationResult(status="saved", slug=normalized, saved=True)


async def unsave_yansi_for_user(
    db: AsyncSession,
    *,
    user_id: UUID,
    slug: str,
) -> SaveMutationResult:
    normalized = _normalize_slug(slug)
    if not normalized:
        return SaveMutationResult(
            status="already_removed",
            slug="",
            saved=False,
        )
    result = await db.execute(
        delete(MirrorNetworkSave).where(
            MirrorNetworkSave.user_id == user_id,
            MirrorNetworkSave.mirror_slug == normalized,
        )
    )
    await db.commit()
    removed = int(result.rowcount or 0) > 0
    return SaveMutationResult(
        status="removed" if removed else "already_removed",
        slug=normalized,
        saved=False,
    )


def _unavailable_item(*, slug: str, saved_at: datetime) -> dict[str, Any]:
    return {
        "slug": slug,
        "savedAt": saved_at.isoformat(),
        "availability": "unavailable",
    }


async def _available_item(
    db: AsyncSession,
    *,
    node: MirrorNetworkNode,
    saved_at: datetime,
) -> dict[str, Any] | None:
    public = await get_public_frozen_journey_artifact(db, slug=node.slug)
    if public is None or not is_direct_link_accessible(node):
        return None

    author: User | None = await db.get(User, node.user_id)
    item: dict[str, Any] = {
        "slug": node.slug,
        "savedAt": saved_at.isoformat(),
        "availability": "available",
        "journeyVersion": int(public.get("journeyVersion") or getattr(node, "journey_version", 1) or 1),
        "publicTitle": (
            str(public.get("publicTitle") or "").strip()
            or str(getattr(node, "card_title", "") or "").strip()
            or "Yansı"
        ),
        "sceneImageUrl": (
            str(public.get("sceneImageUrl") or "").strip()
            or str(getattr(node, "scene_image_url", "") or "").strip()
            or None
        ),
        "authorUserId": str(node.user_id),
        "authorDisplayName": resolve_public_display_name(author),
        "publicHonorific": resolve_public_honorific(author),
        "publicAvatarUrl": normalize_profile_avatar_public_locator(
            getattr(author, "public_avatar_url", None) if author else None
        ),
    }
    return item


async def list_saved_yansilar_for_user(
    db: AsyncSession,
    *,
    user_id: UUID,
    limit: int = DEFAULT_SAVED_LIST_LIMIT,
    offset: int = 0,
) -> dict[str, Any]:
    if limit < 1 or limit > MAX_SAVED_LIST_LIMIT:
        raise ValueError("invalid_list_limit")
    if offset < 0 or offset > MAX_SAVED_LIST_OFFSET:
        raise ValueError("invalid_list_offset")

    total_result = await db.execute(
        select(func.count())
        .select_from(MirrorNetworkSave)
        .where(MirrorNetworkSave.user_id == user_id)
    )
    total = int(total_result.scalar_one() or 0)

    rows_result = await db.execute(
        select(MirrorNetworkSave)
        .where(MirrorNetworkSave.user_id == user_id)
        .order_by(
            MirrorNetworkSave.created_at.desc(),
            MirrorNetworkSave.mirror_slug.asc(),
        )
        .offset(offset)
        .limit(limit)
    )
    saves = list(rows_result.scalars().all())

    items: list[dict[str, Any]] = []
    for save in saves:
        slug = _normalize_slug(save.mirror_slug)
        saved_at = save.created_at or datetime.now(timezone.utc)
        node = await get_mirror_network_node_by_slug(db, slug)
        if node is None:
            items.append(_unavailable_item(slug=slug, saved_at=saved_at))
            continue
        available = await _available_item(db, node=node, saved_at=saved_at)
        if available is None:
            items.append(_unavailable_item(slug=slug, saved_at=saved_at))
        else:
            items.append(available)

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }
