# -*- coding: utf-8 -*-
"""Phase 7.5.1 — Discover delivery, pagination, and scroll-page cache."""

from __future__ import annotations

import inspect
import time
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from backend.config import Settings
from backend.core.schemas.mirror_network import DiscoverMirrorItem
from backend.services.mirror_network import discover as discover_mod
from backend.services.mirror_network.discover import (
    DEFAULT_DISCOVER_LIMIT,
    DEFAULT_DISCOVER_MODE,
    MAX_DISCOVER_ELIGIBLE_LOAD,
    MAX_DISCOVER_OFFSET,
    list_discover_mirrors,
    random_discover_sort_key,
)
from backend.services.mirror_network.yansi_strong_curiosity_final_shadow import (
    POLICY_VERSION,
    order_final_shadow_candidates,
)
from backend.services.mirror_network import yansi_strong_curiosity_live as live_mod
from backend.services.mirror_network.yansi_strong_curiosity_live import (
    LIVE_RANK_CACHE_TTL_SECONDS,
    clear_strong_curiosity_rank_cache,
    order_eligible_roots_for_strong_curiosity,
)


NOW = datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc)
ENABLED = (
    "backend.services.mirror_network.yansi_strong_curiosity_live."
    "is_strong_curiosity_discover_enabled"
)
BATCH = (
    "backend.services.mirror_network.yansi_strong_curiosity_live."
    "evaluate_strong_curiosity_candidates_batch"
)
LOAD = "backend.services.mirror_network.discover.load_discover_eligible_roots"
METRICS = (
    "backend.services.mirror_network.yansi_metrics.get_yansi_public_metrics_batch"
)


def _root(slug: str, *, published_ts: float = 1.0):
    ts = datetime.fromtimestamp(published_ts, tz=timezone.utc)
    return SimpleNamespace(
        slug=slug,
        parent_slug=None,
        visibility="public",
        safety_status="open",
        scene_image_url=f"https://cdn.example/{slug}.png",
        public_payload={"publicTitle": slug},
        private_payload={},
        card_title=slug,
        published_at=ts,
        created_at=ts,
        journey_version=1,
        artifact_kind="journey_v1",
        freeze_status="frozen",
    )


def _eligible(slugs: list[str], *, newest: bool = False):
    rows = []
    for index, slug in enumerate(slugs):
        ts = float(len(slugs) - index) if newest else float(index + 1)
        rows.append((_root(slug, published_ts=ts), f"https://cdn.example/{slug}.png"))
    return rows


def _empty_execute():
    db = AsyncMock()
    db.execute = AsyncMock(
        return_value=SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))
    )
    return db


