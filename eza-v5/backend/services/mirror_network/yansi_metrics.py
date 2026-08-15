# -*- coding: utf-8 -*-
"""
Phase 6.1 — query-time Yansı metrics from durable events + network truth.

Experience unit = distinct canonical STARTED experience_session_id for
slug + journeyVersion. Not page views, impressions, landing loads, or user_id.

Child Yansı count = Phase 5.1.1 eligible direct published children (slug-level).

Own-continuation is NOT implemented: first live user message is not durable
server truth; sohbet proofs fire on page load before any question. Deferred.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.yansi_experience_event import (
    YANSI_EXPERIENCE_COMPLETED,
    YANSI_EXPERIENCE_SKIPPED,
    YANSI_EXPERIENCE_STARTED,
    YansiExperienceEvent,
)
from backend.services.mirror_network.author_profile import (
    count_eligible_direct_children,
    count_eligible_direct_children_batch,
)
from backend.services.mirror_network.frozen_journey_artifact import (
    get_public_frozen_journey_artifact,
)

PUBLIC_METRIC_KEYS = (
    "slug",
    "journeyVersion",
    "experienceStartedCount",
    "experienceCompletedCount",
    "experienceSkippedSessionCount",
    "completionRate",
    "skipRate",
    "observedAverageDepth",
    "directChildYansiCount",
)


class YansiMetricsError(Exception):
    def __init__(self, reason: str, *, status_code: int = 404):
        super().__init__(reason)
        self.reason = reason
        self.status_code = status_code


@dataclass
class _SessionRollup:
    started: bool = False
    completed: bool = False
    skip_count: int = 0
    max_skip_depth: int = 0


@dataclass
class YansiExperienceAggregates:
    """Version-scoped experience aggregates. Counts use distinct sessions."""

    experience_started_count: int = 0
    experience_completed_count: int = 0
    experience_skipped_session_count: int = 0
    raw_skip_transition_count: int = 0
    started_only_count: int = 0
    sessions_skipped_then_completed: int = 0
    completion_rate: float | None = None
    skip_rate: float | None = None
    observed_average_depth: float | None = None
    completion_depth_distribution: dict[int, int] = field(default_factory=dict)


def _rate(numer: int, denom: int) -> float | None:
    if denom <= 0:
        return None
    return round(numer / denom, 4)


def observed_session_depth(
    *,
    completed: bool,
    max_skip_depth: int,
    selected_count: int,
) -> int:
    """
    Milestone-only depth. STARTED-only = 0 (first-question tap is not a reveal).
    Skip supplies completed_step_count; COMPLETED implies selectedCount.
    Unobserved mid-replay progress (Q5, no skip/complete) is not invented.
    """
    if completed:
        return int(selected_count)
    return max(0, int(max_skip_depth))


def compute_experience_aggregates(
    rows: list[tuple[str, str, int | None]],
    *,
    selected_count: int,
) -> YansiExperienceAggregates:
    """
    rows: (experience_session_id, event_type, completed_step_count)
    Distinct session grouping — duplicate rows cannot inflate counts.
    """
    sessions: dict[str, _SessionRollup] = defaultdict(_SessionRollup)
    for session_id, event_type, step in rows:
        sid = (session_id or "").strip()
        if not sid:
            continue
        bucket = sessions[sid]
        if event_type == YANSI_EXPERIENCE_STARTED:
            bucket.started = True
        elif event_type == YANSI_EXPERIENCE_COMPLETED:
            bucket.completed = True
        elif event_type == YANSI_EXPERIENCE_SKIPPED:
            bucket.skip_count += 1
            if step is not None:
                bucket.max_skip_depth = max(bucket.max_skip_depth, int(step))

    started_sessions = [b for b in sessions.values() if b.started]
    started_n = len(started_sessions)
    completed_n = sum(1 for b in started_sessions if b.completed)
    skipped_n = sum(1 for b in started_sessions if b.skip_count >= 1)
    raw_skips = sum(b.skip_count for b in started_sessions)
    started_only = sum(
        1 for b in started_sessions if not b.completed and b.skip_count == 0
    )
    skip_then_complete = sum(
        1 for b in started_sessions if b.completed and b.skip_count >= 1
    )

    depths: list[int] = []
    distribution: dict[int, int] = defaultdict(int)
    for bucket in started_sessions:
        depth = observed_session_depth(
            completed=bucket.completed,
            max_skip_depth=bucket.max_skip_depth,
            selected_count=selected_count,
        )
        depths.append(depth)
        distribution[depth] += 1

    avg = round(sum(depths) / len(depths), 4) if depths else None
    return YansiExperienceAggregates(
        experience_started_count=started_n,
        experience_completed_count=completed_n,
        experience_skipped_session_count=skipped_n,
        raw_skip_transition_count=raw_skips,
        started_only_count=started_only,
        sessions_skipped_then_completed=skip_then_complete,
        completion_rate=_rate(completed_n, started_n),
        skip_rate=_rate(skipped_n, started_n),
        observed_average_depth=avg,
        completion_depth_distribution=dict(sorted(distribution.items())),
    )


async def load_experience_event_rows(
    db: AsyncSession,
    *,
    slug: str,
    journey_version: int,
) -> list[tuple[str, str, int | None]]:
    result = await db.execute(
        select(
            YansiExperienceEvent.experience_session_id,
            YansiExperienceEvent.event_type,
            YansiExperienceEvent.completed_step_count,
        ).where(
            YansiExperienceEvent.mirror_slug == slug,
            YansiExperienceEvent.journey_version == journey_version,
            YansiExperienceEvent.event_type.in_(
                (
                    YANSI_EXPERIENCE_STARTED,
                    YANSI_EXPERIENCE_COMPLETED,
                    YANSI_EXPERIENCE_SKIPPED,
                )
            ),
        )
    )
    return [
        (str(sid), str(etype), int(step) if step is not None else None)
        for sid, etype, step in result.all()
    ]


def public_metrics_dict(
    *,
    slug: str,
    journey_version: int,
    aggregates: YansiExperienceAggregates,
    direct_child_yansi_count: int,
) -> dict[str, Any]:
    return {
        "slug": slug,
        "journeyVersion": journey_version,
        "experienceStartedCount": aggregates.experience_started_count,
        "experienceCompletedCount": aggregates.experience_completed_count,
        "experienceSkippedSessionCount": aggregates.experience_skipped_session_count,
        "completionRate": aggregates.completion_rate,
        "skipRate": aggregates.skip_rate,
        "observedAverageDepth": aggregates.observed_average_depth,
        "directChildYansiCount": int(direct_child_yansi_count),
    }


def _normalize_slug_version_pairs(
    items: list[tuple[str, int]],
) -> list[tuple[str, int]]:
    seen: set[tuple[str, int]] = set()
    out: list[tuple[str, int]] = []
    for slug, version in items:
        key = ((slug or "").strip().lower(), int(version or 0))
        if not key[0] or key[1] < 1 or key in seen:
            continue
        seen.add(key)
        out.append(key)
    return out


async def count_started_sessions_batch(
    db: AsyncSession,
    items: list[tuple[str, int]],
) -> dict[tuple[str, int], int]:
    """
    One grouped COUNT(DISTINCT experience_session_id) for STARTED events.

    Keys are (mirror_slug, journey_version). Missing pairs default to 0
    at the caller. Does not load completion/skip rows.
    """
    pairs = _normalize_slug_version_pairs(items)
    counts = {key: 0 for key in pairs}
    if not pairs:
        return counts
    conds = [
        and_(
            YansiExperienceEvent.mirror_slug == slug,
            YansiExperienceEvent.journey_version == version,
        )
        for slug, version in pairs
    ]

    result = await db.execute(
        select(
            YansiExperienceEvent.mirror_slug,
            YansiExperienceEvent.journey_version,
            func.count(func.distinct(YansiExperienceEvent.experience_session_id)),
        )
        .where(
            YansiExperienceEvent.event_type == YANSI_EXPERIENCE_STARTED,
            or_(*conds),
        )
        .group_by(
            YansiExperienceEvent.mirror_slug,
            YansiExperienceEvent.journey_version,
        )
    )
    rows = result.all()
    if not isinstance(rows, (list, tuple)):
        return counts
    for slug, version, n in rows:
        key = (str(slug).strip().lower(), int(version))
        if key in counts:
            counts[key] = int(n or 0)
    return counts


async def get_yansi_public_metrics_batch(
    db: AsyncSession,
    items: list[tuple[str, int]],
) -> dict[tuple[str, int], dict[str, int]]:
    """
    Phase 6.2.1 — page-scoped canonical projection for Discover/Profile.

    Returns only presentation fields:
      experienceStartedCount, directChildYansiCount
    Child counts are slug-level (Phase 6.1). Does not call get_yansi_public_metrics
    in a Python loop.
    """
    pairs = _normalize_slug_version_pairs(items)
    if not pairs:
        return {}
    started = await count_started_sessions_batch(db, pairs)
    child_counts = await count_eligible_direct_children_batch(
        db, [slug for slug, _ in pairs]
    )
    return {
        (slug, version): {
            "experienceStartedCount": int(started.get((slug, version), 0)),
            "directChildYansiCount": int(child_counts.get(slug, 0)),
        }
        for slug, version in pairs
    }


async def get_yansi_public_metrics(
    db: AsyncSession,
    *,
    slug: str,
    journey_version: Optional[int] = None,
) -> dict[str, Any]:
    """
    Public lifetime aggregates for a replayable Yansı.

    Default journeyVersion = current published node version (frozen lookup).
    Explicit journeyVersion stays on that pinned version; v1 events never move to v2.

    directChildYansiCount is slug-level (parent_slug), not parent-version-scoped.
    """
    slug_n = (slug or "").strip().lower()
    if not slug_n:
        raise YansiMetricsError("invalid_slug", status_code=400)

    public = await get_public_frozen_journey_artifact(
        db, slug=slug_n, journey_version=journey_version
    )
    if public is None:
        raise YansiMetricsError("frozen_journey_not_found", status_code=404)

    version = int(public.get("journeyVersion") or 0)
    selected = int(public.get("selectedCount") or 0)
    if version < 1 or selected < 6 or selected > 8 or public.get("replayReady") is not True:
        raise YansiMetricsError("frozen_journey_not_found", status_code=404)

    rows = await load_experience_event_rows(
        db, slug=slug_n, journey_version=version
    )
    aggregates = compute_experience_aggregates(rows, selected_count=selected)
    child_count = await count_eligible_direct_children(db, parent_slug=slug_n)
    return public_metrics_dict(
        slug=slug_n,
        journey_version=version,
        aggregates=aggregates,
        direct_child_yansi_count=child_count,
    )
