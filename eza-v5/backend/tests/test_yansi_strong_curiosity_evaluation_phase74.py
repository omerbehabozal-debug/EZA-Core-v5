# -*- coding: utf-8 -*-
"""Phase 7.4 — Güçlü Merak shadow evaluation (internal only)."""

from __future__ import annotations

import inspect
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from backend.core.schemas.mirror_network import DiscoverMirrorListResponse
from backend.routers import mirror_network as mirror_router
from backend.services.mirror_network import discover as discover_mod
from backend.services.mirror_network.discover import list_discover_mirrors
from backend.services.mirror_network.yansi_metrics import PUBLIC_METRIC_KEYS
from backend.services.mirror_network import yansi_strong_curiosity_evaluation as eval_mod
from backend.services.mirror_network import yansi_strong_curiosity_shadow as shadow_mod
from backend.services.mirror_network.yansi_strong_curiosity_candidate import (
    LOW_SAMPLE_STARTED_THRESHOLD,
)
from backend.services.mirror_network.yansi_strong_curiosity_shadow import (
    SHADOW_STRATEGIES,
    order_shadow_candidates,
)
from backend.services.mirror_network.yansi_strong_curiosity_evaluation import (
    DEPENDENCE_WARNING_RATIO,
    FORBIDDEN_EVAL_SCORE_KEYS,
    PHASE73_SEMANTIC_KEYS,
    build_phase74_reference_cohorts,
    evaluate_strong_curiosity_shadow,
)