def _lite_row(slug: str, started: int) -> dict:
    completed = max(0, started // 2)
    return {
        "slug": slug,
        "inCandidatePool": True,
        "candidateState": "CANDIDATE",
        "journeyVersion": 1,
        "profileBucket": "mixed",
        "smallSample": False,
        "attractionEvidence": {"status": "AVAILABLE", "publicStartedCount": started},
        "engagementEvidence": {
            "status": "AVAILABLE",
            "rankingEligibleCompletedCount": completed,
            "rankingEligibleStartedCount": started,
            "completionNumerator": completed,
            "completionDenominator": started,
        },
        "generativityEvidence": {
            "status": "AVAILABLE",
            "directChildYansiCount": 0,
            "externalDirectChildYansiCount": 0,
            "distinctExternalChildAuthorCount": 0,
            "rankingEligibleContinuationCount": 0,
            "scopeCompatible": True,
        },
        "selfInteraction": {"rankingEligibleStartedCount": started},
        "uniqueViewerEvidence": {
            "uniqueAuthenticatedStartedViewerCount": 1,
            "guestStartedSessions": 0,
        },
        "normalizationContext": {"ageContext": {"ageDays": 30}},
    }


def _slugs(prefix: str, count: int) -> list[str]:
    return [f"{prefix}-{index:04d}" for index in range(count)]


def _page_slugs(payload) -> list[str]:
    return [item.slug for item in payload.items]


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_strong_curiosity_rank_cache()
    yield
    clear_strong_curiosity_rank_cache()


def test_page_size_and_offset_contract_unchanged():
    assert DEFAULT_DISCOVER_LIMIT == 24
    assert MAX_DISCOVER_OFFSET == 500
    assert MAX_DISCOVER_ELIGIBLE_LOAD == 10_000
    assert DEFAULT_DISCOVER_MODE == "random"
    assert POLICY_VERSION == "strong_curiosity_final_shadow_v742"


def test_hmac_cost_at_representative_sizes():
    seed = "session-fair-01"
    measured: dict[int, float] = {}
    for n in (100, 1_000, 10_000):
        slugs = _slugs("hmac", n)
        started = time.perf_counter()
        ordered = sorted(slugs, key=lambda slug: random_discover_sort_key(seed, slug))
        elapsed_ms = (time.perf_counter() - started) * 1000
        measured[n] = elapsed_ms
        assert len(ordered) == n
        assert len(set(ordered)) == n
    print("PHASE751_HMAC_MS", measured)
    assert measured[100] < 50
    assert measured[1_000] < 250
    assert measured[10_000] < 2_000


def test_newest_sort_cost_at_representative_sizes():
    measured: dict[int, float] = {}
    for n in (100, 1_000, 10_000):
        eligible = _eligible(_slugs("new", n), newest=True)
        started = time.perf_counter()
        ordered = sorted(eligible, key=lambda item: discover_mod._newest_sort_key(item[0]))
        elapsed_ms = (time.perf_counter() - started) * 1000
        measured[n] = elapsed_ms
        assert [node.slug for node, _ in ordered] == _slugs("new", n)
    print("PHASE751_NEWEST_SORT_MS", measured)
    assert measured[10_000] < 500


def _disjoint(pages: list[list[str]]) -> bool:
    seen: set[str] = set()
    for page in pages:
        for slug in page:
            if slug in seen:
                return False
            seen.add(slug)
    return True


@pytest.mark.asyncio
async def test_random_pages_stable_same_session_no_duplicates():
    slugs = _slugs("rand", 9)
    eligible = _eligible(slugs)
    db = _empty_execute()
    session = "session-fair-01"
    with (
        patch(LOAD, new=AsyncMock(return_value=eligible)),
        patch(METRICS, new=AsyncMock(return_value={})),
        patch(BATCH, new=AsyncMock(side_effect=AssertionError("gm_ranking_on_random"))),
    ):
        p1 = await list_discover_mirrors(
            db, mode="random", random_session=session, limit=3, offset=0
        )
        p2 = await list_discover_mirrors(
            db, mode="random", random_session=session, limit=3, offset=3
        )
        p3 = await list_discover_mirrors(
            db, mode="random", random_session=session, limit=3, offset=6
        )
        again = await list_discover_mirrors(
            db, mode="random", random_session=session, limit=3, offset=0
        )
    pages = [_page_slugs(p1), _page_slugs(p2), _page_slugs(p3)]
    assert all(len(page) == 3 for page in pages)
    assert _disjoint(pages)
    assert _page_slugs(again) == _page_slugs(p1)
    assert p1.randomSession == session


@pytest.mark.asyncio
async def test_newest_pages_chronological_no_duplicates():
    slugs = _slugs("new", 9)
    eligible = _eligible(slugs, newest=True)
    db = _empty_execute()
    with (
        patch(LOAD, new=AsyncMock(return_value=eligible)),
        patch(METRICS, new=AsyncMock(return_value={})),
        patch(BATCH, new=AsyncMock(side_effect=AssertionError("gm_ranking_on_newest"))),
    ):
        p1 = await list_discover_mirrors(db, mode="newest", limit=3, offset=0)
        p2 = await list_discover_mirrors(db, mode="newest", limit=3, offset=3)
        p3 = await list_discover_mirrors(db, mode="newest", limit=3, offset=6)
    assert _page_slugs(p1) == slugs[:3]
    assert _page_slugs(p2) == slugs[3:6]
    assert _page_slugs(p3) == slugs[6:9]
    assert _disjoint([_page_slugs(p1), _page_slugs(p2), _page_slugs(p3)])


@pytest.mark.asyncio
async def test_strong_curiosity_pages_reuse_cache_and_frozen_order():
    slugs = _slugs("gm", 9)
    rows = [_lite_row(slug, 4 + index) for index, slug in enumerate(slugs)]
    expected = [
        str(row.get("slug"))
        for row in order_final_shadow_candidates(rows)
        if str(row.get("slug") or "")
    ]
    eligible = _eligible(slugs)
    calls = {"n": 0}

    async def batch(_db, _pairs, **_kwargs):
        calls["n"] += 1
        return rows

    db = _empty_execute()
    with (
        patch(ENABLED, return_value=True),
        patch(LOAD, new=AsyncMock(return_value=eligible)),
        patch(BATCH, new=batch),
        patch(METRICS, new=AsyncMock(return_value={})),
    ):
        p1 = await list_discover_mirrors(db, mode="strong_curiosity", limit=3, offset=0)
        p2 = await list_discover_mirrors(db, mode="strong_curiosity", limit=3, offset=3)
        p3 = await list_discover_mirrors(db, mode="strong_curiosity", limit=3, offset=6)
    assert calls["n"] == 1
    assert [_page_slugs(p1), _page_slugs(p2), _page_slugs(p3)] == [
        expected[:3],
        expected[3:6],
        expected[6:9],
    ]
    assert _disjoint([_page_slugs(p1), _page_slugs(p2), _page_slugs(p3)])
    dumped = p1.model_dump()
    assert "policyVersion" not in dumped
    assert "cacheHit" not in dumped
    assert "snapshotReuse" not in dumped


@pytest.mark.asyncio
async def test_expired_cache_reused_for_scroll_not_first_page():
    slugs = ["aa", "bb", "cc", "dd"]
    rows = [_lite_row(slug, 8 - index) for index, slug in enumerate(slugs)]
    eligible = _eligible(slugs)
    calls = {"n": 0}

    async def batch(_db, _pairs, **_kwargs):
        calls["n"] += 1
        return rows

    with patch(BATCH, new=batch):
        first = await order_eligible_roots_for_strong_curiosity(
            AsyncMock(), eligible, now=10.0, page_offset=0
        )
        expired_scroll = await order_eligible_roots_for_strong_curiosity(
            AsyncMock(),
            eligible,
            now=10.0 + LIVE_RANK_CACHE_TTL_SECONDS + 5,
            page_offset=3,
        )
        expired_first = await order_eligible_roots_for_strong_curiosity(
            AsyncMock(),
            eligible,
            now=10.0 + LIVE_RANK_CACHE_TTL_SECONDS + 5,
            page_offset=0,
        )
    assert first["cacheHit"] is False
    assert expired_scroll["cacheHit"] is True
    assert expired_scroll["snapshotReuse"] is True
    assert [node.slug for node, _ in first["ordered"]] == [
        node.slug for node, _ in expired_scroll["ordered"]
    ]
    assert calls["n"] == 2
    assert expired_first["cacheHit"] is False
    assert expired_first["snapshotReuse"] is False


def test_live_path_does_not_run_diagnostics_or_seeders():
    src = inspect.getsource(live_mod)
    discover_src = inspect.getsource(discover_mod)
    assert "evaluate_strong_curiosity_final_shadow(" not in src
    assert "evaluate_pairwise" not in src
    assert "yansi_strong_curiosity_staging_seed" not in src
    assert "yansi_strong_curiosity_staging_seed" not in discover_src
    assert "author_concentration" not in src
    assert "production_shadow" not in src
    assert POLICY_VERSION == "strong_curiosity_final_shadow_v742"
    assert "order_final_shadow_candidates" in src


def test_kill_switch_and_public_dto_unchanged():
    assert "STRONG_CURIOSITY_DISCOVER_ENABLED" in Settings.model_fields
    assert "reasonCodes" not in DiscoverMirrorItem.model_fields
    assert "prefetch" not in DiscoverMirrorItem.model_fields


def test_ten_k_bound_delivery_classification():
    assert MAX_DISCOVER_ELIGIBLE_LOAD == 10_000
    load_src = inspect.getsource(discover_mod.load_discover_eligible_roots)
    assert "limit(MAX_DISCOVER_ELIGIBLE_LOAD)" in load_src.replace(" ", "") or (
        "MAX_DISCOVER_ELIGIBLE_LOAD" in load_src
    )
