# -*- coding: utf-8 -*-
"""Phase 7.4.3d — bounded Strong Curiosity pairwise diagnostics."""

from __future__ import annotations

import inspect
import random
import time
import tracemalloc
from datetime import datetime, timezone
from itertools import combinations as std_combinations
from unittest.mock import AsyncMock, patch

import pytest

from backend.routers import mirror_network as mirror_router
from backend.services.mirror_network import discover as discover_mod
from backend.services.mirror_network.discover import (
    DEFAULT_DISCOVER_MODE,
    list_discover_mirrors,
    parse_discover_mode,
)
from backend.services.mirror_network.yansi_strong_curiosity_evaluation import (
    PHASE73_SEMANTIC_KEYS,
    _pairwise_agreement,
)
from backend.services.mirror_network.yansi_strong_curiosity_final_shadow import (
    POLICY_VERSION,
    build_phase742_reference_cohorts,
    evaluate_strong_curiosity_final_shadow,
    order_final_shadow_candidates,
)
from backend.services.mirror_network.yansi_strong_curiosity_pairwise_diagnostic import (
    BOUNDED_PAIR_BUDGET,
    DIAGNOSTIC_MODE_BOUNDED_SAMPLE,
    DIAGNOSTIC_MODE_EXACT,
    EXACT_PAIRWISE_MAX_SLUGS,
    PAIRWISE_DIAGNOSTIC_VERSION,
    pair_population_size,
    pairwise_volume_agreement_diagnostic,
    select_diagnostic_pairs,
)
from backend.services.mirror_network import yansi_strong_curiosity_pairwise_diagnostic as diag_mod
from backend.services.mirror_network.yansi_strong_curiosity_shadow import (
    FORBIDDEN_SHADOW_SCORE_KEYS,
    HIGH_VOLUME_DEPENDENCE_RATIO,
    SHADOW_STRATEGIES,
    compare_shadow_strategy_results,
    order_shadow_candidates,
    run_shadow_on_candidates,
)


NOW = datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc)
FULL_10K_PAIRS = pair_population_size(10_000)


def _slugs(n: int) -> list[str]:
    return [f"s{index:05d}" for index in range(n)]


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


def _volume_positions(n: int) -> tuple[dict[str, int], dict[str, float]]:
    slugs = _slugs(n)
    volumes = {slug: float(index) for index, slug in enumerate(slugs)}
    positions = {slug: n - index for index, slug in enumerate(slugs)}
    return positions, volumes


def test_exact_mode_at_100():
    slugs = _slugs(100)
    mode, pairs = select_diagnostic_pairs(slugs, series_key="started")
    assert mode == DIAGNOSTIC_MODE_EXACT
    assert EXACT_PAIRWISE_MAX_SLUGS >= 100
    assert len(pairs) == pair_population_size(100) == 4950
    result = pairwise_volume_agreement_diagnostic(
        {slug: i + 1 for i, slug in enumerate(slugs)},
        {slug: float(i) for i, slug in enumerate(slugs)},
        series_key="started",
        warning_ratio=HIGH_VOLUME_DEPENDENCE_RATIO,
    )
    assert result["diagnosticMode"] == DIAGNOSTIC_MODE_EXACT
    assert result["evaluatedPairCount"] == 4950
    assert result["dependencePrecision"] == "EXACT"


def test_1000_uses_bounded_sample_not_full_population():
    slugs = _slugs(1_000)
    population = pair_population_size(1_000)
    mode, pairs = select_diagnostic_pairs(slugs, series_key="started")
    assert mode == DIAGNOSTIC_MODE_BOUNDED_SAMPLE
    assert len(pairs) <= BOUNDED_PAIR_BUDGET
    assert len(pairs) < population
    assert population == 499_500


def test_10000_does_not_enumerate_50m_pairs(monkeypatch):
    def guarded(iterable, r):
        seq = list(iterable)
        if r == 2 and len(seq) > EXACT_PAIRWISE_MAX_SLUGS:
            raise AssertionError(f"full_pairwise_enumerated n={len(seq)}")
        return std_combinations(seq, r)

    monkeypatch.setattr(diag_mod, "combinations", guarded)
    slugs = _slugs(10_000)
    mode, pairs = select_diagnostic_pairs(slugs, series_key="started")
    assert mode == DIAGNOSTIC_MODE_BOUNDED_SAMPLE
    assert len(pairs) <= BOUNDED_PAIR_BUDGET
    assert FULL_10K_PAIRS == 49_995_000
    assert len(pairs) < FULL_10K_PAIRS / 1000
    result = pairwise_volume_agreement_diagnostic(
        {slug: i + 1 for i, slug in enumerate(slugs)},
        {slug: float(10_000 - i) for i, slug in enumerate(slugs)},
        series_key="started",
        warning_ratio=HIGH_VOLUME_DEPENDENCE_RATIO,
    )
    assert result["evaluatedPairCount"] <= BOUNDED_PAIR_BUDGET
    assert result["pairPopulationSize"] == FULL_10K_PAIRS
    assert result["diagnosticMode"] == DIAGNOSTIC_MODE_BOUNDED_SAMPLE
    assert result["dependencePrecision"] == "SAMPLED"


