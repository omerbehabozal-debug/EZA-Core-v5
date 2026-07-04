# -*- coding: utf-8 -*-
"""Public discover list — root Aynalar only (Stage Discover V1)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Mapping, Optional
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.schemas.mirror_network import DiscoverMirrorItem, DiscoverMirrorListResponse
from backend.models.mirror_network import MirrorNetworkNode
from backend.services.mirror_network.safety_gate import evaluate_mirror_network_safety

_DISCOVER_FORBIDDEN_KEYS = frozenset(
    {
        "userId",
        "user_id",
        "guestToken",
        "guest_token",
        "conversationId",
        "conversation_id",
        "mirrorBody",
        "private_payload",
        "behavioralSnapshot",
    }
)

DEFAULT_DISCOVER_LIMIT = 24
MAX_DISCOVER_LIMIT = 48
MAX_DISCOVER_OFFSET = 500
MAX_DISCOVER_CANDIDATE_SCAN = 250


def is_public_discover_scene_url(raw: str | None) -> bool:
    """Read-only validator — never persists or normalizes legacy data URLs."""
    value = (raw or "").strip()
    if not value:
        return False
    lower = value.lower()
    if lower.startswith(("data:", "blob:", "http:")):
        return False
    if not lower.startswith("https://"):
        return False
    try:
        parsed = urlparse(value)
        return parsed.scheme == "https" and bool(parsed.netloc)
    except ValueError:
        return False


def _public_discover_scene_url(raw: str | None) -> Optional[str]:
    if is_public_discover_scene_url(raw):
        return (raw or "").strip()
    return None


def is_public_discover_yansi_child(node: MirrorNetworkNode) -> bool:
    """Public aggregate — only public, open, safety-pass children."""
    if not (node.parent_slug or "").strip():
        return False
    if (node.visibility or "").lower() != "public":
        return False
    if (node.safety_status or "").lower() != "open":
        return False
    return evaluate_mirror_network_safety(node).passed


def _resolve_description(public_payload: Mapping[str, Any] | None) -> Optional[str]:
    if not public_payload:
        return None
    for key in ("curiosityContext", "landingContext"):
        raw = public_payload.get(key)
        if isinstance(raw, str):
            trimmed = raw.strip()
            if trimmed:
                return trimmed[:400]
    return None


def _is_discoverable_root(node: MirrorNetworkNode) -> Optional[str]:
    if (node.parent_slug or "").strip():
        return None
    if (node.visibility or "").lower() != "public":
        return None
    if (node.safety_status or "").lower() != "open":
        return None
    if not evaluate_mirror_network_safety(node).passed:
        return None
    return _public_discover_scene_url(node.scene_image_url)


def _batch_yansi_counts(
    children: list[MirrorNetworkNode],
) -> dict[str, int]:
    counts: dict[str, int] = {}
    for child in children:
        if not is_public_discover_yansi_child(child):
            continue
        parent = (child.parent_slug or "").strip().lower()
        if not parent:
            continue
        counts[parent] = counts.get(parent, 0) + 1
    return counts


def _published_iso(node: MirrorNetworkNode) -> Optional[str]:
    ts = node.published_at or node.created_at
    if isinstance(ts, datetime):
        return ts.isoformat()
    return None


def _to_discover_item(
    node: MirrorNetworkNode,
    *,
    scene_url: str,
    yansi_count: int,
) -> DiscoverMirrorItem:
    payload = node.public_payload if isinstance(node.public_payload, dict) else {}
    return DiscoverMirrorItem(
        slug=node.slug,
        title=(node.card_title or "").strip() or node.slug,
        description=_resolve_description(payload),
        sceneImageUrl=scene_url,
        yansiCount=yansi_count,
        createdAt=_published_iso(node),
    )


async def _fetch_children_for_parents(
    db: AsyncSession,
    parent_slugs: list[str],
) -> list[MirrorNetworkNode]:
    if not parent_slugs:
        return []
    normalized = [s.strip().lower() for s in parent_slugs if s.strip()]
    if not normalized:
        return []
    result = await db.execute(
        select(MirrorNetworkNode).where(
            MirrorNetworkNode.parent_slug.in_(normalized),
            MirrorNetworkNode.visibility == "public",
            MirrorNetworkNode.safety_status == "open",
        )
    )
    return list(result.scalars().all())


async def list_discover_mirrors(
    db: AsyncSession,
    *,
    limit: int = DEFAULT_DISCOVER_LIMIT,
    offset: int = 0,
) -> DiscoverMirrorListResponse:
    safe_limit = max(1, min(limit, MAX_DISCOVER_LIMIT))
    safe_offset = max(0, min(offset, MAX_DISCOVER_OFFSET))

    result = await db.execute(
        select(MirrorNetworkNode)
        .where(
            MirrorNetworkNode.visibility == "public",
            MirrorNetworkNode.safety_status == "open",
            MirrorNetworkNode.parent_slug.is_(None),
        )
        .order_by(MirrorNetworkNode.published_at.desc())
        .limit(MAX_DISCOVER_CANDIDATE_SCAN)
    )
    eligible: list[tuple[MirrorNetworkNode, str]] = []
    for node in result.scalars().all():
        scene_url = _is_discoverable_root(node)
        if scene_url:
            eligible.append((node, scene_url))

    slugs = [node.slug for node, _ in eligible]
    children = await _fetch_children_for_parents(db, slugs)
    yansi_by_parent = _batch_yansi_counts(children)

    def sort_key(item: tuple[MirrorNetworkNode, str]) -> tuple[int, float]:
        node, _ = item
        yansi = yansi_by_parent.get(node.slug.lower(), 0)
        ts = node.published_at or node.created_at
        epoch = ts.timestamp() if isinstance(ts, datetime) else 0.0
        return (-yansi, -epoch)

    eligible.sort(key=sort_key)
    page = eligible[safe_offset : safe_offset + safe_limit]
    items = [
        _to_discover_item(node, scene_url=scene_url, yansi_count=yansi_by_parent.get(node.slug.lower(), 0))
        for node, scene_url in page
    ]

    payload = DiscoverMirrorListResponse(items=items, total=len(eligible))
    leaked = _DISCOVER_FORBIDDEN_KEYS.intersection(payload.model_dump().keys())
    if leaked:
        raise RuntimeError(f"discover_response_privacy_violation:{','.join(sorted(leaked))}")
    return payload
