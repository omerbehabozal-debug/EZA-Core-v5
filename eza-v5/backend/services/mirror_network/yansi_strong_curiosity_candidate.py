# -*- coding: utf-8 -*-
"""
Phase 7.2 — Güçlü Merak internal candidate model.

Candidate ≠ quality. Candidate ≠ rank.
Consumes Phase 6.3 semantics + 6.5 normalization context only.
Does not reorder Discover. Does not define weights or a composite score.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.services.mirror_network.yansi_normalization import (
    assert_no_identity_leak,
    get_yansi_normalized_signal_evidence_batch,
)
from backend.services.mirror_network.yansi_signal_semantics import FORBIDDEN_COMPOSITE_KEYS

CandidateState = Literal[
    "NOT_ELIGIBLE",
    "INSUFFICIENT_EVIDENCE",
    "CANDIDATE",
    "HISTORICAL_ONLY",
]
FamilyStatus = Literal["AVAILABLE", "PARTIAL", "UNAVAILABLE", "HISTORICAL"]

CANDIDATE_STATES = (
    "NOT_ELIGIBLE",
    "INSUFFICIENT_EVIDENCE",
    "CANDIDATE",
    "HISTORICAL_ONLY",
)
FAMILY_STATUSES = ("AVAILABLE", "PARTIAL", "UNAVAILABLE", "HISTORICAL")

# Reason code only. Not a quality cutoff and not a pool exclusion.
LOW_SAMPLE_STARTED_THRESHOLD = 3

FORBIDDEN_CANDIDATE_SCORE_KEYS = frozenset(
    {
        "score",
        "rankScore",
        "qualityScore",
        "curiosityScore",
        "priorityScore",
        "strengthScore",
        "weightedScore",
        "compositeScore",
        "popularityScore",
        *FORBIDDEN_COMPOSITE_KEYS,
    }
)

REASON_CODES = (
    "NOT_DISCOVER_ELIGIBLE",
    "NO_PHASE6_EVIDENCE",
    "NO_INDEPENDENT_EVIDENCE",
    "ATTRACTION_EVIDENCE_AVAILABLE",
    "ATTRACTION_RATE_UNAVAILABLE",
    "ENGAGEMENT_EVIDENCE_AVAILABLE",
    "GENERATIVITY_EVIDENCE_AVAILABLE",
    "EXTERNAL_CHILD_DIVERSITY_AVAILABLE",
    "LOW_SAMPLE",
    "HISTORICAL_MEASUREMENT_GAP",
    "SCOPE_INCOMPATIBLE",
    "SELF_INTERACTION_PRESENT",
    "GUEST_UNIQUE_HUMAN_UNAVAILABLE",
    "SKIP_NAVIGATIONAL_BRANCHING",
)


def _int(value: Any, default: int = 0) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return default


def _bool(value: Any) -> bool:
    return bool(value)


def _nested(payload: Any, *path: str, default: Any = None) -> Any:
    cur = payload
    for key in path:
        if not isinstance(cur, dict) or key not in cur:
            return default
        cur = cur[key]
    return cur


def _assert_no_score_fields(payload: dict[str, Any]) -> None:
    leaked = FORBIDDEN_CANDIDATE_SCORE_KEYS.intersection(_keys_lower_raw(payload))
    if leaked:
        raise RuntimeError(f"strong_curiosity_score_leak:{','.join(sorted(leaked))}")


def _keys_lower_raw(payload: Any) -> set[str]:
    found: set[str] = set()
    if isinstance(payload, dict):
        for key, value in payload.items():
            found.add(str(key))
            found |= _keys_lower_raw(value)
    elif isinstance(payload, (list, tuple)):
        for item in payload:
            found |= _keys_lower_raw(item)
    return found


def _family_attraction(context: dict[str, Any] | None) -> dict[str, Any]:
    ranking_started = _int(_nested(context, "selfInteraction", "rankingEligibleStartedCount"))
    guest_started = _int(_nested(context, "uniqueViewerEvidence", "guestStartedSessions"))
    unique_auth = _int(
        _nested(context, "uniqueViewerEvidence", "uniqueAuthenticatedStartedViewerCount")
    )
    public_started = _int(_nested(context, "sampleSizes", "started"))
    exposures = _nested(context, "exposureByContext", "counts", default={}) or {}
    exposure_total = sum(_int(v) for v in exposures.values()) if isinstance(exposures, dict) else 0
    self_started = _int(_nested(context, "selfInteraction", "authorSelfStartedSessions"))

    status: FamilyStatus = "UNAVAILABLE"
    if ranking_started >= 1:
        status = "AVAILABLE"
    elif public_started >= 1 or exposure_total >= 1:
        status = "PARTIAL"

    return {
        "status": status,
        "rankingEligibleStartedCount": ranking_started,
        "publicStartedCount": public_started,
        "authorSelfStartedSessions": self_started,
        "guestStartedSessions": guest_started,
        "uniqueAuthenticatedStartedViewerCount": unique_auth,
        "guestUniqueHumanAvailability": "UNAVAILABLE",
        "exposureByContext": dict(exposures) if isinstance(exposures, dict) else {},
        "attractionRate": None,
        "attractionRateAvailability": "UNAVAILABLE",
        "globalAttractionDenominator": False,
        "independentEvidence": ranking_started >= 1,
    }


def _family_engagement(context: dict[str, Any] | None, rate_evidence: dict[str, Any] | None) -> dict[str, Any]:
    ranking_started = _int(_nested(context, "selfInteraction", "rankingEligibleStartedCount"))
    ranking_completed = _int(_nested(context, "selfInteraction", "rankingEligibleCompletedCount"))
    public_started = _int(_nested(context, "sampleSizes", "started"))
    public_completed = _int(_nested(context, "sampleSizes", "completed"))
    selected = _nested(context, "replayLength", "selectedCount")
    completion = _nested(rate_evidence, "completion", default={}) or {}
    skip = _nested(rate_evidence, "skip", default={}) or {}

    status: FamilyStatus = "UNAVAILABLE"
    if ranking_started >= 1:
        status = "AVAILABLE"
    elif public_started >= 1:
        status = "PARTIAL"

    return {
        "status": status,
        "rankingEligibleStartedCount": ranking_started,
        "rankingEligibleCompletedCount": ranking_completed,
        "completionNumerator": _int(completion.get("numerator"), public_completed),
        "completionDenominator": _int(completion.get("denominator"), public_started),
        "completionRawRate": completion.get("rawRate"),
        "skipNumerator": _int(skip.get("numerator")),
        "skipDenominator": _int(skip.get("denominator"), public_started),
        "skipRawRate": skip.get("rawRate"),
        "skipKind": "navigational_branching",
        "skipIsDisqualifier": False,
        "selectedCount": selected,
        "independentEvidence": ranking_started >= 1,
        "denominatorAvailable": ranking_started >= 1,
    }


def _family_generativity(context: dict[str, Any] | None, rate_evidence: dict[str, Any] | None) -> dict[str, Any]:
    diversity = _nested(context, "generativityDiversity", default={}) or {}
    children = _int(diversity.get("directChildYansiCount") or _nested(context, "sampleSizes", "children"))
    external_children = _int(diversity.get("externalDirectChildYansiCount"))
    self_children = _int(diversity.get("selfAuthoredChildCount"))
    distinct_external = _int(diversity.get("distinctExternalChildAuthorCount"))
    ranking_continuations = _int(
        _nested(context, "selfInteraction", "rankingEligibleContinuationCount")
    )
    historical = _bool(_nested(context, "historicalGaps", "historicalMeasurementGap"))
    child_rate = _nested(rate_evidence, "childGenerationRateCandidate", default={}) or {}
    pub_rate = _nested(rate_evidence, "childPublicationRateCandidate", default={}) or {}

    status: FamilyStatus = "UNAVAILABLE"
    independent = external_children >= 1 or ranking_continuations >= 1
    if historical and children >= 1:
        status = "HISTORICAL"
    elif independent:
        status = "AVAILABLE"
    elif children >= 1 or _int(_nested(context, "sampleSizes", "continuation")) >= 1:
        status = "PARTIAL"

    scope_compatible = True
    if children >= 1:
        # Children are slug-level; experience denominators are version-scoped.
        scope_compatible = False

    return {
        "status": status,
        "directChildYansiCount": children,
        "selfAuthoredChildCount": self_children,
        "externalDirectChildYansiCount": external_children,
        "distinctExternalChildAuthorCount": distinct_external,
        "rankingEligibleContinuationCount": ranking_continuations,
        "childGenerationRateCandidate": {
            "numerator": _int(child_rate.get("numerator"), children),
            "denominator": _int(child_rate.get("denominator")),
            "rawRate": child_rate.get("rawRate"),
            "scopeCompatible": False if children >= 1 else child_rate.get("scopeCompatible"),
            "availability": child_rate.get("availability"),
        },
        "childPublicationRateCandidate": {
            "numerator": _int(pub_rate.get("numerator"), children),
            "denominator": _int(pub_rate.get("denominator")),
            "rawRate": pub_rate.get("rawRate"),
            "availability": pub_rate.get("availability"),
        },
        "childScope": "slug",
        "scopeCompatible": scope_compatible,
        "historicalMeasurementGap": historical,
        "independentEvidence": independent and not historical,
        "historicalEvidence": historical and children >= 1,
        "versionAttribution": diversity.get("versionAttribution") or "not_attributed",
    }


def _reason_codes(
    *,
    discover_eligible: bool,
    attraction: dict[str, Any],
    engagement: dict[str, Any],
    generativity: dict[str, Any],
    context: dict[str, Any] | None,
    has_normalized: bool,
) -> list[str]:
    reasons: list[str] = []
    if not discover_eligible:
        reasons.append("NOT_DISCOVER_ELIGIBLE")
        return reasons
    if not has_normalized:
        reasons.append("NO_PHASE6_EVIDENCE")
        return reasons
    if attraction["independentEvidence"]:
        reasons.append("ATTRACTION_EVIDENCE_AVAILABLE")
    reasons.append("ATTRACTION_RATE_UNAVAILABLE")
    if engagement["independentEvidence"]:
        reasons.append("ENGAGEMENT_EVIDENCE_AVAILABLE")
    if generativity["independentEvidence"] or generativity["historicalEvidence"]:
        reasons.append("GENERATIVITY_EVIDENCE_AVAILABLE")
    if _int(generativity["distinctExternalChildAuthorCount"]) >= 1:
        reasons.append("EXTERNAL_CHILD_DIVERSITY_AVAILABLE")
    ranking_started = _int(engagement["rankingEligibleStartedCount"])
    if 0 < ranking_started < LOW_SAMPLE_STARTED_THRESHOLD:
        reasons.append("LOW_SAMPLE")
    if generativity["historicalMeasurementGap"]:
        reasons.append("HISTORICAL_MEASUREMENT_GAP")
    if generativity["scopeCompatible"] is False:
        reasons.append("SCOPE_INCOMPATIBLE")
    self_starts = _int(_nested(context, "selfInteraction", "authorSelfStartedSessions"))
    if self_starts >= 1 or _int(generativity["selfAuthoredChildCount"]) >= 1:
        reasons.append("SELF_INTERACTION_PRESENT")
    if _int(attraction["guestStartedSessions"]) >= 1:
        reasons.append("GUEST_UNIQUE_HUMAN_UNAVAILABLE")
    if engagement["skipKind"] == "navigational_branching":
        reasons.append("SKIP_NAVIGATIONAL_BRANCHING")
    if not attraction["independentEvidence"] and not engagement["independentEvidence"] and not generativity["independentEvidence"] and not generativity["historicalEvidence"]:
        reasons.append("NO_INDEPENDENT_EVIDENCE")
    return reasons


def _candidate_state(
    *,
    discover_eligible: bool,
    attraction: dict[str, Any],
    engagement: dict[str, Any],
    generativity: dict[str, Any],
) -> CandidateState:
    if not discover_eligible:
        return "NOT_ELIGIBLE"
    if (
        attraction["independentEvidence"]
        or engagement["independentEvidence"]
        or generativity["independentEvidence"]
    ):
        return "CANDIDATE"
    if generativity["historicalEvidence"]:
        return "HISTORICAL_ONLY"
    return "INSUFFICIENT_EVIDENCE"


def _profile_bucket(state: CandidateState, attraction: dict[str, Any], engagement: dict[str, Any], generativity: dict[str, Any]) -> str | None:
    if state not in ("CANDIDATE", "HISTORICAL_ONLY"):
        return None
    eng = engagement["independentEvidence"]
    gen = generativity["independentEvidence"] or generativity["historicalEvidence"]
    att = attraction["independentEvidence"]
    if gen and not eng:
        return "generativityHeavy"
    if eng and not gen:
        return "engagementHeavy"
    if gen and eng:
        return "mixed"
    if att:
        return "attractionOnly"
    return None


def build_strong_curiosity_candidate(
    *,
    slug: str,
    journey_version: int,
    discover_eligible: bool,
    normalized_evidence: dict[str, Any] | None,
) -> dict[str, Any]:
    """
    Pure candidate profile. Extra keys on evidence (including creator popularity) are ignored.
    """
    context = (
        normalized_evidence.get("normalization")
        if isinstance(normalized_evidence, dict)
        else None
    )
    rates = (
        normalized_evidence.get("rateEvidence")
        if isinstance(normalized_evidence, dict)
        else None
    )
    semantics = (
        normalized_evidence.get("semantics")
        if isinstance(normalized_evidence, dict)
        else None
    )
    attraction = _family_attraction(context if isinstance(context, dict) else None)
    engagement = _family_engagement(
        context if isinstance(context, dict) else None,
        rates if isinstance(rates, dict) else None,
    )
    generativity = _family_generativity(
        context if isinstance(context, dict) else None,
        rates if isinstance(rates, dict) else None,
    )
    state = _candidate_state(
        discover_eligible=discover_eligible,
        attraction=attraction,
        engagement=engagement,
        generativity=generativity,
    )
    content = _nested(context, "contentContext", default={}) or {}
    unique = _nested(context, "uniqueViewerEvidence", default={}) or {}
    self_row = _nested(context, "selfInteraction", default={}) or {}
    reasons = _reason_codes(
        discover_eligible=discover_eligible,
        attraction=attraction,
        engagement=engagement,
        generativity=generativity,
        context=context if isinstance(context, dict) else None,
        has_normalized=isinstance(normalized_evidence, dict),
    )
    ranking_started = _int(engagement["rankingEligibleStartedCount"])
    payload = {
        "slug": (slug or "").strip().lower(),
        "journeyVersion": int(journey_version),
        "candidateState": state,
        "inCandidatePool": state in ("CANDIDATE", "HISTORICAL_ONLY"),
        "evidenceReadiness": {
            "attractionEvidenceAvailable": attraction["independentEvidence"],
            "engagementDenominatorAvailable": engagement["denominatorAvailable"],
            "generativityEvidenceAvailable": (
                generativity["independentEvidence"] or generativity["historicalEvidence"]
            ),
            "historicalGap": generativity["historicalMeasurementGap"],
            "scopeCompatible": generativity["scopeCompatible"],
            "independentNonSelfEvidenceAvailable": bool(
                attraction["independentEvidence"]
                or engagement["independentEvidence"]
                or generativity["independentEvidence"]
            ),
            "guestUniqueHumanAvailable": False,
        },
        "attractionEvidence": attraction,
        "engagementEvidence": engagement,
        "generativityEvidence": generativity,
        "normalizationContext": {
            "ageContext": _nested(context, "ageContext"),
            "selectedCount": _nested(context, "replayLength", "selectedCount"),
            "language": content.get("language") if isinstance(content, dict) else None,
            "languageAvailability": (
                content.get("languageAvailability") if isinstance(content, dict) else "UNAVAILABLE"
            ),
            "topicCategory": content.get("topicCategory") if isinstance(content, dict) else None,
            "topicAvailability": (
                content.get("topicAvailability") if isinstance(content, dict) else "UNAVAILABLE"
            ),
            "regionAvailability": "UNAVAILABLE",
            "region": None,
        },
        "selfInteraction": {
            "authorSelfStartedSessions": _int(self_row.get("authorSelfStartedSessions")),
            "rankingEligibleStartedCount": _int(self_row.get("rankingEligibleStartedCount")),
            "rankingEligibleCompletedCount": _int(self_row.get("rankingEligibleCompletedCount")),
            "repeatAuthenticatedUsersNotAutoDeduped": True,
        },
        "uniqueViewerEvidence": {
            "sessionCount": _int(_nested(context, "sampleSizes", "started")),
            "uniqueAuthenticatedStartedViewerCount": _int(
                unique.get("uniqueAuthenticatedStartedViewerCount")
            ),
            "guestStartedSessions": _int(unique.get("guestStartedSessions")),
            "guestUniqueHumanAvailability": "UNAVAILABLE",
        },
        "scopeWarnings": (
            ["SCOPE_INCOMPATIBLE"] if generativity["scopeCompatible"] is False else []
        ),
        "reasonCodes": reasons,
        "smallSample": ranking_started > 0 and ranking_started < LOW_SAMPLE_STARTED_THRESHOLD,
        "profileBucket": _profile_bucket(state, attraction, engagement, generativity),
        "ranking": {
            "implemented": False,
            "weightsDefined": False,
            "formulaDefined": False,
        },
        "semanticsPresent": isinstance(semantics, dict),
    }
    _assert_no_score_fields(payload)
    if isinstance(normalized_evidence, dict):
        assert_no_identity_leak(payload)
    return payload


def summarize_strong_curiosity_pool(items: list[dict[str, Any]]) -> dict[str, Any]:
    """Internal observability. Inspection order is input order, not rank."""
    total_eligible = sum(1 for row in items if row.get("candidateState") != "NOT_ELIGIBLE")
    no_evidence = sum(1 for row in items if row.get("candidateState") == "INSUFFICIENT_EVIDENCE")
    historical = sum(1 for row in items if row.get("candidateState") == "HISTORICAL_ONLY")
    candidates = sum(1 for row in items if row.get("candidateState") == "CANDIDATE")
    partial = sum(
        1
        for row in items
        if row.get("candidateState") == "INSUFFICIENT_EVIDENCE"
        and (
            (row.get("attractionEvidence") or {}).get("status") == "PARTIAL"
            or (row.get("engagementEvidence") or {}).get("status") == "PARTIAL"
            or (row.get("generativityEvidence") or {}).get("status") == "PARTIAL"
        )
    )
    buckets = {
        "engagementHeavy": 0,
        "generativityHeavy": 0,
        "mixed": 0,
        "attractionOnly": 0,
    }
    for row in items:
        bucket = row.get("profileBucket")
        if bucket in buckets:
            buckets[bucket] += 1
    summary = {
        "totalEligible": total_eligible,
        "noEvidence": no_evidence,
        "partialEvidence": partial,
        "candidateCount": candidates,
        "historicalOnlyCount": historical,
        "poolCount": candidates + historical,
        "familyCoverage": buckets,
        "allThreeRequired": False,
        "ordered": False,
    }
    _assert_no_score_fields(summary)
    return summary


async def evaluate_strong_curiosity_candidates_batch(
    db: AsyncSession,
    items: list[tuple[str, int]],
    *,
    discover_eligible: Optional[set[tuple[str, int]]] = None,
    evaluated_at: Any = None,
) -> list[dict[str, Any]]:
    """
    Shadow evaluation. One Phase 6.5 batch for the page/set.
    Does not sort. Does not write ranking state.
    """
    pairs: list[tuple[str, int]] = []
    seen: set[tuple[str, int]] = set()
    for slug, version in items:
        key = ((slug or "").strip().lower(), int(version or 0))
        if not key[0] or key[1] < 1 or key in seen:
            continue
        seen.add(key)
        pairs.append(key)
    evidence = await get_yansi_normalized_signal_evidence_batch(
        db, pairs, evaluated_at=evaluated_at
    )
    out: list[dict[str, Any]] = []
    for slug, version in pairs:
        eligible = True if discover_eligible is None else (slug, version) in discover_eligible
        out.append(
            build_strong_curiosity_candidate(
                slug=slug,
                journey_version=version,
                discover_eligible=eligible,
                normalized_evidence=evidence.get((slug, version)),
            )
        )
    return out


async def evaluate_discover_strong_curiosity_pool(
    db: AsyncSession,
    *,
    evaluated_at: Any = None,
) -> dict[str, Any]:
    """
    Internal/shadow path over the Phase 7.1 root Discover pool.
    Never called by public Discover listing.
    """
    from backend.services.mirror_network.discover import load_discover_eligible_roots

    eligible_nodes = await load_discover_eligible_roots(db)
    pairs = [
        (
            (node.slug or "").strip().lower(),
            int(getattr(node, "journey_version", None) or 1),
        )
        for node, _ in eligible_nodes
    ]
    eligible_set = set(pairs)
    profiles = await evaluate_strong_curiosity_candidates_batch(
        db,
        pairs,
        discover_eligible=eligible_set,
        evaluated_at=evaluated_at,
    )
    summary = summarize_strong_curiosity_pool(profiles)
    payload = {
        **summary,
        "items": profiles,
        "shadow": True,
        "liveRanking": False,
    }
    _assert_no_score_fields(payload)
    return payload