def test_deterministic_repeatability_and_reversed_input():
    slugs = _slugs(1_000)
    first = select_diagnostic_pairs(slugs, series_key="started")
    second = select_diagnostic_pairs(slugs, series_key="started")
    reversed_pairs = select_diagnostic_pairs(list(reversed(slugs)), series_key="started")
    assert first == second == reversed_pairs
    shuffled = slugs[::2] + slugs[1::2]
    assert select_diagnostic_pairs(shuffled, series_key="started") == first


def test_sample_does_not_change_shadow_order():
    rows = [_lite_row(slug, started=20 + (i % 17)) for i, slug in enumerate(_slugs(1_000))]
    before = [row["slug"] for row in order_shadow_candidates(rows, strategy="balanced_evidence")]
    final_before = [row["slug"] for row in order_final_shadow_candidates(rows)]
    positions = {slug: i + 1 for i, slug in enumerate(before)}
    volumes = {row["slug"]: float(row["selfInteraction"]["rankingEligibleStartedCount"]) for row in rows}
    diagnostic = pairwise_volume_agreement_diagnostic(
        positions,
        volumes,
        series_key="balanced_evidence:rankingEligibleStartedCount",
        warning_ratio=HIGH_VOLUME_DEPENDENCE_RATIO,
    )
    after = [row["slug"] for row in order_shadow_candidates(rows, strategy="balanced_evidence")]
    final_after = [row["slug"] for row in order_final_shadow_candidates(rows)]
    assert before == after
    assert final_before == final_after
    assert diagnostic["evaluatedPairCount"] <= BOUNDED_PAIR_BUDGET
    assert "pairwise" not in inspect.getsource(order_shadow_candidates)
    assert "combinations" not in inspect.getsource(order_shadow_candidates)
    assert "pairwise" not in inspect.getsource(order_final_shadow_candidates)


def test_popularity_pathology_still_flags_on_bounded_sample():
    positions, volumes = _volume_positions(10_000)
    result = pairwise_volume_agreement_diagnostic(
        positions,
        volumes,
        series_key="pathology-started",
        warning_ratio=HIGH_VOLUME_DEPENDENCE_RATIO,
    )
    assert result["diagnosticMode"] == DIAGNOSTIC_MODE_BOUNDED_SAMPLE
    assert result["dependence"] == "HIGH_MONOTONIC_DEPENDENCE"
    assert result["agreementRatio"] == 1.0
    assert result["warningThreshold"] == 0.90
    small_positions, small_volumes = _volume_positions(80)
    exact = pairwise_volume_agreement_diagnostic(
        small_positions,
        small_volumes,
        series_key="pathology-started",
        warning_ratio=HIGH_VOLUME_DEPENDENCE_RATIO,
    )
    assert exact["diagnosticMode"] == DIAGNOSTIC_MODE_EXACT
    assert exact["dependence"] == "HIGH_MONOTONIC_DEPENDENCE"


def test_no_random_state(monkeypatch):
    def boom(*_args, **_kwargs):
        raise AssertionError("runtime_random_used")

    monkeypatch.setattr(random, "random", boom)
    monkeypatch.setattr(random, "shuffle", boom)
    monkeypatch.setattr(random, "choice", boom)
    src = inspect.getsource(diag_mod)
    assert "random." not in src
    assert "import random" not in src
    select_diagnostic_pairs(_slugs(1_000), series_key="started")
    pairwise_volume_agreement_diagnostic(
        *_volume_positions(1_000),
        series_key="started",
        warning_ratio=0.90,
    )


def test_no_score_fields_in_diagnostic():
    result = pairwise_volume_agreement_diagnostic(
        *_volume_positions(100),
        series_key="started",
        warning_ratio=0.90,
    )
    leaked = FORBIDDEN_SHADOW_SCORE_KEYS.intersection(result)
    assert not leaked
    for token in ("rankScore", "qualityScore", "weightedScore", "curiosityScore", "compositeScore"):
        assert token not in result


def test_phase742_order_unchanged():
    rows = build_phase742_reference_cohorts(evaluated_at=NOW)
    report = evaluate_strong_curiosity_final_shadow(rows, evaluated_at=NOW)
    pos = {
        item["slug"]: item["ordinal"]
        for item in report["orderedCandidates"]
    }
    assert POLICY_VERSION == "strong_curiosity_final_shadow_v742"
    assert pos["smaller-external-generativity"] < pos["mass-popularity"]
    assert pos["supported-engagement"] < pos["tiny-perfect"]
    assert pos["external-diversity"] < pos["child-self-farm"]
    dep = report["popularityDependence"]["rankingEligibleStartedCount"]
    assert dep["dependence"] != "HIGH_MONOTONIC_DEPENDENCE"
    assert dep["diagnosticMode"] == DIAGNOSTIC_MODE_EXACT
    assert HIGH_VOLUME_DEPENDENCE_RATIO == 0.90
    assert PHASE73_SEMANTIC_KEYS["balanced_evidence"][0] == "available_independent_family_count DESC"


