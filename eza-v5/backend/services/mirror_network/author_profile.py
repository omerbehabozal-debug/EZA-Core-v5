# -*- coding: utf-8 -*-
"""Phase 3.8 / 5.1.1 — public author published Yansılar + direct child listing."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.mirror_network import (
    ARTIFACT_KIND_JOURNEY_V1,
    MirrorJourneyStep,
    MirrorNetworkNode,
)
from backend.models.production import User
from backend.services.mirror_network.frozen_journey_artifact import (
    FREEZE_STATUS_FROZEN,
    get_public_frozen_journey_artifact,
    is_frozen_replay_ready,
    read_frozen_journey_artifact_from_private,
    to_public_frozen_journey_artifact,
)
from backend.services.mirror_network.impact import is_eligible_yansi_child
from backend.services.mirror_network.repository import get_mirror_network_node_by_slug
from backend.services.mirror_network.safety_gate import evaluate_mirror_network_safety
from backend.services.mirror_network.slug import build_mirror_share_url

# Deterministic /children ordering (Phase 5.1.1):
# published_at DESC NULLS LAST, created_at DESC, slug ASC (immutable tie-breaker).
CHILDREN_ORDER_BY = (
    MirrorNetworkNode.published_at.desc().nullslast(),
    MirrorNetworkNode.created_at.desc(),
    MirrorNetworkNode.slug.asc(),
)


def _public_display_name_from_email(email: str | None) -> str:
    raw = (email or "").strip()
    if "@" in raw:
        local = raw.split("@", 1)[0].strip()
        if local:
            return local
    return "Yazar"


def _item_from_node(
    node: MirrorNetworkNode,
    *,
    experience_started_count: int | None = None,
    direct_child_yansi_count: int | None = None,
    journey_version: int | None = None,
) -> dict[str, Any]:
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
    version = (
        int(journey_version)
        if journey_version is not None
        else int(getattr(node, "journey_version", None) or 1)
    )
    item: dict[str, Any] = {
        "slug": node.slug,
        "shareUrl": build_mirror_share_url(node.slug),
        "publicTitle": title,
        "publicSummary": summary,
        "sceneImageUrl": frozen_scene or node.scene_image_url,
        "publishedAt": node.published_at.isoformat() if node.published_at else None,
        "parentSlug": (node.parent_slug or None),
        # Phase 6.2.1 — presented version for canonical deneyim. Not ranking.
        "journeyVersion": version,
    }
    if experience_started_count is not None:
        item["experienceStartedCount"] = int(experience_started_count)
    if direct_child_yansi_count is not None:
        item["directChildYansiCount"] = int(direct_child_yansi_count)
    return item


def _is_public_published(node: MirrorNetworkNode) -> bool:
    visibility = (node.visibility or "public").lower()
    if visibility == "private":
        return False
    if not evaluate_mirror_network_safety(node).passed:
        return False
    return True


def is_candidate_frozen_continuation_child(node: MirrorNetworkNode) -> bool:
    """
    Fast structural gates for public frozen Yansı continuation (Phase 5.1.1).

    Publication proof: published_at IS NOT NULL.
    Journey kind: artifact_kind == journey_v1.
    Freeze seal: freeze_status == frozen.
    Public/safety: visibility public + safety gate (same family as Discover).

    Replay-ready (6–8 valid public steps) is verified separately via
    get_public_frozen_journey_artifact — same invariant as GET …/frozen.
    """
    if getattr(node, "published_at", None) is None:
        return False
    if (getattr(node, "visibility", None) or "public").lower() != "public":
        return False
    if getattr(node, "artifact_kind", None) != ARTIFACT_KIND_JOURNEY_V1:
        return False
    freeze = (getattr(node, "freeze_status", None) or "").strip().lower()
    if freeze != FREEZE_STATUS_FROZEN:
        return False
    if not is_eligible_yansi_child(node):
        return False
    return True


def _steps_as_public_dicts(rows: list[MirrorJourneyStep]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in rows:
        out.append(
            {
                "stepIndex": int(row.step_index),
                "publicQuestion": row.public_question,
                "publicAnswer": row.public_answer,
            }
        )
    out.sort(key=lambda item: int(item.get("stepIndex") or 0))
    return out


def is_replay_ready_from_loaded_child(
    node: MirrorNetworkNode,
    steps: list[dict[str, Any]],
) -> bool:
    """
    Same replayReady invariant as GET …/frozen, using an already-loaded node
    plus batched step rows (no extra node lookup).
    """
    if not is_candidate_frozen_continuation_child(node):
        return False
    version = int(getattr(node, "journey_version", None) or 1)
    frozen = read_frozen_journey_artifact_from_private(
        node.private_payload if isinstance(node.private_payload, dict) else None,
        journey_version=version,
    )
    if not frozen:
        return False
    selected_count = int(frozen.get("selectedCount") or len(steps) or 0)
    landing = frozen.get("publicLanding") if isinstance(frozen.get("publicLanding"), dict) else {}
    public = node.public_payload if isinstance(node.public_payload, dict) else {}
    safety_ok = evaluate_mirror_network_safety(node).passed
    if not is_frozen_replay_ready(
        freeze_status=str(frozen.get("freezeStatus") or getattr(node, "freeze_status", None)),
        selected_count=selected_count,
        steps=steps,
        node_publicly_servable=safety_ok,
    ):
        return False
    internal = {
        "replayReady": True,
        "slug": node.slug,
        "journeyId": node.slug,
        "journeyVersion": version,
        "authorUserId": str(getattr(node, "user_id", "") or ""),
        "parentSlug": getattr(node, "parent_slug", None),
        "selectedCount": selected_count,
        "selectedSteps": steps,
        "publicTitle": landing.get("publicTitle")
        or public.get("publicTitle")
        or getattr(node, "card_title", None),
        "publicSummary": landing.get("publicSummary") or public.get("publicSummary"),
        "sceneImageUrl": frozen.get("sceneImageUrl") or getattr(node, "scene_image_url", None),
    }
    return to_public_frozen_journey_artifact(internal) is not None


async def is_eligible_frozen_continuation_child(
    db: AsyncSession,
    node: MirrorNetworkNode,
) -> bool:
    """Structural gates + same replay-ready projection as GET …/frozen."""
    if not is_candidate_frozen_continuation_child(node):
        return False
    public = await get_public_frozen_journey_artifact(db, slug=node.slug)
    return public is not None


async def count_eligible_direct_children_batch(
    db: AsyncSession,
    parent_slugs: list[str],
) -> dict[str, int]:
    """
    Phase 6.2.1 — slug-level eligible direct child counts for a page of parents.

    One children query + one frozen-steps query. Preserves Phase 5.1.1 gates:
    direct, published, public, safe, journey_v1, frozen, replayReady.
    """
    parents = sorted(
        {
            (slug or "").strip().lower()
            for slug in parent_slugs
            if (slug or "").strip()
        }
    )
    counts = {slug: 0 for slug in parents}
    if not parents:
        return counts

    result = await db.execute(
        select(MirrorNetworkNode).where(
            func.lower(MirrorNetworkNode.parent_slug).in_(parents),
            MirrorNetworkNode.published_at.isnot(None),
            MirrorNetworkNode.artifact_kind == ARTIFACT_KIND_JOURNEY_V1,
            MirrorNetworkNode.freeze_status == FREEZE_STATUS_FROZEN,
        )
    )
    raw_nodes = result.scalars().all()
    if not isinstance(raw_nodes, (list, tuple)):
        return counts
    candidates = [
        n for n in raw_nodes if is_candidate_frozen_continuation_child(n)
    ]
    if not candidates:
        return counts

    version_conds = [
        and_(
            MirrorJourneyStep.journey_slug == n.slug,
            MirrorJourneyStep.journey_version == int(getattr(n, "journey_version", None) or 1),
        )
        for n in candidates
    ]
    steps_result = await db.execute(select(MirrorJourneyStep).where(or_(*version_conds)))
    step_rows = steps_result.scalars().all()
    if not isinstance(step_rows, (list, tuple)):
        return counts
    steps_by_key: dict[tuple[str, int], list[MirrorJourneyStep]] = {}
    for row in step_rows:
        key = (str(row.journey_slug), int(row.journey_version))
        steps_by_key.setdefault(key, []).append(row)

    for node in candidates:
        parent = (node.parent_slug or "").strip().lower()
        if parent not in counts:
            continue
        version = int(getattr(node, "journey_version", None) or 1)
        steps = _steps_as_public_dicts(steps_by_key.get((node.slug, version), []))
        if is_replay_ready_from_loaded_child(node, steps):
            counts[parent] += 1
    return counts


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
    metrics_by_key: dict[tuple[str, int], dict[str, int]] = {}
    try:
        from backend.services.mirror_network.yansi_metrics import get_yansi_public_metrics_batch

        pairs = [
            (
                str(n.slug).strip().lower(),
                int(getattr(n, "journey_version", None) or 1),
            )
            for n in page
        ]
        metrics_by_key = await get_yansi_public_metrics_batch(db, pairs)
    except Exception:
        metrics_by_key = {}

    items = []
    for n in page:
        version = int(getattr(n, "journey_version", None) or 1)
        row = metrics_by_key.get((str(n.slug).strip().lower(), version))
        items.append(
            _item_from_node(
                n,
                experience_started_count=(
                    row.get("experienceStartedCount") if row else None
                ),
                direct_child_yansi_count=(
                    row.get("directChildYansiCount") if row else None
                ),
                journey_version=version,
            )
        )
    return {
        "userId": str(user_id),
        "displayName": _public_display_name_from_email(getattr(user, "email", None)),
        "items": items,
        "total": total,
    }


async def _eligible_direct_child_nodes(
    db: AsyncSession,
    *,
    parent_slug: str,
) -> tuple[MirrorNetworkNode, str, list[MirrorNetworkNode]] | None:
    """
    Direct eligible published children of a public parent (Phase 5.1.1).

    Slug-level: parent_slug has no journey version. Grandchildren are excluded
    because only direct parent_slug matches are queried.
    """
    normalized = (parent_slug or "").strip().lower()
    if not normalized:
        return None
    parent = await get_mirror_network_node_by_slug(db, normalized)
    if parent is None or not _is_public_published(parent):
        return None

    result = await db.execute(
        select(MirrorNetworkNode)
        .where(
            func.lower(MirrorNetworkNode.parent_slug) == normalized,
            MirrorNetworkNode.published_at.isnot(None),
            MirrorNetworkNode.artifact_kind == ARTIFACT_KIND_JOURNEY_V1,
            MirrorNetworkNode.freeze_status == FREEZE_STATUS_FROZEN,
        )
        .order_by(*CHILDREN_ORDER_BY)
    )
    candidates = [
        n for n in result.scalars().all() if is_candidate_frozen_continuation_child(n)
    ]
    eligible: list[MirrorNetworkNode] = []
    for node in candidates:
        if await is_eligible_frozen_continuation_child(db, node):
            eligible.append(node)
    return parent, normalized, eligible


async def count_eligible_direct_children(
    db: AsyncSession,
    *,
    parent_slug: str,
) -> int:
    """
    Count of direct public replayable child Yansılar (Phase 5.1.1).

    Not descendants, drafts, generating, private, non-frozen, or not replayReady.
    Authorship is irrelevant — Bob and Carol children both count.
    """
    bundle = await _eligible_direct_child_nodes(db, parent_slug=parent_slug)
    if bundle is None:
        return 0
    return len(bundle[2])


async def list_published_direct_children(
    db: AsyncSession,
    *,
    parent_slug: str,
    limit: int = 48,
    offset: int = 0,
) -> dict[str, Any] | None:
    """
    Direct children eligible for public frozen Yansı continuation (Phase 5.1.1).

    Returns only: direct child + published_at set + public + safety-ok +
    journey_v1 + freeze_status frozen + replayReady (same as GET …/frozen).

    Ordering: published_at DESC, created_at DESC, slug ASC.
    total = count of eligible children (not raw DB child count).
    """
    bundle = await _eligible_direct_child_nodes(db, parent_slug=parent_slug)
    if bundle is None:
        return None
    parent, normalized, eligible = bundle
    total = len(eligible)
    page = eligible[offset : offset + max(1, min(limit, 100))]
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
