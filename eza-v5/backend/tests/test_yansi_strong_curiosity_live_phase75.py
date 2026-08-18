# -*- coding: utf-8 -*-
"""Phase 7.5 — Güçlü Merak production activation and guardrails."""

from __future__ import annotations

import inspect
import time
import tracemalloc
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from backend.core.schemas.mirror_network import DiscoverMirrorItem, DiscoverMirrorListResponse
from backend.routers import mirror_network as mirror_router
from backend.services.mirror_network import discover as discover_mod
from backend.services.mirror_network.discover import (
    DEFAULT_DISCOVER_MODE,
    list_discover_mirrors,
    parse_discover_mode,
)
from backend.services.mirror_network.yansi_strong_curiosity_evaluation import (
    PHASE73_SEMANTIC_KEYS,
    _candidate,
)
from backend.services.mirror_network.yansi_strong_curiosity_final_shadow import (
    POLICY_VERSION,
    build_phase742_reference_cohorts,
    order_final_shadow_candidates,
)
from backend.services.mirror_network import yansi_strong_curiosity_live as live_mod
from backend.services.mirror_network.yansi_strong_curiosity_live import (
    clear_strong_curiosity_rank_cache,
    is_strong_curiosity_discover_enabled,
    order_eligible_roots_for_strong_curiosity,
)
from backend.services.mirror_network.yansi_strong_curiosity_shadow import SHADOW_STRATEGIES


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
FORBIDDEN_PUBLIC = (
    "reasonCodes",
    "policyVersion",
    "orderedCandidates",
    "candidateState",
    "curiosityScore",
    "rankScore",
    "qualityScore",
    "weightedScore",
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


def _eligible(slugs: list[str]):
    return [
        (_root(slug, published_ts=index + 1), f"https://cdn.example/{slug}.png")
        for index, slug in enumerate(slugs)
    ]


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


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_strong_curiosity_rank_cache()
    yield
    clear_strong_curiosity_rank_cache()


def test_missing_mode_is_random():
    assert parse_discover_mode(None) == "random"
    assert parse_discover_mode("") == "random"
    assert DEFAULT_DISCOVER_MODE == "random"


@pytest.mark.asyncio
async def test_kill_switch_fail_closed_does_not_alias_other_modes():
    eligible = _eligible(["mass-popularity", "quiet-root"])
    db = _empty_execute()
    with (
        patch(ENABLED, return_value=False),
        patch(LOAD, new=AsyncMock(return_value=eligible)),
        patch(BATCH, new=AsyncMock(side_effect=AssertionError("ranking_ran_while_disabled"))),
    ):
        gm = await list_discover_mirrors(db, mode="strong_curiosity", limit=10)
        newest = await list_discover_mirrors(db, mode="newest", limit=10)
        random_list = await list_discover_mirrors(
            db, mode="random", limit=10, random_session="session-fair-01"
        )
    assert gm.mode == "strong_curiosity"
    assert gm.items == []
    assert gm.total == 0
    assert gm.strongCuriosityReady is False
    assert [item.slug for item in newest.items] == ["quiet-root", "mass-popularity"]
    assert random_list.mode == "random"
    assert [item.slug for item in random_list.items]


@pytest.mark.asyncio
async def test_ranking_exception_fail_closed_not_random_or_newest():
    eligible = _eligible(["hot", "quiet"])

    async def boom(*_args, **_kwargs):
        raise RuntimeError("ranking_failed")

    db = _empty_execute()
    with (
        patch(ENABLED, return_value=True),
        patch(LOAD, new=AsyncMock(return_value=eligible)),
        patch(BATCH, new=boom),
        patch(METRICS, new=AsyncMock(return_value={})),
    ):
        gm = await list_discover_mirrors(db, mode="strong_curiosity", limit=10)
        newest = await list_discover_mirrors(db, mode="newest", limit=10)
    assert gm.strongCuriosityReady is False
    assert gm.items == []
    assert gm.total == 0
    assert [item.slug for item in newest.items] == ["quiet", "hot"]


@pytest.mark.asyncio
async def test_enabled_returns_frozen_742_order_and_pagination():
    rows = [
        row
        for row in build_phase742_reference_cohorts(evaluated_at=NOW)
        if row.get("inCandidatePool")
    ]
    expected = [str(row.get("slug")) for row in order_final_shadow_candidates(rows)]
    by_slug = {row["slug"]: row for row in rows}
    eligible = _eligible(list(by_slug))
    reversed_eligible = list(reversed(eligible))

    async def batch(_db, pairs, **_kwargs):
        return [by_slug[slug] for slug, _version in pairs if slug in by_slug]

    db = _empty_execute()
    with (
        patch(ENABLED, return_value=True),
        patch(LOAD, new=AsyncMock(return_value=reversed_eligible)),
        patch(BATCH, new=batch),
        patch(METRICS, new=AsyncMock(return_value={})),
    ):
        page1 = await list_discover_mirrors(db, mode="strong_curiosity", limit=10, offset=0)
        page2 = await list_discover_mirrors(db, mode="strong_curiosity", limit=10, offset=10)
        again = await list_discover_mirrors(db, mode="strong_curiosity", limit=10, offset=0)
    assert page1.strongCuriosityReady is True
    assert page1.mode == "strong_curiosity"
    assert page1.total == len(expected)
    assert [item.slug for item in page1.items] == expected[:10]
    assert [item.slug for item in page2.items] == expected[10:20]
    assert [item.slug for item in again.items] == expected[:10]
    overlap = {item.slug for item in page1.items} & {item.slug for item in page2.items}
    assert not overlap
    dumped = page1.model_dump()
    for token in FORBIDDEN_PUBLIC:
        assert token not in dumped
        assert token not in dumped["items"][0]


@pytest.mark.asyncio
async def test_frozen_policy_pairs_on_live_path():
    rows = build_phase742_reference_cohorts(evaluated_at=NOW)
    by_slug = {row["slug"]: row for row in rows}
    eligible = _eligible([row["slug"] for row in rows if row.get("inCandidatePool")])

    async def batch(_db, pairs, **_kwargs):
        return [by_slug[slug] for slug, _version in pairs if slug in by_slug]

    db = _empty_execute()
    with (
        patch(ENABLED, return_value=True),
        patch(LOAD, new=AsyncMock(return_value=eligible)),
        patch(BATCH, new=batch),
        patch(METRICS, new=AsyncMock(return_value={})),
    ):
        gm = await list_discover_mirrors(db, mode="strong_curiosity", limit=48, offset=0)
    pos = {item.slug: index for index, item in enumerate(gm.items)}
    assert pos["smaller-external-generativity"] < pos["mass-popularity"]
    assert pos["supported-engagement"] < pos["tiny-perfect"]
    assert pos["external-diversity"] < pos["child-self-farm"]
    assert POLICY_VERSION == "strong_curiosity_final_shadow_v742"


@pytest.mark.asyncio
async def test_insufficient_new_yansi_stays_in_random_and_newest_not_gm():
    new_row = _candidate(
        slug="new-yansi",
        started=0,
        completed=0,
        children=0,
        published_at=NOW,
        evaluated_at=NOW,
    )
    new_row["inCandidatePool"] = False
    new_row["candidateState"] = "INSUFFICIENT_EVIDENCE"
    ready = _lite_row("ready-yansi", started=20)
    eligible = _eligible(["new-yansi", "ready-yansi"])
    profiles = [new_row, ready]

    async def batch(_db, _pairs, **_kwargs):
        return profiles

    db = _empty_execute()
    with (
        patch(ENABLED, return_value=True),
        patch(LOAD, new=AsyncMock(return_value=eligible)),
        patch(BATCH, new=batch),
        patch(METRICS, new=AsyncMock(return_value={})),
    ):
        gm = await list_discover_mirrors(db, mode="strong_curiosity", limit=10)
        newest = await list_discover_mirrors(db, mode="newest", limit=10)
        random_list = await list_discover_mirrors(
            db, mode="random", limit=10, random_session="session-fair-01"
        )
    assert [item.slug for item in gm.items] == ["ready-yansi"]
    assert "new-yansi" not in [item.slug for item in gm.items]
    assert "new-yansi" in [item.slug for item in newest.items]
    assert "new-yansi" in [item.slug for item in random_list.items]


@pytest.mark.asyncio
async def test_eza_and_followers_cannot_change_live_order():
    rows = [
        row
        for row in build_phase742_reference_cohorts(evaluated_at=NOW)
        if row.get("inCandidatePool")
    ]
    expected = [str(row.get("slug")) for row in order_final_shadow_candidates(rows)]
    injected = []
    for row in rows:
        copy = dict(row)
        copy["ezaScore"] = 99
        copy["followers"] = 80_000
        copy["creatorPopularity"] = 1_000_000
        injected.append(copy)
    by_slug = {row["slug"]: row for row in injected}
    eligible = _eligible(list(by_slug))

    async def batch(_db, pairs, **_kwargs):
        return [by_slug[slug] for slug, _version in pairs if slug in by_slug]

    db = _empty_execute()
    with (
        patch(ENABLED, return_value=True),
        patch(LOAD, new=AsyncMock(return_value=eligible)),
        patch(BATCH, new=batch),
        patch(METRICS, new=AsyncMock(return_value={})),
    ):
        gm = await list_discover_mirrors(db, mode="strong_curiosity", limit=48)
    assert [item.slug for item in gm.items] == expected[:48]


@pytest.mark.asyncio
async def test_self_play_does_not_help_live_order():
    farm = _candidate(
        slug="self-farm",
        started=80,
        completed=70,
        unique=1,
        prefix="farm",
        children=12,
        child_authors=["self-farm-author"] * 12,
        published_at=NOW,
        evaluated_at=NOW,
    )
    diverse = _candidate(
        slug="external-diversity",
        started=20,
        completed=12,
        unique=12,
        children=8,
        child_authors=[f"ext-{i}" for i in range(8)],
        published_at=NOW,
        evaluated_at=NOW,
    )
    by_slug = {"self-farm": farm, "external-diversity": diverse}

    async def batch(_db, pairs, **_kwargs):
        return [by_slug[slug] for slug, _version in pairs]

    with patch(BATCH, new=batch):
        ranked = await order_eligible_roots_for_strong_curiosity(
            AsyncMock(), _eligible(["self-farm", "external-diversity"])
        )
    slugs = [node.slug for node, _scene in ranked["ordered"]]
    assert slugs.index("external-diversity") < slugs.index("self-farm")
    assert "guest_fingerprint" not in inspect.getsource(live_mod)


@pytest.mark.asyncio
async def test_historical_row_can_remain_in_pool():
    hist = _candidate(slug="historical-yansi", started=10, completed=6, evaluated_at=NOW)
    hist["candidateState"] = "HISTORICAL_ONLY"
    hist["inCandidatePool"] = True
    gen = hist.get("generativityEvidence") or {}
    gen["status"] = "HISTORICAL"
    hist["generativityEvidence"] = gen
    modern = _lite_row("modern-yansi", started=12)
    by_slug = {"historical-yansi": hist, "modern-yansi": modern}

    async def batch(_db, pairs, **_kwargs):
        return [by_slug[slug] for slug, _version in pairs]

    with patch(BATCH, new=batch):
        ranked = await order_eligible_roots_for_strong_curiosity(
            AsyncMock(),
            _eligible(["historical-yansi", "modern-yansi"]),
        )
    slugs = [node.slug for node, _ in ranked["ordered"]]
    assert "historical-yansi" in slugs
    assert "modern-yansi" in slugs


@pytest.mark.asyncio
async def test_diagnostics_and_seed_not_executed_on_live_rank():
    def boom(*_args, **_kwargs):
        raise AssertionError("diagnostic_path_executed")

    rows = [_lite_row("a", 8), _lite_row("b", 3)]
    eligible = _eligible(["a", "b"])

    async def batch(_db, _pairs, **_kwargs):
        return rows

    with (
        patch(BATCH, new=batch),
        patch(
            "backend.services.mirror_network.yansi_strong_curiosity_evaluation._pairwise_agreement",
            new=boom,
        ),
        patch(
            "backend.services.mirror_network.yansi_strong_curiosity_final_shadow.evaluate_strong_curiosity_final_shadow",
            new=boom,
        ),
        patch(
            "backend.services.mirror_network.yansi_strong_curiosity_production_shadow.evaluate_production_corpus_shadow",
            new=boom,
        ),
    ):
        ranked = await order_eligible_roots_for_strong_curiosity(AsyncMock(), eligible)
    assert ranked["poolCount"] == 2
    src = inspect.getsource(live_mod)
    assert "evaluate_strong_curiosity_final_shadow" not in src
    assert "evaluate_production_corpus_shadow" not in src
    assert "pairwise_volume_agreement_diagnostic" not in src
    assert "yansi_strong_curiosity_staging_seed" not in src
    assert "write_internal_artifact" not in src
    discover_src = inspect.getsource(discover_mod)
    assert "yansi_strong_curiosity_staging_seed" not in discover_src
    assert "yansi_strong_curiosity_production_shadow" not in discover_src
    assert "seed_strong_curiosity" not in inspect.getsource(mirror_router)


def test_live_uses_canonical_order_function():
    assert "order_final_shadow_candidates" in inspect.getsource(live_mod)
    assert POLICY_VERSION == "strong_curiosity_final_shadow_v742"
    assert PHASE73_SEMANTIC_KEYS["balanced_evidence"][0] == (
        "available_independent_family_count DESC"
    )
    assert SHADOW_STRATEGIES[1] == "balanced_evidence"


@pytest.mark.asyncio
async def test_cache_repeat_skips_batch_and_is_deterministic():
    calls = {"n": 0}
    rows = [_lite_row("aa", 9), _lite_row("bb", 4)]
    eligible = _eligible(["aa", "bb"])

    async def batch(_db, _pairs, **_kwargs):
        calls["n"] += 1
        return rows

    with patch(BATCH, new=batch):
        first = await order_eligible_roots_for_strong_curiosity(AsyncMock(), eligible)
        second = await order_eligible_roots_for_strong_curiosity(
            AsyncMock(), list(reversed(eligible))
        )
    assert calls["n"] == 1
    assert first["cacheHit"] is False
    assert second["cacheHit"] is True
    assert [n.slug for n, _ in first["ordered"]] == [n.slug for n, _ in second["ordered"]]


@pytest.mark.asyncio
async def test_scale_and_query_projection_not_n_plus_one():
    async def run(n: int):
        slugs = [f"p{i:05d}" for i in range(n)]
        rows = [_lite_row(slug, 5 + (i % 11)) for i, slug in enumerate(slugs)]
        eligible = _eligible(slugs)
        tracemalloc.start()
        started = time.perf_counter()
        with patch(BATCH, new=AsyncMock(return_value=rows)):
            ranked = await order_eligible_roots_for_strong_curiosity(AsyncMock(), eligible)
        elapsed = (time.perf_counter() - started) * 1000
        _, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        clear_strong_curiosity_rank_cache()
        return {"n": n, "pool": ranked["poolCount"], "ms": elapsed, "peak": peak}

    hundred = await run(100)
    thousand = await run(1_000)
    ten_k = await run(10_000)
    assert hundred["pool"] == 100
    assert thousand["pool"] == 1_000
    assert ten_k["pool"] == 10_000
    assert ten_k["ms"] < 30_000
    page_src = inspect.getsource(discover_mod._project_discover_page)
    assert "get_yansi_public_metrics_batch" in page_src
    assert "get_yansi_public_metrics(" not in page_src.replace(
        "get_yansi_public_metrics_batch", ""
    )
    print("PHASE75_SCALE", {"100": hundred, "1000": thousand, "10000": ten_k})


def test_public_dto_and_flag_defaults():
    payload = DiscoverMirrorListResponse(items=[], total=0, mode="strong_curiosity")
    dumped = payload.model_dump()
    assert dumped["strongCuriosityReady"] is False
    assert "reasonCodes" not in DiscoverMirrorItem.model_fields
    assert is_strong_curiosity_discover_enabled() in (True, False)
    copy = (
        Path(__file__).resolve().parents[2]
        / "frontend"
        / "lib"
        / "eza"
        / "mirror-network"
        / "discoverCopy.ts"
    ).read_text(encoding="utf-8")
    assert "Güçlü Merak şu anda kullanılamıyor." in copy
    assert "Güçlü Merak henüz hazır değil." not in copy
