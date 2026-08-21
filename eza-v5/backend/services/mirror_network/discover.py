# -*- coding: utf-8 -*-
"""
Public Discover list — root Aynalar only.

Phase 7.1–7.5: one pipeline, three modes (random / strong_curiosity / newest).
Default = random (Rastlantısal). Rastlantısal and En Yeni must not use yansiCount,
Phase 6 signals, or the Strong Curiosity policy.
Güçlü Merak uses the frozen Phase 7.4.2 layered policy when enabled.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import re
import uuid
from datetime import datetime
from typing import Any, Literal, Mapping, Optional
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.schemas.mirror_network import DiscoverMirrorItem, DiscoverMirrorListResponse
from backend.models.mirror_network import (
    ARTIFACT_KIND_JOURNEY_V1,
    MirrorJourneyStep,
    MirrorNetworkNode,
)
from backend.services.mirror_network.author_profile import (
    _steps_as_public_dicts,
    is_replay_ready_from_loaded_child,
)
from backend.services.mirror_network.frozen_journey_artifact import FREEZE_STATUS_FROZEN
from backend.services.mirror_network.safety_gate import evaluate_mirror_network_safety

logger = logging.getLogger(__name__)

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
        "email",
        "account_tier",
        "accountTier",
        "mirror_plan",
        "role",
        "ezaScore",
        "rankingEvidence",
    }
)

DEFAULT_DISCOVER_LIMIT = 24
MAX_DISCOVER_LIMIT = 48
MAX_DISCOVER_OFFSET = 500
# Overflow cap by stable identity (slug), never newest/popularity window.
MAX_DISCOVER_ELIGIBLE_LOAD = 10_000

DiscoverMode = Literal["random", "strong_curiosity", "newest"]

DISCOVER_MODE_RANDOM: DiscoverMode = "random"
DISCOVER_MODE_STRONG_CURIOSITY: DiscoverMode = "strong_curiosity"
DISCOVER_MODE_NEWEST: DiscoverMode = "newest"
DEFAULT_DISCOVER_MODE: DiscoverMode = DISCOVER_MODE_RANDOM
DISCOVER_MODES = frozenset(
    {
        DISCOVER_MODE_RANDOM,
        DISCOVER_MODE_STRONG_CURIOSITY,
        DISCOVER_MODE_NEWEST,
    }
)

_RANDOM_SESSION_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


class DiscoverModeError(Exception):
    def __init__(self, reason: str, *, status_code: int = 422):
        super().__init__(reason)
        self.reason = reason
        self.status_code = status_code


def parse_discover_mode(raw: str | None) -> DiscoverMode:
    """Missing/blank → Rastlantısal. Garbage is rejected, never remapped."""
    if raw is None:
        return DEFAULT_DISCOVER_MODE
    value = str(raw).strip().lower()
    if not value:
        return DEFAULT_DISCOVER_MODE
    if value not in DISCOVER_MODES:
        raise DiscoverModeError("invalid_discover_mode")
    return value  # type: ignore[return-value]


def parse_random_session(raw: str | None) -> str:
    """Opaque permutation seed. Not a ranking weight. Invalid → 422."""
    if raw is None:
        return str(uuid.uuid4())
    value = str(raw).strip()
    if not value:
        return str(uuid.uuid4())
    if not _RANDOM_SESSION_RE.fullmatch(value):
        raise DiscoverModeError("invalid_random_session")
    return value


def random_discover_sort_key(seed: str, slug: str) -> tuple[str, str]:
    """
    Deterministic permutation key.

    Hash of seed + slug only. Popularity and recency are not inputs.
    """
    identity = (slug or "").strip().lower()
    digest = hmac.new(
        seed.encode("utf-8"),
        identity.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return (digest, identity)


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


_SAFE_FALLBACK_DESCRIPTION = (
    "Bu Ayna, paylaşılan bir deneyim ve onun uyandırdığı meraktan doğdu."
)


def _is_legacy_anti_summary(text: str) -> bool:
    lower = text.lower()
    if "güvenli bir giriş kapısıdır" in lower:
        return True
    if "konuşmayı yeniden anlatmaz" in lower:
        return True
    if "sohbeti yeniden anlatmaz" in lower:
        return True
    if "bu merak alanı," in lower and "üzerine doğmuş" in lower:
        return True
    return False


def _resolve_description(public_payload: Mapping[str, Any] | None) -> Optional[str]:
    if not public_payload:
        return None
    for key in ("publicSummary", "curiosityContext", "landingContext"):
        raw = public_payload.get(key)
        if isinstance(raw, str):
            trimmed = raw.strip()
            if not trimmed:
                continue
            if _is_legacy_anti_summary(trimmed):
                return _SAFE_FALLBACK_DESCRIPTION
            return trimmed[:400]
    return None


def _frozen_public_fields(node: MirrorNetworkNode) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Return (title, summary, sceneImageUrl) from durable freeze seal when present."""
    try:
        from backend.services.mirror_network.frozen_journey_artifact import (
            read_frozen_journey_artifact_from_private,
        )

        frozen = read_frozen_journey_artifact_from_private(
            node.private_payload if isinstance(node.private_payload, dict) else None
        )
        if not frozen:
            return None, None, None
        landing = frozen.get("publicLanding") if isinstance(frozen.get("publicLanding"), dict) else {}
        title = str(landing.get("publicTitle") or "").strip() or None
        summary = str(landing.get("publicSummary") or "").strip() or None
        scene = str(frozen.get("sceneImageUrl") or "").strip() or None
        return title, summary, scene
    except Exception:
        return None, None, None


