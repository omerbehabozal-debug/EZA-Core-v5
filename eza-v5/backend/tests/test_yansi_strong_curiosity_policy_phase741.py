# -*- coding: utf-8 -*-
"""Phase 7.4.1 — Güçlü Merak strategy selection contract (internal only)."""

from __future__ import annotations

import copy
import inspect
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from backend.core.schemas.mirror_network import DiscoverMirrorListResponse
from backend.routers import mirror_network as mirror_router
from backend.services.mirror_network import discover as discover_mod
from backend.services.mirror_network.discover import (
    DEFAULT_DISCOVER_MODE,
    list_discover_mirrors,
)
from backend.services.mirror_network.yansi_metrics import PUBLIC_METRIC_KEYS
from backend.services.mirror_network import yansi_strong_curiosity_policy as policy_mod
from backend.services.mirror_network import yansi_strong_curiosity_shadow as shadow_mod
from backend.services.mirror_network.yansi_strong_curiosity_candidate import (
    LOW_SAMPLE_STARTED_THRESHOLD,
)
from backend.services.mirror_network.yansi_strong_curiosity_shadow import SHADOW_STRATEGIES
from backend.services.mirror_network.yansi_strong_curiosity_evaluation import (
    evaluate_strong_curiosity_shadow,
)
from backend.services.mirror_network.yansi_strong_curiosity_policy import (
    FORBIDDEN_POLICY_INPUTS,
    FORBIDDEN_POLICY_SCORE_KEYS,
    KNOWN_STRATEGIES,
    PHASE74_FINDINGS,
    PHASE742_READINESS_REQUIREMENTS,
    StrongCuriosityPolicyError,
    build_strong_curiosity_selection_policy,
    validate_strong_curiosity_selection_policy,
)


NOW = datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc)


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


def test_policy_builds_deterministically():
    a = build_strong_curiosity_selection_policy()
    b = build_strong_curiosity_selection_policy()
    assert a == b
    assert a["liveRanking"] is False
    assert a["automaticWinner"] is False
    assert a["rankingWinner"] is None
    assert a["roleSelection"] is True


def test_strategy_roles_match_741_contract():
    policy = build_strong_curiosity_selection_policy()
    roles = policy["strategyRoles"]
    assert roles["balanced_evidence"] == "FOUNDATION"
    assert roles["generativity_led"] == "REPRESENTATION"
    assert roles["evidence_stability"] == "CONFIDENCE"
    assert roles["engagement_led"] == "DIAGNOSTIC"
    assert roles["control_input_order"] == "CONTROL"
    assert policy["foundationStrategy"] == "balanced_evidence"
    assert policy["representationStrategy"] == "generativity_led"
    assert policy["confidenceStrategy"] == "evidence_stability"
    assert policy["diagnosticStrategies"] == ["engagement_led"]
    assert policy["controlStrategy"] == "control_input_order"
    assert policy["engagementLedLiveEligibility"] == "INELIGIBLE_AS_SOLE_LIVE_RANKER"
    assert policy["controlClassification"] == "CONTROL_ONLY"
    assert set(KNOWN_STRATEGIES) == set(SHADOW_STRATEGIES)


def test_no_weights_or_score_fields():
    policy = build_strong_curiosity_selection_policy()
    keys = _keys(policy)
    for token in (
        "score",
        "weight",
        "weights",
        "curiosityScore",
        "qualityScore",
        "finalScore",
        "compositeScore",
        "recommendedWeight",
    ):
        assert token not in keys
        assert token in FORBIDDEN_POLICY_SCORE_KEYS
    assert policy["weightedCompositeRejected"] is True
    assert policy["rawPopularityAsQuality"] == "REJECTED"
    src = inspect.getsource(policy_mod)
    assert "0.3 *" not in src
    assert "curiosityScore =" not in src


def test_engagement_led_cannot_become_foundation():
    policy = build_strong_curiosity_selection_policy()
    bad = copy.deepcopy(policy)
    bad["strategyRoles"]["engagement_led"] = "FOUNDATION"
    bad["strategyRoles"]["balanced_evidence"] = "DIAGNOSTIC"
    bad["foundationStrategy"] = "engagement_led"
    with pytest.raises(StrongCuriosityPolicyError) as exc:
        validate_strong_curiosity_selection_policy(bad)
    assert "engagement_led_ineligible_as_foundation" in str(exc.value.reason)


def test_control_cannot_become_foundation():
    policy = build_strong_curiosity_selection_policy()
    bad = copy.deepcopy(policy)
    bad["strategyRoles"]["control_input_order"] = "FOUNDATION"
    bad["strategyRoles"]["balanced_evidence"] = "CONTROL"
    bad["foundationStrategy"] = "control_input_order"
    with pytest.raises(StrongCuriosityPolicyError) as exc:
        validate_strong_curiosity_selection_policy(bad)
    assert "control_cannot_be_foundation" in str(exc.value.reason)


def test_unknown_strategy_rejected():
    policy = build_strong_curiosity_selection_policy()
    bad = copy.deepcopy(policy)
    bad["strategyRoles"]["popularity_led"] = "FOUNDATION"
    with pytest.raises(StrongCuriosityPolicyError) as exc:
        validate_strong_curiosity_selection_policy(bad)
    assert "unknown_strategy" in str(exc.value.reason)


def test_two_foundations_rejected():
    policy = build_strong_curiosity_selection_policy()
    bad = copy.deepcopy(policy)
    bad["strategyRoles"]["generativity_led"] = "FOUNDATION"
    with pytest.raises(StrongCuriosityPolicyError) as exc:
        validate_strong_curiosity_selection_policy(bad)
    assert "foundation_must_be_exactly_one" in str(exc.value.reason)


