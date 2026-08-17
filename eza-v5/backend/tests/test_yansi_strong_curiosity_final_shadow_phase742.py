# -*- coding: utf-8 -*-
"""Phase 7.4.2 — Güçlü Merak final layered shadow policy (internal only)."""

from __future__ import annotations

import copy
import inspect
import time
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from backend.core.schemas.mirror_network import (
    DiscoverMirrorItem,
    DiscoverMirrorListResponse,
)
from backend.routers import mirror_network as mirror_router
from backend.services.mirror_network import discover as discover_mod
from backend.services.mirror_network.discover import (
    DEFAULT_DISCOVER_MODE,
    MAX_DISCOVER_ELIGIBLE_LOAD,
    list_discover_mirrors,
)
from backend.services.mirror_network.yansi_metrics import PUBLIC_METRIC_KEYS
from backend.services.mirror_network import yansi_strong_curiosity_final_shadow as final_mod
from backend.services.mirror_network import yansi_strong_curiosity_shadow as shadow_mod
from backend.services.mirror_network.yansi_strong_curiosity_candidate import (
    LOW_SAMPLE_STARTED_THRESHOLD,
)
from backend.services.mirror_network.yansi_strong_curiosity_evaluation import (
    PHASE73_SEMANTIC_KEYS,
    _candidate,
    _overlay_counts,
    build_phase74_reference_cohorts,
    evaluate_strong_curiosity_shadow,
)
from backend.services.mirror_network.yansi_strong_curiosity_policy import (
    PHASE74_FINDINGS,
    build_strong_curiosity_selection_policy,
)
from backend.services.mirror_network.yansi_strong_curiosity_shadow import (
    SHADOW_STRATEGIES,
    order_shadow_candidates,
    pool_candidates,
)
from backend.services.mirror_network.yansi_strong_curiosity_final_shadow import (
    ENGAGEMENT_COMPARE_BAND,
    FORBIDDEN_FINAL_SCORE_KEYS,
    POLICY_VERSION,
    build_phase742_reference_cohorts,
    evaluate_strong_curiosity_final_shadow,
    has_credible_external_generativity,
    order_final_shadow_candidates,
    representation_band,
)


NOW = datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc)
ALLOWED_REASON_CODES = {
    "BALANCED_FOUNDATION",
    "EXTERNAL_GENERATIVITY_REPRESENTED",
    "EXTERNAL_AUTHOR_DIVERSITY",
    "GENERATION_WITH_CONTINUATION_SUPPORT",
    "CONFIDENCE_CONTEXT_AVAILABLE",
    "LOW_SAMPLE_CAVEAT",
    "HISTORICAL_GAP",
    "SCOPE_INCOMPATIBLE",
    "AUTH_CONCENTRATION",
    "ENGAGEMENT_DIAGNOSTIC_DISAGREEMENT",
}
FORBIDDEN_SUBJECTIVE = (
    "BEST",
    "TOP_QUALITY",
    "VIRAL",
    "BORING",
    "LOW_QUALITY",
    "WINNER",
)
EZA_V5 = Path(__file__).resolve().parents[2]


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


def _pos(result):
    return {item["slug"]: item["ordinal"] for item in result["orderedCandidates"]}


def _item(result, slug):
    return next(row for row in result["orderedCandidates"] if row["slug"] == slug)


def _by_slug(rows):
    return {str(row.get("slug")): row for row in rows}


@pytest.fixture(scope="module")
def final_result():
    return evaluate_strong_curiosity_final_shadow(evaluated_at=NOW)


@pytest.fixture(scope="module")
def cohort():
    return build_phase742_reference_cohorts(evaluated_at=NOW)


