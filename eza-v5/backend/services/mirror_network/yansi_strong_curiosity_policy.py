# -*- coding: utf-8 -*-
"""
Phase 7.4.1 — Güçlü Merak strategy selection contract (internal only).

Assigns ROLES to frozen Phase 7.3 shadow strategies after Phase 7.4
evaluation. This is not live ranking and not a ranking winner.

Must not be imported by public Discover listing.
Must not import Discover.
"""

from __future__ import annotations

from typing import Any, Literal, Mapping

KNOWN_STRATEGIES = (
    "control_input_order",
    "balanced_evidence",
    "generativity_led",
    "engagement_led",
    "evidence_stability",
)

StrategyId = Literal[
    "control_input_order",
    "balanced_evidence",
    "generativity_led",
    "engagement_led",
    "evidence_stability",
]

STRATEGY_ROLES = (
    "FOUNDATION",
    "REPRESENTATION",
    "CONFIDENCE",
    "DIAGNOSTIC",
    "CONTROL",
)

StrategyRole = Literal[
    "FOUNDATION",
    "REPRESENTATION",
    "CONFIDENCE",
    "DIAGNOSTIC",
    "CONTROL",
]

FORBIDDEN_POLICY_SCORE_KEYS = frozenset(
    {
        "score",
        "rankScore",
        "qualityScore",
        "curiosityScore",
        "weightedScore",
        "compositeScore",
        "finalScore",
        "popularityScore",
        "winnerScore",
        "recommendedWeight",
        "weight",
        "weights",
    }
)

FORBIDDEN_POLICY_INPUTS = (
    "eza",
    "assistantScore",
    "userScore",
    "relationshipMap",
    "followers",
    "profileViews",
    "creatorTotalYansilar",
    "creatorReputation",
    "accountAge",
    "paidStatus",
    "embeddings",
    "collaborativeFiltering",
    "viewerId",
    "localePreference",
    "chatHistory",
)

SUBJECTIVE_LABELS = ("BEST", "BORING", "VIRAL", "HIGH_QUALITY")

# Frozen Phase 7.4 evidence this contract consumes. Not re-computed here.
PHASE74_FINDINGS = {
    "balanced_evidence": "PROVEN RESISTANT",
    "generativity_led": "PROVEN RESISTANT",
    "engagement_led": "DEPENDENT",
    "evidence_stability": "PARTIAL",
    "control_input_order": "NOT ENOUGH EVIDENCE",
    "rawPopularityDominanceGlobal": "PARTIAL",
    "smallSampleSafety": "PROVEN",
    "selfPlaySafety": "PROVEN",
    "generativityDiversity": "PROVEN",
    "historicalNewnessFairness": "PROVEN",
    "ezaInput": "ABSENT",
    "creatorPopularityInput": "ABSENT",
    "limitedLiveExperiment": "NO-GO",
}

PHASE742_READINESS_REQUIREMENTS = (
    "raw_popularity_resistance",
    "generativity_representation",
    "small_sample_safety",
    "self_play_invariance",
    "auth_concentration",
    "historical_newness_asymmetry",
    "guest_limitation_disclosure",
    "deterministic_ordering",
    "mode_isolation",
    "corpus_scale_behavior",
)


class StrongCuriosityPolicyError(ValueError):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def _keys_raw(payload: Any) -> set[str]:
    found: set[str] = set()
    if isinstance(payload, dict):
        for key, value in payload.items():
            found.add(str(key))
            found |= _keys_raw(value)
    elif isinstance(payload, (list, tuple)):
        for item in payload:
            found |= _keys_raw(item)
    return found


def _assert_no_score_fields(payload: Mapping[str, Any]) -> None:
    leaked = FORBIDDEN_POLICY_SCORE_KEYS.intersection(_keys_raw(payload))
    if leaked:
        raise StrongCuriosityPolicyError(
            f"policy_score_leak:{','.join(sorted(leaked))}"
        )
    blob = str(payload)
    for label in SUBJECTIVE_LABELS:
        if label in blob:
            raise StrongCuriosityPolicyError(f"policy_subjective_label:{label}")
    for token in FORBIDDEN_POLICY_INPUTS:
        if token in payload:
            raise StrongCuriosityPolicyError(f"policy_forbidden_input:{token}")