NOW = datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc)
FORBIDDEN_SCORE_TOKENS = (
    "finalScore",
    "qualityScore",
    "curiosityScore",
    "winnerScore",
    "recommendedWeight",
    "compositeScore",
    "rankScore",
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


def _report_for(result, strategy):
    return next(row for row in result["strategyReports"] if row["strategy"] == strategy)


def _pair(result, pair_id):
    return next(row for row in result["pairwiseComparisons"] if row["id"] == pair_id)


def _obs(result, pair_id, strategy):
    row = _pair(result, pair_id)
    return next(item for item in row["observations"] if item["strategy"] == strategy)


@pytest.fixture(scope="module")
def evaluation():
    return evaluate_strong_curiosity_shadow(evaluated_at=NOW)


def test_deterministic_evaluation(evaluation):
    second = evaluate_strong_curiosity_shadow(evaluated_at=NOW)
    assert evaluation == second
    cohorts = build_phase74_reference_cohorts(evaluated_at=NOW)
    a = [row["slug"] for row in order_shadow_candidates(cohorts, strategy="balanced_evidence")]
    b = [row["slug"] for row in order_shadow_candidates(cohorts, strategy="balanced_evidence")]
    assert a == b


def test_phase73_semantic_keys_match_frozen_comparators():
    assert set(PHASE73_SEMANTIC_KEYS) == set(SHADOW_STRATEGIES)
    assert "_available_family_count" in inspect.getsource(shadow_mod._balanced_key)
    assert "distinctExternalChildAuthorCount" in inspect.getsource(shadow_mod._generativity_key)
    assert "_ranking_completion" in inspect.getsource(shadow_mod._engagement_key)
    assert "_ranking_unique_auth" in inspect.getsource(shadow_mod._stability_key)
    assert "0.3 *" not in inspect.getsource(shadow_mod)


def test_tiny_perfect_does_not_beat_supported_sample(evaluation):
    for strategy in ("engagement_led", "balanced_evidence", "evidence_stability"):
        row = _obs(evaluation, "tiny_perfect_vs_supported_engagement", strategy)
        assert row["leader"] == "supported-engagement"
    finding = next(
        item
        for item in evaluation["smallSampleFindings"]
        if item["strategy"] == "engagement_led"
    )
    assert finding["observedPrefersTiny"] is False


def test_mass_popularity_vs_small_generative(evaluation):
    balanced = _obs(evaluation, "mass_popularity_vs_small_generative", "balanced_evidence")
    generative = _obs(evaluation, "mass_popularity_vs_small_generative", "generativity_led")
    assert balanced["leader"] == "small-generative"
    assert generative["leader"] == "small-generative"


def test_self_play_does_not_improve_position(evaluation):
    assert evaluation["selfPlayFindings"]["available"] is True
    for row in evaluation["selfPlayFindings"]["perStrategy"]:
        assert row["improvedBySelfPlay"] is False


def test_self_farm_vs_external_diversity(evaluation):
    gen = _obs(evaluation, "self_farm_vs_external_diversity", "generativity_led")
    assert gen["leader"] == "external-diversity"
    cohorts = {row["slug"]: row for row in build_phase74_reference_cohorts(evaluated_at=NOW)}
    farm = cohorts["child-self-farm"]["generativityEvidence"]
    diverse = cohorts["external-diversity"]["generativityEvidence"]
    assert farm["directChildYansiCount"] > diverse["directChildYansiCount"]
    assert diverse["distinctExternalChildAuthorCount"] > farm["distinctExternalChildAuthorCount"]


def test_auth_concentration_detected(evaluation):
    row = _obs(evaluation, "auth_concentration_vs_diverse", "evidence_stability")
    assert row["leader"] == "auth-diverse"


def test_historical_gap_and_new_yansi_not_bad(evaluation):
    hist = evaluation["historicalGapFindings"]
    assert hist["historicalState"] == "HISTORICAL_ONLY"
    assert hist["historicalRateNull"] is True
    assert hist["newState"] == "INSUFFICIENT_EVIDENCE"
    assert hist["newInPool"] is False
    assert hist["newClassifiedAsBad"] is False
    assert hist["newQualityLabel"] is None
    assert hist["ageDecayUsed"] is False
    assert hist["freshnessBoostUsed"] is False


def test_age_only_perturbation_does_not_change_order(evaluation):
    assert evaluation["ageFindings"]["changedAnyRankingStrategy"] is False


def test_eza_and_creator_popularity_do_not_change_order():
    cohorts = build_phase74_reference_cohorts(evaluated_at=NOW)
    before = evaluate_strong_curiosity_shadow(cohorts, evaluated_at=NOW)
    for row in cohorts:
        row["assistantScore"] = 88
        row["userScore"] = 12
        row["relationshipMap"] = {"edge": 1}
        row["followers"] = 90_000
        row["profileViews"] = 12_000
        row["creatorTotalYansilar"] = 400
    after = evaluate_strong_curiosity_shadow(cohorts, evaluated_at=NOW)
    for strategy in SHADOW_STRATEGIES:
        assert _report_for(before, strategy)["topKSummaries"] == _report_for(after, strategy)[
            "topKSummaries"
        ]


def test_selected_count_and_skip_do_not_change_order(evaluation):
    assert evaluation["selectedCountFindings"]["changedAnyRankingStrategy"] is False
    assert evaluation["skipFindings"]["changedAnyRankingStrategy"] is False
    six = next(
        row
        for row in build_phase74_reference_cohorts(evaluated_at=NOW)
        if row["slug"] == "replay-length-six"
    )
    eight = next(
        row
        for row in build_phase74_reference_cohorts(evaluated_at=NOW)
        if row["slug"] == "replay-length-eight"
    )
    assert six["normalizationContext"]["selectedCount"] == 6
    assert eight["normalizationContext"]["selectedCount"] == 8


def test_scope_incompatible_rates_remain_unavailable():
    scope = next(
        row
        for row in build_phase74_reference_cohorts(evaluated_at=NOW)
        if row["slug"] == "scope-incompatible"
    )
    assert scope["generativityEvidence"]["scopeCompatible"] is False
    rate = scope["generativityEvidence"]["childGenerationRateCandidate"]
    assert rate.get("scopeCompatible") is False


def test_strategy_differentiation_and_popularity_and_family_reports(evaluation):
    diff = evaluation["strategyDifferentiation"]
    assert diff["pairs"]
    assert "averageAbsPositionDelta" in diff["pairs"][0]
    pop = {row["strategy"]: row["verdict"] for row in evaluation["popularityDependence"]}
    assert pop["control_input_order"] == "NOT ENOUGH EVIDENCE"
    assert pop["engagement_led"] in {"DEPENDENT", "PARTIAL"}
    assert pop["balanced_evidence"] in {"PROVEN RESISTANT", "PARTIAL"}
    assert pop["generativity_led"] in {"PROVEN RESISTANT", "PARTIAL"}
    assert evaluation["familyRepresentation"]
    assert evaluation["dependenceThresholdKind"] == "engineering_warning_not_quality"
    assert DEPENDENCE_WARNING_RATIO == 0.9


def test_sensitivity_trace_exists_and_is_not_a_score(evaluation):
    traces = evaluation["sensitivityFindings"]
    assert traces
    dimensions = {item["dimension"] for item in traces}
    assert "age_only" in dimensions
    assert "author_self_play_only" in dimensions
    assert "external_authors" in dimensions
    for item in traces:
        assert "score" not in item
        assert "delta" in item


def test_no_automatic_winner_or_score_fields(evaluation):
    assert evaluation["automaticWinner"] is False
    assert evaluation["recommendedLiveStrategy"] is None
    assert evaluation["limitedLiveExperiment"] == "NO-GO"
    keys = _keys(evaluation)
    for token in FORBIDDEN_SCORE_TOKENS:
        assert token not in keys
        assert token in FORBIDDEN_EVAL_SCORE_KEYS
    blob = str(evaluation)
    for label in ("BEST", "BORING", "VIRAL", "HIGH_QUALITY"):
        assert label not in blob
    src = inspect.getsource(eval_mod)
    assert "0.3 *" not in src
    assert "recommendedWeight" not in evaluation


def test_guest_limitation_reported(evaluation):
    guest = evaluation["guestLimitations"]
    assert guest["guestUniqueHuman"] == "UNAVAILABLE"
    assert guest["fingerprinting"] is False
    assert "engagement_led" in guest["strategiesUsingRankingEligibleSessionVolume"]


def test_phase72_phase73_and_phase6_semantics_frozen():
    assert LOW_SAMPLE_STARTED_THRESHOLD == 3
    assert SHADOW_STRATEGIES == (
        "control_input_order",
        "balanced_evidence",
        "generativity_led",
        "engagement_led",
        "evidence_stability",
    )
    assert PUBLIC_METRIC_KEYS[:3] == ("slug", "journeyVersion", "experienceStartedCount")
    discover_src = inspect.getsource(discover_mod.list_discover_mirrors)
    assert "items=[]" in discover_src.replace(" ", "") or "items=[]" in inspect.getsource(
        discover_mod
    )
    assert "strongCuriosityReady=False" in inspect.getsource(discover_mod.list_discover_mirrors)


@pytest.mark.asyncio
async def test_evaluation_not_used_by_live_discover():
    root = SimpleNamespace(
        slug="keep-me",
        parent_slug=None,
        visibility="public",
        safety_status="open",
        scene_image_url="https://cdn.example/a.png",
        public_payload={"publicTitle": "keep"},
        private_payload={},
        card_title="keep",
        published_at=NOW,
        created_at=NOW,
        journey_version=1,
        artifact_kind="journey_v1",
        freeze_status="frozen",
    )
    empty = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [root])),
            empty,
            empty,
        ]
    )

    async def boom(*_a, **_k):
        raise AssertionError("evaluation must not run during Discover list")

    with (
        patch(
            "backend.services.mirror_network.discover.is_replay_ready_from_loaded_child",
            return_value=True,
        ),
        patch(
            "backend.services.mirror_network.discover.is_public_discover_scene_url",
            return_value=True,
        ),
        patch(
            "backend.services.mirror_network.discover.evaluate_mirror_network_safety",
            return_value=SimpleNamespace(passed=True),
        ),
        patch(
            "backend.services.mirror_network.yansi_metrics.get_yansi_public_metrics_batch",
            new=AsyncMock(
                return_value={
                    ("keep-me", 1): {
                        "experienceStartedCount": 140,
                        "directChildYansiCount": 7,
                    }
                }
            ),
        ),
        patch(
            "backend.services.mirror_network.yansi_strong_curiosity_evaluation.evaluate_strong_curiosity_shadow",
            new=boom,
        ),
        patch(
            "backend.services.mirror_network.yansi_strong_curiosity_shadow.run_strong_curiosity_shadow_ordering",
            new=boom,
        ),
    ):
        newest = await list_discover_mirrors(db, mode="newest", limit=10)
        db.execute = AsyncMock(
            side_effect=[
                SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [root])),
                empty,
                empty,
            ]
        )
        random_a = await list_discover_mirrors(
            db, mode="random", limit=10, random_session="seed-stable-01"
        )
        db.execute = AsyncMock(
            side_effect=[
                SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [root])),
                empty,
                empty,
            ]
        )
        random_b = await list_discover_mirrors(
            db, mode="random", limit=10, random_session="seed-stable-01"
        )
        with patch(
            "backend.services.mirror_network.yansi_strong_curiosity_live.is_strong_curiosity_discover_enabled",
            return_value=False,
        ):
            gm = await list_discover_mirrors(db, mode="strong_curiosity", limit=10)

    assert [item.slug for item in newest.items] == ["keep-me"]
    assert newest.items[0].experienceStartedCount == 140
    assert newest.items[0].directChildYansiCount == 7
    assert [item.slug for item in random_a.items] == [item.slug for item in random_b.items]
    assert gm.items == []
    assert gm.total == 0
    assert gm.strongCuriosityReady is False