def test_frozen_input_audit_does_not_rewrite_comparators():
    policy = build_strong_curiosity_selection_policy()
    roles = policy["strategyRoles"]
    assert roles["balanced_evidence"] == "FOUNDATION"
    assert roles["generativity_led"] == "REPRESENTATION"
    assert roles["evidence_stability"] == "CONFIDENCE"
    assert roles["engagement_led"] == "DIAGNOSTIC"
    assert roles["control_input_order"] == "CONTROL"
    assert SHADOW_STRATEGIES == (
        "control_input_order",
        "balanced_evidence",
        "generativity_led",
        "engagement_led",
        "evidence_stability",
    )
    balanced_src = inspect.getsource(shadow_mod._balanced_key)
    gen_src = inspect.getsource(shadow_mod._generativity_key)
    assert "_available_family_count" in balanced_src
    assert "distinctExternalChildAuthorCount" in balanced_src
    assert "rankingEligibleStartedCount" in balanced_src
    assert "directChildYansiCount" not in gen_src.split("distinct")[0]
    assert PHASE73_SEMANTIC_KEYS["balanced_evidence"][0] == (
        "available_independent_family_count DESC"
    )
    shadow_src = inspect.getsource(shadow_mod)
    final_src = inspect.getsource(final_mod)
    assert "def _balanced_key" in shadow_src
    assert "def _balanced_key" not in final_src
    assert "def _generativity_key" not in final_src
    assert "0.3 *" not in final_src
    assert "curiosityScore =" not in final_src
    keys = _keys(evaluate_strong_curiosity_final_shadow(evaluated_at=NOW))
    assert "curiosityScore" not in keys
    assert PHASE74_FINDINGS["limitedLiveExperiment"] == "NO-GO"


def test_representation_uses_family_band_not_quota_or_generativity_led_always_first():
    assert ENGAGEMENT_COMPARE_BAND == 2
    src = inspect.getsource(final_mod.representation_band)
    assert "30" not in src
    assert "quotaPercent" not in src
    assert "at least 5" not in src
    assert inspect.getsource(final_mod).count("generativity_led") >= 1


def test_default_result_contract(final_result):
    assert final_result["policyVersion"] == POLICY_VERSION
    assert final_result["liveRanking"] is False
    assert final_result["public"] is False
    assert final_result["automaticWinner"] is False
    assert final_result["quotaPercent"] is None
    assert final_result["weightedCompositeRejected"] is True
    assert final_result["limitedLiveExperiment"] == "NO-GO"
    assert final_result["evaluatedAt"] == NOW.isoformat()
    keys = _keys(final_result)
    for token in FORBIDDEN_FINAL_SCORE_KEYS:
        assert token not in keys
    blob = str(final_result)
    for label in FORBIDDEN_SUBJECTIVE:
        assert label not in blob
    for item in final_result["orderedCandidates"]:
        assert set(item["reasonCodes"]) <= ALLOWED_REASON_CODES
        assert "BALANCED_FOUNDATION" in item["reasonCodes"]
        assert item["attractionRate"] is None
        assert "viewerId" not in item
        assert "sessionId" not in item
        assert item["confidenceContext"]["guestUniqueHuman"] == "UNAVAILABLE"


def test_candidate_pool_is_phase72_only(cohort, final_result):
    pool = pool_candidates(cohort)
    states = {row["candidateState"] for row in pool}
    assert states <= {"CANDIDATE", "HISTORICAL_ONLY"}
    new_row = _by_slug(cohort)["new-yansi"]
    assert new_row["candidateState"] == "INSUFFICIENT_EVIDENCE"
    assert new_row["inCandidatePool"] is False
    assert "new-yansi" not in _pos(final_result)
    hist = _by_slug(cohort)["historical-yansi"]
    assert hist["candidateState"] == "HISTORICAL_ONLY"
    assert hist["inCandidatePool"] is True
    assert _item(final_result, "historical-yansi")["candidateState"] == "HISTORICAL_ONLY"


def test_layer_b_foundation_preserved_when_no_generativity_floor():
    rows = [
        row
        for row in build_phase74_reference_cohorts(evaluated_at=NOW)
        if not has_credible_external_generativity(row)
        and row.get("inCandidatePool")
    ]
    foundation = [_slug_of(row) for row in order_shadow_candidates(rows, strategy="balanced_evidence")]
    final = [_slug_of(row) for row in order_final_shadow_candidates(rows)]
    assert foundation == final


def _slug_of(row):
    return str(row.get("slug") or "")


def test_pairwise_popularity_does_not_automatically_win(final_result):
    pos = _pos(final_result)
    assert pos["smaller-external-generativity"] < pos["mass-popularity"]


def test_pairwise_tiny_perfect_does_not_beat_supported(final_result):
    pos = _pos(final_result)
    assert pos["supported-engagement"] < pos["tiny-perfect"]


