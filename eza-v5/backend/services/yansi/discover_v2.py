"""Discover eligibility helpers for Yansı V2 publications.

V1 Discover remains journey_v1 + frozen + replayReady + HTTPS scene.
V2 uses an explicit, version-aware rule and never coerces V2 manifests into
the V1 frozen Journey shape.

Stage 04B: ``load_merged_discover_eligible_nodes`` appends this pool into
``list_discover_mirrors`` (random/newest) without rewriting V1 SQL.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import select

from backend.models.mirror_network import MirrorNetworkNode
from backend.services.mirror_network.safety_gate import evaluate_mirror_network_safety

PUBLIC_MEDIA_PREFIX = "/api/business-yansi/public-media/"


def is_v2_public_media_scene_url(raw: str | None) -> bool:
    value = (raw or "").strip()
    if not value.startswith(PUBLIC_MEDIA_PREFIX):
        return False
    parts = value[len(PUBLIC_MEDIA_PREFIX):].split("/")
    if len(parts) != 2:
        return False
    business_id, asset_id = parts
    return bool(business_id) and bool(asset_id) and "-" in business_id and "-" in asset_id


def discover_v2_scene_url(node: MirrorNetworkNode) -> Optional[str]:
    """V2 scene gate: same-origin public-media path (not V1 HTTPS-only)."""
    url = (getattr(node, "scene_image_url", None) or "").strip()
    if is_v2_public_media_scene_url(url):
        return url
    return None


def is_v2_discover_node_structure(node: MirrorNetworkNode) -> bool:
    """Explicit V2 Discover structure — does not require journey_v1 / frozen."""
    if getattr(node, "published_at", None) is None:
        return False
    if (getattr(node, "visibility", None) or "").lower() != "public":
        return False
    if (getattr(node, "safety_status", None) or "").lower() != "open":
        return False
    if getattr(node, "current_v2_publication_version", None) is None:
        return False
    payload = getattr(node, "public_payload", None) or {}
    if not isinstance(payload, dict) or not payload.get("yansiV2"):
        return False
    if not evaluate_mirror_network_safety(node).passed:
        return False
    return True


def is_v2_discover_eligible(node: MirrorNetworkNode) -> bool:
    if not is_v2_discover_node_structure(node):
        return False
    return discover_v2_scene_url(node) is not None


def v2_discover_publication_version(node: MirrorNetworkNode) -> int:
    """Pin version for Discover cards / /m links — never node.journey_version."""
    payload = getattr(node, "public_payload", None) or {}
    if isinstance(payload, dict):
        raw = payload.get("publicationVersion")
        try:
            if raw is not None and int(raw) >= 1:
                return int(raw)
        except (TypeError, ValueError):
            pass
    try:
        current = int(getattr(node, "current_v2_publication_version", None) or 0)
    except (TypeError, ValueError):
        current = 0
    return current if current >= 1 else 1


def v2_discover_content_kind(node: MirrorNetworkNode) -> str | None:
    payload = getattr(node, "public_payload", None) or {}
    if not isinstance(payload, dict):
        return None
    kind = payload.get("contentKind")
    if kind in ("conversation", "image", "video", "mixed"):
        return kind
    return None


def v2_discover_curiosity_question(node: MirrorNetworkNode) -> str | None:
    payload = getattr(node, "public_payload", None) or {}
    if not isinstance(payload, dict):
        return None
    raw = payload.get("curiosityQuestion")
    if isinstance(raw, str):
        trimmed = raw.strip()
        return trimmed[:400] if trimmed else None
    return None


async def load_v2_discover_eligible_nodes(
    db,
    *,
    limit: int = 200,
) -> list[tuple[MirrorNetworkNode, str]]:
    """Load V2-eligible nodes. Separate from V1 ``load_discover_eligible_nodes``.

    Callers that merge pools must keep V1 SQL filters unchanged and append V2
    results with this helper — never rewrite V2 into FREEZE_STATUS_FROZEN.
    Coverless conversation V2 nodes fail ``discover_v2_scene_url`` and are omitted.
    """
    result = await db.execute(
        select(MirrorNetworkNode)
        .where(
            MirrorNetworkNode.visibility == "public",
            MirrorNetworkNode.safety_status == "open",
            MirrorNetworkNode.published_at.isnot(None),
            MirrorNetworkNode.current_v2_publication_version.isnot(None),
        )
        .order_by(MirrorNetworkNode.slug.asc())
        .limit(int(limit))
    )
    eligible: list[tuple[MirrorNetworkNode, str]] = []
    for node in result.scalars().all():
        if not is_v2_discover_node_structure(node):
            continue
        scene = discover_v2_scene_url(node)
        if not scene:
            continue
        eligible.append((node, scene))
    return eligible