def test_public_contracts_and_router_isolation():
    payload = DiscoverMirrorListResponse(
        items=[], total=0, mode="strong_curiosity", strongCuriosityReady=False
    ).model_dump()
    keys = _keys(payload)
    assert "strategyReports" not in keys
    assert "pairwiseComparisons" not in keys
    assert "reasonCodes" not in keys
    router_src = inspect.getsource(mirror_router)
    discover_src = inspect.getsource(discover_mod)
    list_src = inspect.getsource(list_discover_mirrors)
    assert "yansi_strong_curiosity_evaluation" not in router_src
    assert "yansi_strong_curiosity_evaluation" not in discover_src
    assert "evaluate_strong_curiosity_shadow" not in list_src
    from backend.services.mirror_network import frozen_journey_artifact as frozen_mod

    assert "evaluate_strong_curiosity_shadow" not in inspect.getsource(frozen_mod)


def test_evaluation_does_not_touch_phase5_replay_pipeline():
    src = inspect.getsource(eval_mod)
    assert "from backend.services.mirror_network.discover import list_discover_mirrors" not in src
    assert "JourneyGenerationRecord" not in src
    assert "generate_scene" not in src
    doc = inspect.getdoc(eval_mod)
    assert doc is not None
    assert "Does not activate live ranking" in doc