def test_pairwise_raw_child_count_does_not_beat_diversity(final_result):
    pos = _pos(final_result)
    assert pos["external-diversity"] < pos["child-self-farm"]


def test_pairwise_auth_concentration_is_context(final_result):
    pos = _pos(final_result)
    concentrated = _item(final_result, "auth-concentrated")
    diverse = _item(final_result, "auth-diverse")
    assert pos["auth-diverse"] < pos["auth-concentrated"]
    assert "AUTH_CONCENTRATION" in concentrated["reasonCodes"]
    assert "AUTH_CONCENTRATION" not in diverse["reasonCodes"]
    assert concentrated["confidenceContext"]["uniqueAuthenticatedViewersExcludingAuthor"] == 1
    assert diverse["confidenceContext"]["uniqueAuthenticatedViewersExcludingAuthor"] == 70


def test_pairwise_historical_has_no_fake_rates(cohort, final_result):
    hist = _by_slug(cohort)["historical-yansi"]
    engagement = hist["engagementEvidence"]
    assert engagement.get("completionRawRate") is None or engagement.get("denominatorAvailable") is False
    rates = (hist.get("engagementEvidence") or {})
    assert rates.get("completionDenominator") in (0, None)
    item = _item(final_result, "historical-yansi")
    assert "HISTORICAL_GAP" in item["reasonCodes"]
    assert item["historicalGap"] is True
    pos = _pos(final_result)
    assert pos["balanced-reference"] < pos["historical-yansi"]
    assert pos["supported-engagement"] < pos["historical-yansi"]


def test_pairwise_age_does_not_change_order():
    rows = [
        row
        for row in build_phase742_reference_cohorts(evaluated_at=NOW)
        if str(row.get("slug")) in {"age-twin-alpha", "age-twin-zeta"}
    ]
    ordered = order_final_shadow_candidates(rows)
    assert [row["slug"] for row in ordered] == ["age-twin-alpha", "age-twin-zeta"]
    age_penalized_old_first = False
    assert age_penalized_old_first is False


def test_pairwise_selected_count_6_vs_8_does_not_reorder():
    rows = [
        row
        for row in build_phase74_reference_cohorts(evaluated_at=NOW)
        if str(row.get("slug")) in {"replay-length-six", "replay-length-eight"}
    ]
    ordered = order_final_shadow_candidates(rows)
    assert [row["slug"] for row in ordered] == ["replay-length-eight", "replay-length-six"]
    six = next(row for row in rows if row["slug"] == "replay-length-six")
    eight = next(row for row in rows if row["slug"] == "replay-length-eight")
    assert six["engagementEvidence"].get("selectedCount") in (6, six.get("normalizationContext", {}).get("selectedCount"))
    src = inspect.getsource(final_mod._final_semantic_key)
    assert "selectedCount" not in src


def test_pairwise_creator_popularity_ignored():
    base = _candidate(
        slug="twin-author-aaa",
        started=24,
        completed=16,
        unique=16,
        published_at=NOW,
        evaluated_at=NOW,
    )
    famous = copy.deepcopy(base)
    famous["slug"] = "twin-author-bbb"
    famous["followers"] = 1_000_000
    famous["profileViews"] = 9_999
    famous["creatorTotalYansilar"] = 400
    famous["verified"] = True
    famous["accountAgeDays"] = 4000
    ordered = order_final_shadow_candidates([famous, base])
    assert [row["slug"] for row in ordered] == ["twin-author-aaa", "twin-author-bbb"]


def test_pairwise_eza_scores_ignored():
    base = _candidate(
        slug="twin-eza-aaa",
        started=24,
        completed=16,
        unique=16,
        published_at=NOW,
        evaluated_at=NOW,
    )
    injected = copy.deepcopy(base)
    injected["slug"] = "twin-eza-bbb"
    injected["assistantScore"] = 99
    injected["userScore"] = 99
    injected["ezaConfidence"] = 1.0
    injected["relationshipMap"] = {"nodes": 12}
    ordered = order_final_shadow_candidates([injected, base])
    assert [row["slug"] for row in ordered] == ["twin-eza-aaa", "twin-eza-bbb"]
    src = inspect.getsource(final_mod)
    assert "assistantScore" not in src
    assert "relationshipMap" not in src
    assert "followers" not in src