def is_canonical_discover_root_structure(node: MirrorNetworkNode) -> bool:
    """
    Discover pool structural gates — aligned with Phase 5 frozen Journey,
    plus root-only. replayReady is verified separately with the same helper
    used by GET …/frozen (is_replay_ready_from_loaded_child).
    """
    if (getattr(node, "parent_slug", None) or "").strip():
        return False
    if getattr(node, "published_at", None) is None:
        return False
    if (getattr(node, "visibility", None) or "").lower() != "public":
        return False
    if (getattr(node, "safety_status", None) or "").lower() != "open":
        return False
    if getattr(node, "artifact_kind", None) != ARTIFACT_KIND_JOURNEY_V1:
        return False
    freeze = (getattr(node, "freeze_status", None) or "").strip().lower()
    if freeze != FREEZE_STATUS_FROZEN:
        return False
    if not evaluate_mirror_network_safety(node).passed:
        return False
    return True


def discover_scene_url_for_card(node: MirrorNetworkNode) -> Optional[str]:
    """HTTPS scene is a Discover card presentation gate, not Journey eligibility."""
    _, _, frozen_scene = _frozen_public_fields(node)
    return _public_discover_scene_url(frozen_scene or getattr(node, "scene_image_url", None))


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
    ts = getattr(node, "published_at", None)
    if isinstance(ts, datetime):
        return ts.isoformat()
    return None