def _role_map(policy: Mapping[str, Any]) -> dict[str, str]:
    return dict(policy.get("strategyRoles") or {})


def validate_strong_curiosity_selection_policy(
    policy: Mapping[str, Any],
) -> dict[str, Any]:
    """Guardrail contract. Does not rank."""
    if not isinstance(policy, Mapping):
        raise StrongCuriosityPolicyError("policy_not_mapping")
    _assert_no_score_fields(policy)

    roles = _role_map(policy)
    unknown = set(roles) - set(KNOWN_STRATEGIES)
    if unknown:
        raise StrongCuriosityPolicyError(
            f"unknown_strategy:{','.join(sorted(unknown))}"
        )
    missing = set(KNOWN_STRATEGIES) - set(roles)
    if missing:
        raise StrongCuriosityPolicyError(
            f"unassigned_strategy:{','.join(sorted(missing))}"
        )
    invalid_roles = set(roles.values()) - set(STRATEGY_ROLES)
    if invalid_roles:
        raise StrongCuriosityPolicyError(
            f"unknown_role:{','.join(sorted(invalid_roles))}"
        )

    foundations = [sid for sid, role in roles.items() if role == "FOUNDATION"]
    if len(foundations) != 1:
        raise StrongCuriosityPolicyError("foundation_must_be_exactly_one")
    foundation = foundations[0]
    if foundation == "control_input_order":
        raise StrongCuriosityPolicyError("control_cannot_be_foundation")
    if foundation == "engagement_led":
        raise StrongCuriosityPolicyError("engagement_led_ineligible_as_foundation")
    if policy.get("foundationStrategy") != foundation:
        raise StrongCuriosityPolicyError("foundation_field_mismatch")

    if roles.get("control_input_order") != "CONTROL":
        raise StrongCuriosityPolicyError("control_must_remain_control")
    if roles.get("engagement_led") != "DIAGNOSTIC":
        raise StrongCuriosityPolicyError("engagement_led_must_remain_diagnostic")
    if policy.get("engagementLedLiveEligibility") != "INELIGIBLE_AS_SOLE_LIVE_RANKER":
        raise StrongCuriosityPolicyError(
            "engagement_led_must_be_ineligible_as_sole_live_ranker"
        )
    if policy.get("controlStrategy") != "control_input_order":
        raise StrongCuriosityPolicyError("control_field_mismatch")
    if policy.get("liveRanking") is not False:
        raise StrongCuriosityPolicyError("live_ranking_must_be_false")
    if policy.get("automaticWinner") is not False:
        raise StrongCuriosityPolicyError("automatic_winner_forbidden")
    if policy.get("limitedLiveExperiment") != "NO-GO":
        raise StrongCuriosityPolicyError("limited_live_experiment_remains_no_go")
    if policy.get("defaultDiscoverMode") != "random":
        raise StrongCuriosityPolicyError("default_discover_must_remain_random")
    if policy.get("generativityQuotaPercent") is not None:
        raise StrongCuriosityPolicyError("generativity_quota_forbidden")
    return dict(policy)