def test_generativity_representation_not_buried(final_result, cohort):
    by_slug = _by_slug(cohort)
    foundation = order_shadow_candidates(cohort, strategy="balanced_evidence")
    foundation_pos = {row["slug"]: i for i, row in enumerate(foundation, start=1)}
    visible = {item["slug"] for item in final_result["orderedCandidates"] if item["ordinal"] <= 10}
    gen_only = {"gen-only-alpha", "gen-only-bravo", "gen-only-charlie"}
    fill = {f"fill-volume-{i:02d}" for i in range(8)}
    assert gen_only <= {row["slug"] for row in pool_candidates(cohort)}
    assert all(representation_band(by_slug[slug]) == 2 for slug in gen_only)
    assert all(has_credible_external_generativity(by_slug[slug]) for slug in gen_only)
    assert gen_only & visible
    assert not gen_only.isdisjoint(visible)
    buried = [slug for slug in gen_only if slug not in visible]
    assert buried == []
    for slug in gen_only:
        assert foundation_pos[slug] > 10
        assert _pos(final_result)[slug] <= 10
        assert "EXTERNAL_GENERATIVITY_REPRESENTED" in _item(final_result, slug)["reasonCodes"]
        assert "EXTERNAL_AUTHOR_DIVERSITY" in _item(final_result, slug)["reasonCodes"]
    assert final_result["generativityRepresentation"]["quotaPercent"] is None
    assert final_result["generativityRepresentation"]["systematicallyBuried"] is False
    assert final_result["movement"]["positionalLimitUsed"] is False
    assert final_result["movement"]["arbitraryMoveBudget"] is False
    for slug in gen_only:
        assert _pos(final_result)[slug] > _pos(final_result)["balanced-reference"]


def test_self_play_does_not_use_public_inflated_starts(cohort, final_result):
    row = _by_slug(cohort)["self-play-heavy"]
    assert row["attractionEvidence"]["publicStartedCount"] == 500
    assert row["selfInteraction"]["rankingEligibleStartedCount"] == 50
    src = inspect.getsource(final_mod._final_semantic_key)
    assert "publicStartedCount" not in src
    pos = _pos(final_result)
    assert pos["supported-engagement"] < pos["self-play-heavy"]


def test_new_yansi_not_labelled_and_no_freshness(cohort, final_result):
    key_src = inspect.getsource(final_mod._final_semantic_key)
    assert "ageDays" not in key_src
    assert "freshness" not in key_src.lower()
    new_row = _by_slug(cohort)["new-yansi"]
    assert new_row["candidateState"] == "INSUFFICIENT_EVIDENCE"
    assert "new-yansi" not in _pos(final_result)
    blob = str(final_result)
    assert "BORING" not in blob
    assert "LOW_QUALITY" not in blob


def test_scope_incompatible_carried(final_result, cohort):
    row = _by_slug(cohort)["scope-incompatible"]
    assert row["generativityEvidence"].get("scopeCompatible") is False or "SCOPE_INCOMPATIBLE" in (
        row.get("scopeWarnings") or []
    )
    item = _item(final_result, "scope-incompatible")
    assert item["scopeIncompatible"] is True or "SCOPE_INCOMPATIBLE" in item["reasonCodes"]
    src = inspect.getsource(final_mod._final_semantic_key)
    assert "childPublicationRate" not in src


def test_skip_not_a_penalty():
    src = inspect.getsource(final_mod._final_semantic_key)
    assert "skip" not in src.lower()
    skipped = _candidate(
        slug="aaa-with-skips",
        started=80,
        completed=50,
        skipped=30,
        unique=25,
        published_at=NOW,
        evaluated_at=NOW,
    )
    no_skip = _candidate(
        slug="zzz-no-skip",
        started=80,
        completed=50,
        skipped=0,
        unique=25,
        published_at=NOW,
        evaluated_at=NOW,
    )
    ordered = order_final_shadow_candidates([no_skip, skipped])
    assert [row["slug"] for row in ordered] == ["aaa-with-skips", "zzz-no-skip"]


