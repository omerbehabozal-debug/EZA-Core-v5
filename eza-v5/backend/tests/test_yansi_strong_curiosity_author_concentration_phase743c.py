# -*- coding: utf-8 -*-
"""Phase 7.4.3c — author concentration diagnosis (CI / in-memory)."""

from __future__ import annotations

import inspect
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from backend.routers import mirror_network as mirror_router
from backend.services.mirror_network import discover as discover_mod
from backend.services.mirror_network.discover import (
    DEFAULT_DISCOVER_MODE,
    list_discover_mirrors,
    parse_discover_mode,
)
from backend.services.mirror_network.yansi_normalization import derive_child_diversity
from backend.services.mirror_network.yansi_strong_curiosity_author_concentration_diagnosis import (
    DIAGNOSIS_VERSION,
    FORBIDDEN_DIAGNOSIS_RANKING_KEYS,
    MAP_BALANCED,
    MAP_BASELINE,
    OWNER_LABEL_ONLY,
    SEEDED_MAP_IDS,
    apply_full_author_semantics,
    analyze_archetype_author_matrix,
    balanced_round_robin_author_map,
    baseline_author_handle,
    baseline_author_map,
    build_plan_roots,
    classify_diagnosis,
    concentration_metrics,
    evaluate_mapping,
    run_in_memory_diagnosis,
    seeded_author_shuffle_map,
    simulate_743b_top10_slugs,
)
from backend.services.mirror_network.yansi_strong_curiosity_evaluation import (
    PHASE73_SEMANTIC_KEYS,
    _candidate,
)
from backend.services.mirror_network.yansi_strong_curiosity_final_shadow import (
    POLICY_VERSION,
    build_phase742_reference_cohorts,
)
from backend.services.mirror_network.yansi_strong_curiosity_production_shadow import (
    EVALUATOR_VERSION,
)
from backend.services.mirror_network.yansi_strong_curiosity_shadow import SHADOW_STRATEGIES
from backend.services.mirror_network.yansi_strong_curiosity_staging_seed import (
    ARCHETYPE_CYCLE,
    AUTHOR_HANDLES,
)

NOW = datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc)
EZA_V5_BACKEND = Path(__file__).resolve().parents[1]
DIAG_MOD = EZA_V5_BACKEND / "services" / "mirror_network" / "yansi_strong_curiosity_author_concentration_diagnosis.py"


@pytest.fixture(scope="module")
def medium_roots():
    return build_plan_roots("medium")


def test_baseline_mapping_pins_each_archetype_to_one_author(medium_roots):
    mapping = baseline_author_map(medium_roots)
    matrix = analyze_archetype_author_matrix(medium_roots, mapping)
    assert matrix["moduloCoupling"] is True
    pinned = set(matrix["archetypesPinnedToOneAuthor"])
    assert pinned == set(ARCHETYPE_CYCLE)
    small = next(row for row in matrix["rows"] if row["archetype"] == "small_generative")
    external = next(row for row in matrix["rows"] if row["archetype"] == "external_diversity")
    mass = next(row for row in matrix["rows"] if row["archetype"] == "mass")
    old = next(row for row in matrix["rows"] if row["archetype"] == "old_high_volume")
    assert small["distinctAuthorCount"] == 1
    assert small["authors"] == ["bob"]
    assert external["authors"] == ["judy"]
    assert mass["authors"] == ["alice"]
    assert old["authors"] == ["alice"]
    assert baseline_author_handle(1, "small_generative") == "bob"
    assert baseline_author_handle(25, "small_generative") == "bob"


def test_baseline_743b_top10_concentration_reproduced(medium_roots):
    mapping = baseline_author_map(medium_roots)
    slugs = simulate_743b_top10_slugs(medium_roots)
    metrics = concentration_metrics(slugs, mapping)
    assert metrics["distinctAuthorCount"] == 2
    assert metrics["topAuthorShare"] == 0.50
    assert metrics["maxItemsPerAuthor"] == 5


def test_balanced_round_robin_is_deterministic_and_independent(medium_roots):
    first = balanced_round_robin_author_map(medium_roots)
    second = balanced_round_robin_author_map(medium_roots)
    assert first == second
    counts = {}
    for handle in first.values():
        counts[handle] = counts.get(handle, 0) + 1
    assert set(first.values()) == set(AUTHOR_HANDLES)
    assert max(counts.values()) - min(counts.values()) <= 1
    matrix = analyze_archetype_author_matrix(medium_roots, first)
    small = next(row for row in matrix["rows"] if row["archetype"] == "small_generative")
    assert small["distinctAuthorCount"] >= 5
    assert small["largestAuthorShare"] < 0.40


def test_seeded_shuffles_are_deterministic_and_differ(medium_roots):
    maps = {
        seed: seeded_author_shuffle_map(medium_roots, seed=seed) for seed in SEEDED_MAP_IDS
    }
    for seed, mapping in maps.items():
        assert mapping == seeded_author_shuffle_map(medium_roots, seed=seed)
        assert set(mapping.values()) <= set(AUTHOR_HANDLES)
    payloads = [tuple(sorted(mapping.items())) for mapping in maps.values()]
    assert len(set(payloads)) == len(SEEDED_MAP_IDS)
    balanced = balanced_round_robin_author_map(medium_roots)
    assert tuple(sorted(balanced.items())) not in set(payloads)