def test_no_eza_or_creator_popularity_inputs():
    policy = build_strong_curiosity_selection_policy()
    src = inspect.getsource(policy_mod)
    for token in FORBIDDEN_POLICY_INPUTS:
        assert token in policy["forbiddenInputs"]
        assert token not in policy["strategyRoles"]
    assert "assistantScore" in src
    payload = copy.deepcopy(policy)
    payload["followers"] = 99
    with pytest.raises(StrongCuriosityPolicyError):
        validate_strong_curiosity_selection_policy(payload)
    payload = copy.deepcopy(policy)
    payload["assistantScore"] = 12
    with pytest.raises(StrongCuriosityPolicyError):
        validate_strong_curiosity_selection_policy(payload)


def test_historical_new_guest_scope_skip_selected_age_contracts():
    policy = build_strong_curiosity_selection_policy()
    hist = policy["historicalPolicy"]
    assert hist["discardForbidden"] is True
    assert hist["fakeConversionRateForbidden"] is True
    assert hist["retainHistoricalGapSemantics"] is True
    new = policy["newYansiPolicy"]
    assert new["state"] == "INSUFFICIENT_EVIDENCE"
    assert new["notLowQuality"] is True
    assert new["freshnessBoostForbidden"] is True
    guest = policy["guestLimitation"]
    assert guest["guestUniqueHuman"] == "UNAVAILABLE"
    assert guest["fingerprinting"] is False
    assert guest["doNotPenalizeGuestsForMissingUniqueness"] is True
    assert policy["scopePolicy"]["experience"] == "slug+journeyVersion"
    assert policy["scopePolicy"]["generativity"] == "slug"
    assert policy["scopePolicy"]["versionSpecificChildAttributionForbidden"] is True
    assert policy["skipPolicy"]["penaltyForbidden"] is True
    assert policy["skipPolicy"]["kind"] == "navigational_branching"
    assert policy["selectedCountPolicy"]["completionCorrectionForbidden"] is True
    assert policy["agePolicy"]["decayForbidden"] is True
    assert policy["agePolicy"]["freshnessBoostForbidden"] is True
    assert policy["generativityRepresentation"]["quotaPercent"] is None
    assert policy["generativityRepresentation"]["alwaysFirstForbidden"] is True


def test_default_discover_remains_random_and_modes_separated():
    policy = build_strong_curiosity_selection_policy()
    assert policy["defaultDiscoverMode"] == "random"
    assert DEFAULT_DISCOVER_MODE == "random"
    assert "no Strong Curiosity signals" in policy["productModes"]["random"]
    assert "no Strong Curiosity signals" in policy["productModes"]["newest"]
    assert policy["liveRanking"] is False
    assert policy["limitedLiveExperiment"] == "NO-GO"
    assert PHASE74_FINDINGS["limitedLiveExperiment"] == "NO-GO"
    assert policy["phase742Readiness"]["allPassed"] is False
    assert policy["phase742Readiness"]["evaluatedAgainstCombinedPolicy"] is False
    assert set(PHASE742_READINESS_REQUIREMENTS) == set(
        policy["phase742Readiness"]["requirements"]
    )


def test_phase73_comparators_unchanged_and_phase6_metrics():
    assert SHADOW_STRATEGIES == (
        "control_input_order",
        "balanced_evidence",
        "generativity_led",
        "engagement_led",
        "evidence_stability",
    )
    assert "_available_family_count" in inspect.getsource(shadow_mod._balanced_key)
    assert "distinctExternalChildAuthorCount" in inspect.getsource(shadow_mod._generativity_key)
    assert "_ranking_completion" in inspect.getsource(shadow_mod._engagement_key)
    assert LOW_SAMPLE_STARTED_THRESHOLD == 3
    assert PUBLIC_METRIC_KEYS[:3] == ("slug", "journeyVersion", "experienceStartedCount")
    assert "from backend.services.mirror_network.discover" not in inspect.getsource(
        policy_mod
    )


def test_phase74_evaluation_still_runs():
    result = evaluate_strong_curiosity_shadow(evaluated_at=NOW)
    pop = {row["strategy"]: row["verdict"] for row in result["popularityDependence"]}
    assert pop["balanced_evidence"] == PHASE74_FINDINGS["balanced_evidence"]
    assert pop["generativity_led"] == PHASE74_FINDINGS["generativity_led"]
    assert pop["engagement_led"] == PHASE74_FINDINGS["engagement_led"]
    assert result["automaticWinner"] is False


def test_policy_module_not_imported_by_live_discover_source():
    src = inspect.getsource(discover_mod)
    list_src = inspect.getsource(list_discover_mirrors)
    router_src = inspect.getsource(mirror_router)
    assert "yansi_strong_curiosity_policy" not in src
    assert "yansi_strong_curiosity_final_shadow" not in src
    assert "yansi_strong_curiosity_production_shadow" not in src
    assert "yansi_strong_curiosity_staging_seed" not in src
    assert "seed_strong_curiosity" not in src
    assert "build_strong_curiosity_selection_policy" not in list_src
    assert "yansi_strong_curiosity_policy" not in router_src


@pytest.mark.asyncio
async def test_live_discover_placeholder_and_ordering_unchanged():
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
        raise AssertionError("policy must not run during Discover list")

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
            "backend.services.mirror_network.yansi_strong_curiosity_policy.build_strong_curiosity_selection_policy",
            new=boom,
        ),
        patch(
            "backend.services.mirror_network.yansi_strong_curiosity_final_shadow.evaluate_strong_curiosity_final_shadow",
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
    assert DEFAULT_DISCOVER_MODE == "random"
    payload = DiscoverMirrorListResponse(items=[], total=0, mode="strong_curiosity")
    dumped = payload.model_dump()
    assert "strategyRoles" not in dumped
    assert "foundationStrategy" not in dumped
