# -*- coding: utf-8 -*-
"""
Phase 7.5 — live Güçlü Merak ranking path.

Consumes the frozen Phase 7.4.2 order function. Does not copy ranking keys.
Does not run shadow reports, pairwise diagnostics, production evaluators,
or staging seeders. Must not be imported by Rastlantısal / En Yeni ordering.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.services.mirror_network.discover import MAX_DISCOVER_ELIGIBLE_LOAD
from backend.services.mirror_network.yansi_strong_curiosity_candidate import (
    evaluate_strong_curiosity_candidates_batch,
)
from backend.services.mirror_network.yansi_strong_curiosity_final_shadow import (
    POLICY_VERSION,
    order_final_shadow_candidates,
)

logger = logging.getLogger(__name__)

LIVE_RANK_CACHE_TTL_SECONDS = 30.0
_cache_lock = asyncio.Lock()
_rank_cache: dict[str, Any] | None = None


class StrongCuriosityUnavailable(Exception):
    """Kill switch or fail-closed. Never remap to another Discover mode."""


def is_strong_curiosity_discover_enabled() -> bool:
    return bool(get_settings().STRONG_CURIOSITY_DISCOVER_ENABLED)


def clear_strong_curiosity_rank_cache() -> None:
    global _rank_cache
    _rank_cache = None


def log_strong_curiosity_outcome(
    outcome: str,
    *,
    eligible_count: int | None = None,
    pool_count: int | None = None,
    duration_ms: float | None = None,
    cache_hit: bool | None = None,
    snapshot_reuse: bool | None = None,
    corpus_truncated: bool | None = None,
    query_count: int | None = None,
) -> None:
    logger.info(
        "strong_curiosity_discover outcome=%s eligible=%s pool=%s duration_ms=%s "
        "cache_hit=%s snapshot_reuse=%s truncated=%s queries=%s policy=%s",
        outcome,
        eligible_count,
        pool_count,
        None if duration_ms is None else round(duration_ms, 2),
        cache_hit,
        snapshot_reuse,
        corpus_truncated,
        query_count,
        POLICY_VERSION,
    )


def _eligible_fingerprint(eligible: Sequence[tuple[Any, str]]) -> tuple[str, ...]:
    slugs: list[str] = []
    for node, _scene in eligible:
        slug = str(getattr(node, "slug", "") or "").strip().lower()
        if slug:
            slugs.append(slug)
    return tuple(sorted(slugs))


def _pairs_from_eligible(eligible: Sequence[tuple[Any, str]]) -> list[tuple[str, int]]:
    pairs: list[tuple[str, int]] = []
    seen: set[tuple[str, int]] = set()
    for node, _scene in eligible:
        slug = str(getattr(node, "slug", "") or "").strip().lower()
        version = int(getattr(node, "journey_version", None) or 1)
        key = (slug, version)
        if not slug or version < 1 or key in seen:
            continue
        seen.add(key)
        pairs.append(key)
    return pairs


def _apply_cached_order(
    eligible: Sequence[tuple[Any, str]],
    ordered_slugs: Sequence[str],
) -> list[tuple[Any, str]]:
    by_slug = {
        str(getattr(node, "slug", "") or "").strip().lower(): (node, scene)
        for node, scene in eligible
    }
    out: list[tuple[Any, str]] = []
    seen: set[str] = set()
    for slug in ordered_slugs:
        key = str(slug).strip().lower()
        row = by_slug.get(key)
        if row is None or key in seen:
            continue
        seen.add(key)
        out.append(row)
    return out


async def order_eligible_roots_for_strong_curiosity(
    db: AsyncSession,
    eligible: Sequence[tuple[Any, str]],
    *,
    now: float | None = None,
    page_offset: int = 0,
) -> dict[str, Any]:
    """
    Rank Discover-eligible roots with frozen 7.4.2 policy.

    Returns ordered (node, scene_url) tuples for inCandidatePool rows only.

    Fresh TTL hits reuse the cache. Scroll pages (offset > 0) also reuse an
    expired same-fingerprint snapshot so page 2 cannot be sliced from a newly
    recomputed order. Offset 0 after TTL expiry recomputes.
    """
    global _rank_cache
    started = time.perf_counter()
    fingerprint = _eligible_fingerprint(eligible)
    truncated = len(eligible) >= MAX_DISCOVER_ELIGIBLE_LOAD
    moment = time.monotonic() if now is None else now
    safe_offset = max(0, int(page_offset or 0))

    async with _cache_lock:
        cached = _rank_cache
        fresh_hit = (
            cached
            and cached.get("fingerprint") == fingerprint
            and float(cached.get("expires_at") or 0) > moment
        )
        snapshot_hit = (
            cached
            and cached.get("fingerprint") == fingerprint
            and safe_offset > 0
            and not fresh_hit
        )
        if fresh_hit or snapshot_hit:
            ordered = _apply_cached_order(eligible, cached.get("ordered_slugs") or ())
            duration_ms = (time.perf_counter() - started) * 1000
            log_strong_curiosity_outcome(
                "ok",
                eligible_count=len(eligible),
                pool_count=len(ordered),
                duration_ms=duration_ms,
                cache_hit=True,
                snapshot_reuse=bool(snapshot_hit),
                corpus_truncated=truncated,
            )
            return {
                "ordered": ordered,
                "eligibleCount": len(eligible),
                "poolCount": len(ordered),
                "cacheHit": True,
                "snapshotReuse": bool(snapshot_hit),
                "corpusTruncated": truncated,
                "durationMs": duration_ms,
                "policyVersion": POLICY_VERSION,
            }

    pairs = _pairs_from_eligible(eligible)
    eligible_set = set(pairs)
    profiles = await evaluate_strong_curiosity_candidates_batch(
        db,
        pairs,
        discover_eligible=eligible_set,
    )
    ranked = order_final_shadow_candidates(profiles)
    ordered_slugs = [
        str(row.get("slug") or "").strip().lower()
        for row in ranked
        if str(row.get("slug") or "").strip()
    ]
    ordered = _apply_cached_order(eligible, ordered_slugs)

    async with _cache_lock:
        _rank_cache = {
            "fingerprint": fingerprint,
            "ordered_slugs": tuple(ordered_slugs),
            "expires_at": moment + LIVE_RANK_CACHE_TTL_SECONDS,
        }

    duration_ms = (time.perf_counter() - started) * 1000
    log_strong_curiosity_outcome(
        "empty_pool" if not ordered else "ok",
        eligible_count=len(eligible),
        pool_count=len(ordered),
        duration_ms=duration_ms,
        cache_hit=False,
        snapshot_reuse=False,
        corpus_truncated=truncated,
    )
    return {
        "ordered": ordered,
        "eligibleCount": len(eligible),
        "poolCount": len(ordered),
        "cacheHit": False,
        "snapshotReuse": False,
        "corpusTruncated": truncated,
        "durationMs": duration_ms,
        "policyVersion": POLICY_VERSION,
    }