def test_engagement_diagnostic_does_not_override(final_result, cohort):
    engagement = order_shadow_candidates(cohort, strategy="engagement_led")
    final_slugs = [item["slug"] for item in final_result["orderedCandidates"]]
    engagement_slugs = [row["slug"] for row in engagement]
    assert final_slugs != engagement_slugs
    disagreed = [
        item for item in final_result["orderedCandidates"] if "ENGAGEMENT_DIAGNOSTIC_DISAGREEMENT" in item["reasonCodes"]
    ]
    assert disagreed
    mass = _item(final_result, "mass-popularity")
    assert mass["engagementDiagnosticPosition"] != mass["ordinal"]


def test_confidence_does_not_erase_diverse_generativity(final_result):
    pos = _pos(final_result)
    assert pos["smaller-external-generativity"] < pos["mass-popularity"]
    for slug in ("gen-only-alpha", "external-diversity"):
        item = _item(final_result, slug)
        assert item["ordinal"] < pos["mass-popularity"]
        assert item["credibleExternalGenerativity"] is True


def test_no_personalization_inputs():
    src = inspect.getsource(final_mod)
    for token in (
        "viewer history",
        "embedding",
        "collaborative",
        "followGraph",
        "demographics",
        "localePreference",
        "chatHistory",
    ):
        assert token not in src
    assert inspect.getsource(final_mod.order_final_shadow_candidates)
    assert "viewerId" not in src


def test_popularity_dependence_and_strategy_comparison(final_result):
    dep = final_result["popularityDependence"]
    assert dep["rankingEligibleStartedCount"]["dependence"] != "HIGH_MONOTONIC_DEPENDENCE"
    assert final_result["rawPopularityDominance"] == "PROVEN RESISTANT"
    by_strategy = {row["strategy"]: row for row in final_result["strategyComparison"]}
    assert set(by_strategy) == set(SHADOW_STRATEGIES)
    assert by_strategy["balanced_evidence"]["identicalOrder"] is False
    assert by_strategy["engagement_led"]["identicalOrder"] is False
    assert by_strategy["control_input_order"]["identicalOrder"] is False


def test_movement_diagnostics(final_result):
    movement = final_result["movement"]
    assert movement["maxNegativeOrdinalDelta"] is not None
    assert movement["maxPositiveOrdinalDelta"] is not None
    assert movement["medianAbsDelta"] is not None
    assert movement["positionalLimitUsed"] is False
    gen_moves = [
        row for row in movement["movedSlugs"] if str(row["slug"]).startswith("gen-only-")
    ]
    assert gen_moves
    assert all(row["delta"] < 0 for row in gen_moves)


def test_determinism_same_snapshot_and_input_order_irrelevant(cohort):
    reversed_rows = list(reversed(cohort))
    a = evaluate_strong_curiosity_final_shadow(cohort, evaluated_at=NOW)
    b = evaluate_strong_curiosity_final_shadow(reversed_rows, evaluated_at=NOW)
    assert [item["slug"] for item in a["orderedCandidates"]] == [
        item["slug"] for item in b["orderedCandidates"]
    ]
    assert a["orderedCandidates"] == b["orderedCandidates"]


def test_corpus_performance_bounds():
    base = _candidate(
        slug="perf-00000",
        started=20,
        completed=12,
        unique=8,
        published_at=NOW,
        evaluated_at=NOW,
    )

    def clone(n: int):
        rows = []
        for i in range(n):
            row = copy.deepcopy(base)
            row["slug"] = f"perf-{i:05d}"
            rows.append(row)
        return rows

    timings = {}
    for n in (100, 1_000, 10_000):
        rows = clone(n)
        started = time.perf_counter()
        ordered = order_final_shadow_candidates(rows)
        timings[n] = time.perf_counter() - started
        assert len(ordered) == n
        assert [row["slug"] for row in ordered] == [f"perf-{i:05d}" for i in range(n)]
    assert timings[10_000] < 15.0
    assert MAX_DISCOVER_ELIGIBLE_LOAD == 10_000


def test_public_api_and_ui_unchanged():
    payload = DiscoverMirrorListResponse(items=[], total=0, mode="strong_curiosity")
    dumped = payload.model_dump()
    assert dumped["strongCuriosityReady"] is False
    assert dumped["items"] == []
    assert "orderedCandidates" not in dumped
    assert "policyVersion" not in dumped
    copy_path = EZA_V5 / "frontend" / "lib" / "eza" / "mirror-network" / "discoverCopy.ts"
    text = copy_path.read_text(encoding="utf-8")
    assert "Güçlü Merak henüz hazır değil." in text
    item_fields = set(DiscoverMirrorItem.model_fields)
    assert "strongCuriosityScore" not in item_fields
    assert "reasonCodes" not in item_fields
    assert PUBLIC_METRIC_KEYS[:3] == ("slug", "journeyVersion", "experienceStartedCount")
    assert LOW_SAMPLE_STARTED_THRESHOLD == 3