def _to_discover_item(
    node: MirrorNetworkNode,
    *,
    scene_url: str,
    yansi_count: int,
    journey_version: int | None = None,
    experience_started_count: int | None = None,
    direct_child_yansi_count: int | None = None,
    author_display_name: str | None = None,
    public_honorific: str | None = None,
) -> DiscoverMirrorItem:
    payload = node.public_payload if isinstance(node.public_payload, dict) else {}
    frozen_title, frozen_summary, _ = _frozen_public_fields(node)
    public_title = (
        frozen_title
        if frozen_title
        else (payload.get("publicTitle") if isinstance(payload.get("publicTitle"), str) else None)
    )
    title = (public_title or node.card_title or "").strip() or node.slug
    description = None
    if frozen_summary:
        description = frozen_summary[:400]
    else:
        description = _resolve_description(payload)
    version = (
        int(journey_version)
        if journey_version is not None
        else int(getattr(node, "journey_version", None) or 1)
    )
    return DiscoverMirrorItem(
        slug=node.slug,
        title=title,
        description=description,
        sceneImageUrl=scene_url,
        yansiCount=yansi_count,
        createdAt=_published_iso(node),
        journeyVersion=version,
        experienceStartedCount=experience_started_count,
        directChildYansiCount=direct_child_yansi_count,
        authorDisplayName=author_display_name,
        publicHonorific=public_honorific,
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


async def _load_steps_by_slug_version(
    db: AsyncSession,
    nodes: list[MirrorNetworkNode],
) -> dict[tuple[str, int], list]:
    if not nodes:
        return {}
    wanted = {
        (n.slug, int(getattr(n, "journey_version", None) or 1))
        for n in nodes
        if (getattr(n, "slug", None) or "").strip()
    }
    slugs = [slug for slug, _ in wanted]
    steps_result = await db.execute(
        select(MirrorJourneyStep).where(MirrorJourneyStep.journey_slug.in_(slugs))
    )
    step_rows = steps_result.scalars().all()
    steps_by_key: dict[tuple[str, int], list] = {}
    if not isinstance(step_rows, (list, tuple)):
        return steps_by_key
    for row in step_rows:
        key = (str(row.journey_slug), int(row.journey_version))
        if key not in wanted:
            continue
        steps_by_key.setdefault(key, []).append(row)
    return steps_by_key


def _newest_sort_key(node: MirrorNetworkNode) -> tuple:
    ts = getattr(node, "published_at", None)
    epoch = ts.timestamp() if isinstance(ts, datetime) else 0.0
    return (-epoch, (getattr(node, "slug", "") or "").strip().lower())


def _order_eligible(
    eligible: list[tuple[MirrorNetworkNode, str]],
    *,
    mode: DiscoverMode,
    random_session: str,
) -> list[tuple[MirrorNetworkNode, str]]:
    if mode == DISCOVER_MODE_NEWEST:
        return sorted(eligible, key=lambda item: _newest_sort_key(item[0]))
    if mode == DISCOVER_MODE_RANDOM:
        return sorted(
            eligible,
            key=lambda item: random_discover_sort_key(random_session, item[0].slug),
        )
    return eligible


async def load_discover_eligible_roots(
    db: AsyncSession,
) -> list[tuple[MirrorNetworkNode, str]]:
    """
    Canonical Phase 7.1 Discover pool (root, public, frozen, replayReady, scene).
    Unordered load; callers apply mode-specific ordering. Not a ranking helper.
    """
    result = await db.execute(
        select(MirrorNetworkNode)
        .where(
            MirrorNetworkNode.visibility == "public",
            MirrorNetworkNode.safety_status == "open",
            MirrorNetworkNode.parent_slug.is_(None),
            MirrorNetworkNode.published_at.isnot(None),
            MirrorNetworkNode.artifact_kind == ARTIFACT_KIND_JOURNEY_V1,
            MirrorNetworkNode.freeze_status == FREEZE_STATUS_FROZEN,
        )
        .order_by(MirrorNetworkNode.slug.asc())
        .limit(MAX_DISCOVER_ELIGIBLE_LOAD)
    )
    structural = [
        node
        for node in result.scalars().all()
        if is_canonical_discover_root_structure(node)
    ]
    steps_by_key = await _load_steps_by_slug_version(db, structural)
    eligible: list[tuple[MirrorNetworkNode, str]] = []
    for node in structural:
        version = int(getattr(node, "journey_version", None) or 1)
        steps = _steps_as_public_dicts(steps_by_key.get((node.slug, version), []))
        if not is_replay_ready_from_loaded_child(node, steps):
            continue
        scene_url = discover_scene_url_for_card(node)
        if not scene_url:
            continue
        eligible.append((node, scene_url))
    return eligible


async def _project_discover_page(
    db: AsyncSession,
    page: list[tuple[MirrorNetworkNode, str]],
) -> list[DiscoverMirrorItem]:
    yansi_by_parent: dict[str, int] = {}
    if page:
        children = await _fetch_children_for_parents(
            db, [node.slug for node, _ in page]
        )
        yansi_by_parent = _batch_yansi_counts(children)

    metrics_by_key: dict[tuple[str, int], dict[str, int]] = {}
    try:
        from backend.services.mirror_network.yansi_metrics import get_yansi_public_metrics_batch

        pairs = [
            (
                node.slug.strip().lower(),
                int(getattr(node, "journey_version", None) or 1),
            )
            for node, _ in page
        ]
        metrics_by_key = await get_yansi_public_metrics_batch(db, pairs)
    except Exception:
        metrics_by_key = {}

    from backend.services.mirror_network.public_identity import (
        resolve_public_display_name,
        resolve_public_honorific,
    )

    authors_by_id: dict[Any, Any] = {}
    user_ids = [getattr(node, "user_id", None) for node, _ in page]
    user_ids = [uid for uid in user_ids if uid is not None]
    if user_ids:
        try:
            from backend.models.production import User

            author_result = await db.execute(select(User).where(User.id.in_(set(user_ids))))
            authors_by_id = {row.id: row for row in author_result.scalars().all()}
        except Exception:
            authors_by_id = {}

    items = []
    for node, scene_url in page:
        version = int(getattr(node, "journey_version", None) or 1)
        row = metrics_by_key.get((node.slug.strip().lower(), version))
        author = authors_by_id.get(getattr(node, "user_id", None))
        items.append(
            _to_discover_item(
                node,
                scene_url=scene_url,
                yansi_count=yansi_by_parent.get(node.slug.lower(), 0),
                journey_version=version,
                experience_started_count=(
                    row.get("experienceStartedCount") if row else None
                ),
                direct_child_yansi_count=(
                    row.get("directChildYansiCount") if row else None
                ),
                author_display_name=resolve_public_display_name(author),
                public_honorific=resolve_public_honorific(author),
            )
        )
    return items


def _strong_curiosity_unavailable_response() -> DiscoverMirrorListResponse:
    return DiscoverMirrorListResponse(
        items=[],
        total=0,
        mode=DISCOVER_MODE_STRONG_CURIOSITY,
        randomSession=None,
        strongCuriosityReady=False,
    )


def _nested_keys(value: Any) -> set[str]:
    keys: set[str] = set()
    if isinstance(value, Mapping):
        for key, inner in value.items():
            keys.add(str(key))
            keys.update(_nested_keys(inner))
    elif isinstance(value, (list, tuple)):
        for inner in value:
            keys.update(_nested_keys(inner))
    return keys


def _privacy_check(payload: DiscoverMirrorListResponse) -> DiscoverMirrorListResponse:
    leaked = _DISCOVER_FORBIDDEN_KEYS.intersection(_nested_keys(payload.model_dump()))
    if leaked:
        raise RuntimeError(f"discover_response_privacy_violation:{','.join(sorted(leaked))}")
    return payload


async def _list_strong_curiosity_discover(
    db: AsyncSession,
    *,
    safe_limit: int,
    safe_offset: int,
) -> DiscoverMirrorListResponse:
    try:
        from backend.services.mirror_network.yansi_strong_curiosity_live import (
            is_strong_curiosity_discover_enabled,
            log_strong_curiosity_outcome,
            order_eligible_roots_for_strong_curiosity,
        )

        if not is_strong_curiosity_discover_enabled():
            log_strong_curiosity_outcome("disabled")
            return _strong_curiosity_unavailable_response()

        eligible = await load_discover_eligible_roots(db)
        ranked = await order_eligible_roots_for_strong_curiosity(
            db, eligible, page_offset=safe_offset
        )
        ordered = list(ranked.get("ordered") or [])
        page = ordered[safe_offset : safe_offset + safe_limit]
        items = await _project_discover_page(db, page)
        return DiscoverMirrorListResponse(
            items=items,
            total=len(ordered),
            mode=DISCOVER_MODE_STRONG_CURIOSITY,
            randomSession=None,
            strongCuriosityReady=True,
        )
    except Exception:
        logger.warning("strong_curiosity_fail_closed", exc_info=False)
        return _strong_curiosity_unavailable_response()


async def list_discover_mirrors(
    db: AsyncSession,
    *,
    limit: int = DEFAULT_DISCOVER_LIMIT,
    offset: int = 0,
    mode: str | None = None,
    random_session: str | None = None,
) -> DiscoverMirrorListResponse:
    parsed_mode = parse_discover_mode(mode)
    safe_limit = max(1, min(limit, MAX_DISCOVER_LIMIT))
    safe_offset = max(0, min(offset, MAX_DISCOVER_OFFSET))
    session = parse_random_session(random_session) if parsed_mode == DISCOVER_MODE_RANDOM else None

    if parsed_mode == DISCOVER_MODE_STRONG_CURIOSITY:
        return _privacy_check(
            await _list_strong_curiosity_discover(
                db, safe_limit=safe_limit, safe_offset=safe_offset
            )
        )

    eligible = await load_discover_eligible_roots(db)
    eligible = _order_eligible(
        eligible, mode=parsed_mode, random_session=session or ""
    )
    page = eligible[safe_offset : safe_offset + safe_limit]
    items = await _project_discover_page(db, page)

    payload = DiscoverMirrorListResponse(
        items=items,
        total=len(eligible),
        mode=parsed_mode,
        randomSession=session,
        strongCuriosityReady=False,
    )
    return _privacy_check(payload)