def test_owner_label_only_preserves_pool_and_final_order():
    from backend.services.mirror_network.yansi_strong_curiosity_author_concentration_diagnosis import (
        _ranking_fingerprint,
    )

    rows = build_phase742_reference_cohorts(evaluated_at=NOW)
    roots = [
        {"slug": row["slug"], "archetype": ARCHETYPE_CYCLE[index % len(ARCHETYPE_CYCLE)], "index": index}
        for index, row in enumerate(rows)
    ]
    baseline = {row["slug"]: AUTHOR_HANDLES[index % len(AUTHOR_HANDLES)] for index, row in enumerate(rows)}
    balanced = balanced_round_robin_author_map(roots)
    fingerprint = _ranking_fingerprint(rows)
    base_run = evaluate_mapping(
        rows,
        author_by_slug=baseline,
        mapping_id=MAP_BASELINE,
        mode=OWNER_LABEL_ONLY,
        evaluated_at=NOW,
    )
    remapped = evaluate_mapping(
        rows,
        author_by_slug=balanced,
        mapping_id=MAP_BALANCED,
        mode=OWNER_LABEL_ONLY,
        evaluated_at=NOW,
        baseline_fingerprint=fingerprint,
    )
    assert remapped["invariant"]["finalUnchanged"] is True
    assert remapped["invariant"]["poolUnchanged"] is True
    assert remapped["invariant"]["foundationUnchanged"] is True
    assert remapped["ranking"]["finalTop10"] == base_run["ranking"]["finalTop10"]
    assert remapped["concentration"]["10"]["authorItemCounts"] != base_run["concentration"]["10"]["authorItemCounts"]


def test_owner_label_only_changes_concentration_not_order(medium_roots):
    slugs = simulate_743b_top10_slugs(medium_roots)
    baseline = baseline_author_map(medium_roots)
    balanced = balanced_round_robin_author_map(medium_roots)
    before = concentration_metrics(slugs, baseline)
    after = concentration_metrics(slugs, balanced)
    assert before["distinctAuthorCount"] == 2
    assert after["distinctAuthorCount"] >= 6
    assert after["topAuthorShare"] <= 0.30


def test_full_author_semantics_recomputes_self_vs_external():
    row = _candidate(
        slug="p743c-parent",
        started=10,
        completed=6,
        unique=6,
        children=3,
        continuations=2,
        child_authors=["alice", "bob", "carol"],
        evaluated_at=NOW,
    )
    as_bob = apply_full_author_semantics(
        row, new_parent_author="bob", child_authors=["alice", "bob", "carol"]
    )
    gen = as_bob["generativityEvidence"]
    assert gen["selfAuthoredChildCount"] == 1
    assert gen["externalDirectChildYansiCount"] == 2
    assert gen["distinctExternalChildAuthorCount"] == 2
    expected = derive_child_diversity(
        child_author_ids=["alice", "bob", "carol"], parent_author_id="bob"
    )
    assert gen["selfAuthoredChildCount"] == expected["selfAuthoredChildCount"]
    as_dave = apply_full_author_semantics(
        row, new_parent_author="dave", child_authors=["alice", "bob", "carol"]
    )
    assert as_dave["generativityEvidence"]["selfAuthoredChildCount"] == 0
    assert as_dave["generativityEvidence"]["externalDirectChildYansiCount"] == 3
    assert as_dave["generativityEvidence"]["distinctExternalChildAuthorCount"] == 3


def test_no_creator_popularity_or_eza_or_quota():
    src = DIAG_MOD.read_text(encoding="utf-8")
    assert "max 1 item per author" not in src
    assert "AUTHOR QUOTA" not in src
    assert FORBIDDEN_DIAGNOSIS_RANKING_KEYS.issuperset(
        {
            "authorPenalty",
            "authorBoost",
            "followerCount",
            "assistantScore",
            "relationshipMap",
            "ezaSnapshot",
            "strongCuriosityScore",
        }
    )
    final_src = inspect.getsource(
        __import__(
            "backend.services.mirror_network.yansi_strong_curiosity_final_shadow",
            fromlist=["order_final_shadow_candidates"],
        )
    )
    assert "followerCount" not in final_src
    assert "def order_final" in final_src
    assert POLICY_VERSION == "strong_curiosity_final_shadow_v742"
    assert "followerCount" in FORBIDDEN_DIAGNOSIS_RANKING_KEYS
    assert "assistantScore" in FORBIDDEN_DIAGNOSIS_RANKING_KEYS
    assert "relationshipMap" in FORBIDDEN_DIAGNOSIS_RANKING_KEYS
    assert "ezaSnapshot" in FORBIDDEN_DIAGNOSIS_RANKING_KEYS
    final_src = inspect.getsource(
        __import__(
            "backend.services.mirror_network.yansi_strong_curiosity_final_shadow",
            fromlist=["order_final_shadow_candidates"],
        )
    )
    assert POLICY_VERSION == "strong_curiosity_final_shadow_v742"
    assert EVALUATOR_VERSION == "strong_curiosity_production_shadow_v743"
    assert SHADOW_STRATEGIES == (
        "control_input_order",
        "balanced_evidence",
        "generativity_led",
        "engagement_led",
        "evidence_stability",
    )
    assert "available_independent_family_count DESC" in PHASE73_SEMANTIC_KEYS["balanced_evidence"]