def test_live_discover_source_isolation():
    src = inspect.getsource(discover_mod)
    list_src = inspect.getsource(list_discover_mirrors)
    router_src = inspect.getsource(mirror_router)
    assert "yansi_strong_curiosity_final_shadow" not in src
    assert "evaluate_strong_curiosity_final_shadow" not in list_src
    assert "order_final_shadow_candidates" not in list_src
    assert "yansi_strong_curiosity_final_shadow" not in router_src
    assert "yansi_strong_curiosity_production_shadow" not in src
    assert "yansi_strong_curiosity_production_shadow" not in router_src
    assert "yansi_strong_curiosity_staging_seed" not in src
    assert "yansi_strong_curiosity_staging_seed" not in router_src
    assert "seed_strong_curiosity" not in src
    assert DEFAULT_DISCOVER_MODE == "random"


@pytest.mark.asyncio
async def test_live_modes_unchanged_and_placeholder_empty():
    root = SimpleNamespace(
        slug="keep-me",
        parent_slug=None,
        visibility="public",
        safety_status="open",
        title="keep",
        description="",
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

    def _reset():
        db.execute = AsyncMock(
            side_effect=[
                SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [root])),
                empty,
                empty,
            ]
        )

    async def boom(*_a, **_k):
        raise AssertionError("final shadow must not run during Discover list")

    _reset()
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
            "backend.services.mirror_network.yansi_strong_curiosity_final_shadow.evaluate_strong_curiosity_final_shadow",
            new=boom,
        ),
    ):
        newest = await list_discover_mirrors(db, mode="newest", limit=10)
        _reset()
        random_a = await list_discover_mirrors(
            db, mode="random", limit=10, random_session="seed-stable-01"
        )
        _reset()
        random_b = await list_discover_mirrors(
            db, mode="random", limit=10, random_session="seed-stable-01"
        )
        gm = await list_discover_mirrors(db, mode="strong_curiosity", limit=10)

    assert [item.slug for item in newest.items] == ["keep-me"]
    assert newest.items[0].experienceStartedCount == 140
    assert newest.items[0].directChildYansiCount == 7
    assert [item.slug for item in random_a.items] == [item.slug for item in random_b.items]
    assert gm.items == []
    assert gm.total == 0
    assert gm.strongCuriosityReady is False


def test_phase73_and_74_still_evaluatable():
    shadow = order_shadow_candidates(
        build_phase74_reference_cohorts(evaluated_at=NOW),
        strategy="balanced_evidence",
    )
    assert shadow
    evaluation = evaluate_strong_curiosity_shadow(evaluated_at=NOW)
    assert evaluation["automaticWinner"] is False
    pop = {row["strategy"]: row["verdict"] for row in evaluation["popularityDependence"]}
    assert pop["balanced_evidence"] == "PROVEN RESISTANT"
    assert pop["engagement_led"] == "DEPENDENT"


def test_reference_cohorts_a_through_t_present(cohort):
    slugs = {row["slug"] for row in cohort}
    required = {
        "mass-popularity",
        "smaller-external-generativity",
        "tiny-perfect",
        "supported-engagement",
        "self-play-heavy",
        "child-self-farm",
        "external-diversity",
        "auth-concentrated",
        "auth-diverse",
        "historical-yansi",
        "new-yansi",
        "engagement-without-generativity",
        "generativity-without-strong-engagement",
        "balanced-reference",
        "skip-and-complete",
        "replay-length-six",
        "replay-length-eight",
        "age-twin-alpha",
        "age-twin-zeta",
        "scope-incompatible",
    }
    assert required <= slugs


def test_tiny_perfect_low_sample_caveat(final_result):
    tiny = _item(final_result, "tiny-perfect")
    assert tiny["confidenceContext"]["smallSample"] is True
    assert "LOW_SAMPLE_CAVEAT" in tiny["reasonCodes"]