def _record_scale(n: int) -> dict:
    rows = [_lite_row(slug, started=5 + (i % 23)) for i, slug in enumerate(_slugs(n))]
    tracemalloc.start()
    started = time.perf_counter()
    ordered = order_shadow_candidates(rows, strategy="balanced_evidence")
    ranking_ms = (time.perf_counter() - started) * 1000
    positions = {row["slug"]: i + 1 for i, row in enumerate(ordered)}
    volumes = {
        row["slug"]: float(row["selfInteraction"]["rankingEligibleStartedCount"])
        for row in rows
    }
    diag_started = time.perf_counter()
    diagnostic = _pairwise_agreement(positions, volumes, series_key="scale:started")
    diagnostic_ms = (time.perf_counter() - diag_started) * 1000
    total_started = time.perf_counter()
    shadow = run_shadow_on_candidates(rows)
    compare_shadow_strategy_results(shadow["results"])
    total_ms = ranking_ms + diagnostic_ms + (time.perf_counter() - total_started) * 1000
    _, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    return {
        "n": n,
        "rankingMs": ranking_ms,
        "diagnosticMs": diagnostic_ms,
        "totalMs": total_ms,
        "evaluatedPairCount": diagnostic["evaluatedPairCount"],
        "pairPopulationSize": diagnostic["pairPopulationSize"],
        "diagnosticMode": diagnostic["diagnosticMode"],
        "peakMemoryBytes": peak,
        "orderSlug": ordered[0]["slug"],
    }


def test_scale_benchmarks_100_1000_10000():
    hundred = _record_scale(100)
    thousand = _record_scale(1_000)
    ten_k = _record_scale(10_000)
    print("PHASE743D_SCALE", {"100": hundred, "1000": thousand, "10000": ten_k})
    assert hundred["diagnosticMode"] == DIAGNOSTIC_MODE_EXACT
    assert hundred["evaluatedPairCount"] == 4950
    assert thousand["diagnosticMode"] == DIAGNOSTIC_MODE_BOUNDED_SAMPLE
    assert thousand["evaluatedPairCount"] <= BOUNDED_PAIR_BUDGET
    assert ten_k["diagnosticMode"] == DIAGNOSTIC_MODE_BOUNDED_SAMPLE
    assert ten_k["evaluatedPairCount"] <= BOUNDED_PAIR_BUDGET
    assert ten_k["pairPopulationSize"] == FULL_10K_PAIRS
    assert ten_k["rankingMs"] < 30_000
    assert ten_k["diagnosticMs"] < 30_000
    assert ten_k["totalMs"] < 180_000


def test_strategy_pair_comparisons_are_not_corpus_n_squared():
    src = inspect.getsource(compare_shadow_strategy_results)
    assert "combinations(names, 2)" in src
    assert "combinations(slugs" not in src
    eval_src = inspect.getsource(
        __import__(
            "backend.services.mirror_network.yansi_strong_curiosity_evaluation",
            fromlist=["_strategy_differentiation"],
        )._strategy_differentiation
    )
    assert "combinations(results, 2)" in eval_src


def test_live_discover_isolation_and_placeholder():
    src = inspect.getsource(discover_mod)
    router_src = inspect.getsource(mirror_router)
    for token in (
        "yansi_strong_curiosity_pairwise_diagnostic",
        "yansi_strong_curiosity_final_shadow",
        "yansi_strong_curiosity_production_shadow",
        "inspect_alembic_version_capacity",
        "alembic_version_capacity",
    ):
        assert token not in src
        assert token not in router_src
    assert DEFAULT_DISCOVER_MODE == "random"
    assert parse_discover_mode(None) == "random"


@pytest.mark.asyncio
async def test_strong_curiosity_still_placeholder():
    db = AsyncMock()
    with patch(
        "backend.services.mirror_network.discover.load_discover_eligible_roots",
        new=AsyncMock(return_value=[]),
    ):
        response = await list_discover_mirrors(db, mode="strong_curiosity", limit=10)
    assert response.items == []
    assert response.total == 0
    assert response.strongCuriosityReady is False


def test_policy_and_comparator_sources_untouched_by_diagnostic_module():
    from backend.services.mirror_network import yansi_strong_curiosity_policy as policy_mod
    from backend.services.mirror_network import yansi_strong_curiosity_final_shadow as final_mod

    assert "pairwise_volume_agreement_diagnostic" not in inspect.getsource(policy_mod)
    assert POLICY_VERSION in inspect.getsource(final_mod)
    assert "select_diagnostic_pairs" not in inspect.getsource(order_final_shadow_candidates)
    assert SHADOW_STRATEGIES == (
        "control_input_order",
        "balanced_evidence",
        "generativity_led",
        "engagement_led",
        "evidence_stability",
    )