def build_strong_curiosity_selection_policy() -> dict[str, Any]:
    """
    Deterministic role contract. Not a ranking execution.
    balanced_evidence is the foundation candidate, not a declared winner.
    """
    payload: dict[str, Any] = {
        "contractVersion": "strong_curiosity_selection_policy_v741",
        "liveRanking": False,
        "public": False,
        "automaticWinner": False,
        "roleSelection": True,
        "rankingWinner": None,
        "limitedLiveExperiment": "NO-GO",
        "defaultDiscoverMode": "random",
        "candidateEligibility": "phase72_strong_curiosity_pool",
        "foundationStrategy": "balanced_evidence",
        "representationStrategy": "generativity_led",
        "confidenceStrategy": "evidence_stability",
        "diagnosticStrategies": ["engagement_led"],
        "controlStrategy": "control_input_order",
        "excludedStrategies": [],
        "engagementLedLiveEligibility": "INELIGIBLE_AS_SOLE_LIVE_RANKER",
        "controlClassification": "CONTROL_ONLY",
        "strategyRoles": {
            "balanced_evidence": "FOUNDATION",
            "generativity_led": "REPRESENTATION",
            "evidence_stability": "CONFIDENCE",
            "engagement_led": "DIAGNOSTIC",
            "control_input_order": "CONTROL",
        },
        "layeredContract": {
            "stepA": "phase72_candidate_eligibility_unchanged",
            "stepB": "balanced_evidence_foundation",
            "stepC": "generativity_led_representation_not_always_first",
            "stepD": "evidence_stability_confidence_not_quality",
            "stepE": "engagement_led_diagnostic_only",
        },
        "weightedCompositeRejected": True,
        "rawPopularityAsQuality": "REJECTED",
        "phase74FindingsConsumed": dict(PHASE74_FINDINGS),
        "rationale": {
            "foundation": (
                "balanced_evidence is multi-family and raw-popularity resistant "
                "in Phase 7.4; it is the foundation candidate, not a ranking winner"
            ),
            "representation": (
                "generativity is biligN's distinctive lens: external curiosity "
                "propagation without collapsing to raw child count or always-first"
            ),
            "confidence": (
                "evidence_stability answers support for interpreting evidence, "
                "not whether a Yansi is better"
            ),
            "diagnostic": (
                "engagement_led showed HIGH_MONOTONIC_DEPENDENCE / DEPENDENT "
                "on start volume; keep frozen for diagnosis only"
            ),
            "control": "control_input_order is an evaluation reference, never live",
            "noWeightedScore": (
                "scopes, denominators, historical gaps, and guest uniqueness "
                "make a 0.3/0.3/0.4 composite false precision"
            ),
        },
        "productModes": {
            "random": "serendipity among eligible Yansis; no Strong Curiosity signals",
            "newest": "temporal discovery; no Strong Curiosity signals",
            "strong_curiosity": (
                "evidence-informed discovery when activated later; currently placeholder"
            ),
        },
        "generativityRepresentation": {
            "strategy": "generativity_led",
            "signals": (
                "externalDirectChildYansiCount",
                "distinctExternalChildAuthorCount",
                "rankingEligibleContinuationCount",
            ),
            "selfAuthoredDistinct": True,
            "alwaysFirstForbidden": True,
            "quotaPercent": None,
            "requirement": (
                "a future final policy must not systematically bury externally "
                "generative candidates under evidence volume or engagement"
            ),
            "phase742Testable": True,
        },
        "historicalPolicy": {
            "discardForbidden": True,
            "fakeZeroEngagementForbidden": True,
            "fakeConversionRateForbidden": True,
            "automaticPromotionForbidden": True,
            "retainHistoricalGapSemantics": True,
        },
        "newYansiPolicy": {
            "state": "INSUFFICIENT_EVIDENCE",
            "notLowQuality": True,
            "freshnessBoostForbidden": True,
            "discoveryModes": ("random", "newest"),
        },
        "guestLimitation": {
            "guestUniqueHuman": "UNAVAILABLE",
            "fingerprinting": False,
            "ipIdentity": False,
            "uaIdentity": False,
            "doNotPenalizeGuestsForMissingUniqueness": True,
            "doNotBoostAuthenticatedCreators": True,
            "unresolved": True,
        },
        "agePolicy": {
            "decayForbidden": True,
            "freshnessBoostForbidden": True,
            "penaltyForbidden": True,
            "diagnosticOnly": True,
        },
        "selectedCountPolicy": {
            "diagnosticOnly": True,
            "completionCorrectionForbidden": True,
        },
        "skipPolicy": {
            "kind": "navigational_branching",
            "penaltyForbidden": True,
        },
        "scopePolicy": {
            "experience": "slug+journeyVersion",
            "generativity": "slug",
            "versionSpecificChildAttributionForbidden": True,
            "carryScopeIncompatibility": True,
        },
        "forbiddenInputs": list(FORBIDDEN_POLICY_INPUTS),
        "unresolvedConstraints": (
            "guest_unique_human_unavailable",
            "corpus_bound_10000",
            "combined_layered_policy_unproven",
            "historical_newness_asymmetry",
            "no_limited_live_experiment",
        ),
        "phase742Readiness": {
            "requirements": list(PHASE742_READINESS_REQUIREMENTS),
            "evaluatedAgainstCombinedPolicy": False,
            "allPassed": False,
            "note": "Phase 7.4 tests do not satisfy 7.4.2 combined-policy proof",
        },
    }
    return validate_strong_curiosity_selection_policy(payload)