def test_live_discover_unchanged_and_does_not_import_diagnosis():
    src = inspect.getsource(discover_mod)
    router_src = inspect.getsource(mirror_router)
    assert "yansi_strong_curiosity_author_concentration_diagnosis" not in src
    assert "diagnose_strong_curiosity_author_concentration" not in src
    assert "yansi_strong_curiosity_author_concentration_diagnosis" not in router_src
    assert DEFAULT_DISCOVER_MODE == "random"
    assert parse_discover_mode(None) == "random"
    assert "published_at" in inspect.getsource(discover_mod._newest_sort_key)
    assert "Güçlü Merak şu anda kullanılamıyor." in (
        Path(__file__).resolve().parents[2]
        / "frontend"
        / "lib"
        / "eza"
        / "mirror-network"
        / "discoverCopy.ts"
    ).read_text(encoding="utf-8")


@pytest.mark.asyncio
async def test_strong_curiosity_placeholder_and_no_public_api():
    db = AsyncMock()
    with patch(
        "backend.services.mirror_network.yansi_strong_curiosity_live.is_strong_curiosity_discover_enabled",
        return_value=False,
    ), patch(
        "backend.services.mirror_network.discover.load_discover_eligible_roots",
        new=AsyncMock(return_value=[]),
    ):
        gm = await list_discover_mirrors(db, mode="strong_curiosity")
        newest = await list_discover_mirrors(db, mode="newest")
        random_mode = await list_discover_mirrors(db, mode="random", random_session="p743ciso-session")
    assert gm.items == []
    assert gm.total == 0
    assert gm.strongCuriosityReady is False
    assert newest.mode == "newest"
    assert random_mode.mode == "random"
    router_src = inspect.getsource(mirror_router)
    assert "diagnose_strong_curiosity_author_concentration" not in router_src
    assert "authorConcentrationDiagnosis" not in router_src


def test_phase6_metrics_entrypoint_unchanged():
    src = (
        Path(__file__).resolve().parents[1]
        / "services"
        / "mirror_network"
        / "yansi_metrics.py"
    ).read_text(encoding="utf-8")
    assert "authorConcentration" not in src
    assert "order_final_shadow_candidates" not in src


def test_in_memory_diagnosis_owner_label_on_reference_cohorts():
    rows = build_phase742_reference_cohorts(evaluated_at=NOW)
    roots = [
        {
            "slug": row["slug"],
            "archetype": ARCHETYPE_CYCLE[index % len(ARCHETYPE_CYCLE)],
            "index": index,
            "author_handle": AUTHOR_HANDLES[index % len(AUTHOR_HANDLES)],
            "child_slugs": [],
            "self_children": 0,
            "unique_external_child_authors": 0,
        }
        for index, row in enumerate(rows)
    ]
    mapping = {row["slug"]: row["author_handle"] for row in roots}
    report = run_in_memory_diagnosis(
        rows,
        roots=roots,
        author_by_slug=mapping,
        include_full_semantics=False,
        evaluated_at=NOW,
    )
    assert report["diagnosisVersion"] == DIAGNOSIS_VERSION
    assert report["policyMutated"] is False
    assert report["authorQuota"] == "ABSENT"
    assert report["creatorPopularityInput"] == "ABSENT"
    assert report["ezaInput"] == "ABSENT"
    owner = {row["mappingId"]: row for row in report["ownerLabelOnly"]}
    assert owner[MAP_BALANCED]["invariant"]["finalUnchanged"] is True
    assert owner[MAP_BALANCED]["invariant"]["poolUnchanged"] is True
    leaked = FORBIDDEN_DIAGNOSIS_RANKING_KEYS.intersection(_keys(report))
    assert not leaked


def test_classify_fixture_induced():
    baseline = {"distinctAuthorCount": 2, "topAuthorShare": 0.50}
    remaps = [{"distinctAuthorCount": 8, "topAuthorShare": 0.125}] * 6
    assert (
        classify_diagnosis(
            baseline_top10=baseline,
            remap_top10=remaps,
            owner_label_invariant=True,
            correlation_proven=True,
        )
        == "FIXTURE_INDUCED"
    )


def _keys(payload):
    found = set()
    if isinstance(payload, dict):
        for key, value in payload.items():
            found.add(str(key))
            found |= _keys(value)
    elif isinstance(payload, (list, tuple)):
        for item in payload:
            found |= _keys(item)
    return found
