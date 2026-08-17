# -*- coding: utf-8 -*-
"""
Phase 7.3 — Güçlü Merak shadow ordering (internal only).

Compares explainable ordering strategies over the Phase 7.2 candidate pool.
Does not activate live Güçlü Merak. Must not be imported by public Discover sort.
"""

from __future__ import annotations

import math
from itertools import combinations
from typing import Any, Iterable, Literal, Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from backend.services.mirror_network.discover import MAX_DISCOVER_ELIGIBLE_LOAD
from backend.services.mirror_network.yansi_strong_curiosity_candidate import (
    FORBIDDEN_CANDIDATE_SCORE_KEYS,
    LOW_SAMPLE_STARTED_THRESHOLD,
    evaluate_discover_strong_curiosity_pool,
)

ShadowStrategy = Literal[
    "control_input_order",
    "balanced_evidence",
    "generativity_led",
    "engagement_led",
    "evidence_stability",
]

SHADOW_STRATEGIES: tuple[ShadowStrategy, ...] = (
    "control_input_order",
    "balanced_evidence",
    "generativity_led",
    "engagement_led",
    "evidence_stability",
)

SHADOW_STRATEGY_LABELS = {
    "control_input_order": "NEUTRAL / CONTROL",
    "balanced_evidence": "BALANCED EVIDENCE",
    "generativity_led": "GENERATIVITY-LED",
    "engagement_led": "ENGAGEMENT-LED",
    "evidence_stability": "EVIDENCE-CONFIDENCE / STABILITY",
}

FORBIDDEN_SHADOW_SCORE_KEYS = frozenset(
    {
        *FORBIDDEN_CANDIDATE_SCORE_KEYS,
        "rankScore",
        "qualityScore",
        "weightedScore",
        "curiosityScore",
        "compositeScore",
    }
)

SUBJECTIVE_LABELS = ("BEST", "BORING", "VIRAL", "HIGH_QUALITY")

FAMILY_STATUS_RANK = {
    "AVAILABLE": 3,
    "HISTORICAL": 2,
    "PARTIAL": 1,
    "UNAVAILABLE": 0,
}

DIAGNOSTIC_TOP_K = (10, 20, 50)
HIGH_VOLUME_DEPENDENCE_RATIO = 0.90
TIE_BREAK = "slug_asc"


def _int(value: Any, default: int = 0) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return default


def _nested(payload: Any, *path: str, default: Any = None) -> Any:
    cur = payload
    for key in path:
        if not isinstance(cur, dict) or key not in cur:
            return default
        cur = cur[key]
    return cur


def _status_rank(status: Any) -> int:
    return FAMILY_STATUS_RANK.get(str(status or "UNAVAILABLE"), 0)


def _log1p(value: Any) -> float:
    """Internal magnitude dampener. Never emitted as a public/score field."""
    return math.log1p(float(_int(value)))


def _ranking_completion(row: dict[str, Any]) -> tuple[int, int, float | None]:
    """Rates for ordering use ranking-eligible counts, not public self-inclusive totals."""
    eng = row.get("engagementEvidence") or {}
    den = _int(eng.get("rankingEligibleStartedCount"))
    num = _int(eng.get("rankingEligibleCompletedCount"))
    if den < 1:
        return 0, 0, None
    return num, den, float(num) / float(den)


def _ranking_unique_auth(row: dict[str, Any]) -> int:
    """Unique auth confidence excluding the author's own account when self-play exists."""
    unique = _int(
        _nested(row, "uniqueViewerEvidence", "uniqueAuthenticatedStartedViewerCount")
    )
    self_started = _int(_nested(row, "selfInteraction", "authorSelfStartedSessions"))
    if self_started >= 1 and unique >= 1:
        return unique - 1
    return unique


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


def _assert_no_score_fields(payload: dict[str, Any]) -> None:
    leaked = FORBIDDEN_SHADOW_SCORE_KEYS.intersection(_keys_raw(payload))
    if leaked:
        raise RuntimeError(f"strong_curiosity_shadow_score_leak:{','.join(sorted(leaked))}")
    blob = str(payload)
    for label in SUBJECTIVE_LABELS:
        if label in blob:
            raise RuntimeError(f"strong_curiosity_shadow_subjective_label:{label}")


def _slug(row: dict[str, Any]) -> str:
    return str(row.get("slug") or "").strip().lower()


def pool_candidates(items: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    """Phase 7.2 pool only. Input order is the control order."""
    return [row for row in items if row.get("inCandidatePool") is True]


def _family_statuses(row: dict[str, Any]) -> dict[str, str]:
    return {
        "attraction": str(_nested(row, "attractionEvidence", "status") or "UNAVAILABLE"),
        "engagement": str(_nested(row, "engagementEvidence", "status") or "UNAVAILABLE"),
        "generativity": str(_nested(row, "generativityEvidence", "status") or "UNAVAILABLE"),
    }


def _available_family_count(row: dict[str, Any]) -> int:
    statuses = _family_statuses(row)
    return sum(1 for status in statuses.values() if status == "AVAILABLE")


def _historical_generativity(row: dict[str, Any]) -> bool:
    return _family_statuses(row)["generativity"] == "HISTORICAL"


def _evidence_snapshot(row: dict[str, Any]) -> dict[str, Any]:
    attraction = row.get("attractionEvidence") or {}
    engagement = row.get("engagementEvidence") or {}
    generativity = row.get("generativityEvidence") or {}
    unique = row.get("uniqueViewerEvidence") or {}
    self_row = row.get("selfInteraction") or {}
    norm = row.get("normalizationContext") or {}
    age = norm.get("ageContext") or {}
    return {
        "attractionStatus": attraction.get("status"),
        "rankingEligibleStartedCount": _int(attraction.get("rankingEligibleStartedCount")),
        "rankingEligibleCompletedCount": _int(engagement.get("rankingEligibleCompletedCount")),
        "publicStartedCount": _int(attraction.get("publicStartedCount")),
        "attractionRate": None,
        "engagementStatus": engagement.get("status"),
        "completionNumerator": _int(engagement.get("completionNumerator")),
        "completionDenominator": _int(engagement.get("completionDenominator")),
        "completionRawRate": engagement.get("completionRawRate"),
        "skipRawRate": engagement.get("skipRawRate"),
        "skipKind": engagement.get("skipKind"),
        "selectedCount": engagement.get("selectedCount")
        if engagement.get("selectedCount") is not None
        else norm.get("selectedCount"),
        "generativityStatus": generativity.get("status"),
        "directChildYansiCount": _int(generativity.get("directChildYansiCount")),
        "selfAuthoredChildCount": _int(generativity.get("selfAuthoredChildCount")),
        "externalDirectChildYansiCount": _int(
            generativity.get("externalDirectChildYansiCount")
        ),
        "distinctExternalChildAuthorCount": _int(
            generativity.get("distinctExternalChildAuthorCount")
        ),
        "rankingEligibleContinuationCount": _int(
            generativity.get("rankingEligibleContinuationCount")
        ),
        "childGenerationRate": {
            "numerator": _int(
                _nested(generativity, "childGenerationRateCandidate", "numerator")
            ),
            "denominator": _int(
                _nested(generativity, "childGenerationRateCandidate", "denominator")
            ),
            "rawRate": _nested(generativity, "childGenerationRateCandidate", "rawRate"),
            "scopeCompatible": bool(
                _nested(generativity, "childGenerationRateCandidate", "scopeCompatible")
            ),
        },
        "scopeCompatible": bool(generativity.get("scopeCompatible")),
        "historicalMeasurementGap": bool(generativity.get("historicalMeasurementGap")),
        "uniqueAuthenticatedStartedViewerCount": _int(
            unique.get("uniqueAuthenticatedStartedViewerCount")
        ),
        "guestStartedSessions": _int(unique.get("guestStartedSessions")),
        "authorSelfStartedSessions": _int(self_row.get("authorSelfStartedSessions")),
        "rankingEligibleStartedCountSelf": _int(
            self_row.get("rankingEligibleStartedCount")
        ),
        "language": norm.get("language"),
        "topicCategory": norm.get("topicCategory"),
        "ageDays": age.get("ageDays") if isinstance(age, dict) else None,
        "region": None,
    }


def _item_reason_codes(row: dict[str, Any], strategy: ShadowStrategy) -> list[str]:
    codes: list[str] = []
    available = _available_family_count(row)
    if available >= 2:
        codes.append("MULTI_FAMILY_EVIDENCE")
    statuses = _family_statuses(row)
    if statuses["generativity"] in ("AVAILABLE", "HISTORICAL"):
        if _int(_nested(row, "generativityEvidence", "distinctExternalChildAuthorCount")) >= 1:
            codes.append("EXTERNAL_GENERATIVITY")
    if statuses["engagement"] == "AVAILABLE":
        codes.append("HIGHER_ENGAGEMENT_EVIDENCE")
    if row.get("smallSample") is True:
        codes.append("LOW_SAMPLE_CAVEAT")
    if _nested(row, "generativityEvidence", "historicalMeasurementGap"):
        codes.append("HISTORICAL_GAP")
    if "SCOPE_INCOMPATIBLE" in (row.get("scopeWarnings") or []) or (
        _nested(row, "generativityEvidence", "scopeCompatible") is False
    ):
        codes.append("SCOPE_INCOMPATIBLE")
    unique_auth = _ranking_unique_auth(row)
    sessions = _int(_nested(row, "selfInteraction", "rankingEligibleStartedCount"))
    if unique_auth >= 1 and sessions > unique_auth:
        codes.append("AUTH_CONCENTRATION")
    if _int(_nested(row, "uniqueViewerEvidence", "guestStartedSessions")) >= 1:
        codes.append("GUEST_UNIQUE_HUMAN_UNAVAILABLE")
    if strategy == "control_input_order":
        codes.append("CONTROL_INPUT_ORDER")
    if statuses["attraction"] != "UNAVAILABLE":
        codes.append("ATTRACTION_RATE_UNAVAILABLE")
    if strategy == "engagement_led":
        codes.append("SKIP_NOT_PENALIZED")
    if strategy == "generativity_led" and statuses["generativity"] != "UNAVAILABLE":
        if _nested(row, "generativityEvidence", "scopeCompatible") is False:
            codes.append("NO_VERSIONED_GENERATIVITY_RATE")
        if statuses["generativity"] == "HISTORICAL":
            codes.append("HISTORICAL_RAW_GENERATIVITY")
    if strategy == "evidence_stability" and unique_auth >= 1:
        codes.append("UNIQUE_AUTH_CONFIDENCE")
    _num, den, _rate = _ranking_completion(row)
    if den >= 50:
        codes.append("GREATER_EVIDENCE_VOLUME")
    codes.append("TIE_BREAK_SLUG")
    # Keep unique and stable.
    ordered: list[str] = []
    seen: set[str] = set()
    for code in codes:
        if code not in seen:
            seen.add(code)
            ordered.append(code)
    return ordered


def _reason_summary(row: dict[str, Any], strategy: ShadowStrategy) -> str:
    statuses = _family_statuses(row)
    gen = row.get("generativityEvidence") or {}
    eng = row.get("engagementEvidence") or {}
    parts = [
        f"strategy={strategy}",
        f"state={row.get('candidateState')}",
        f"families_available={_available_family_count(row)}",
        f"attraction={statuses['attraction']}",
        f"engagement={statuses['engagement']}",
        f"generativity={statuses['generativity']}",
        (
            "completion="
            f"{_int(eng.get('completionNumerator'))}/"
            f"{_int(eng.get('completionDenominator'))}"
        ),
        f"external_children={_int(gen.get('externalDirectChildYansiCount'))}",
        f"distinct_external_authors={_int(gen.get('distinctExternalChildAuthorCount'))}",
        f"tie_break={TIE_BREAK}",
    ]
    return "; ".join(parts)


def _control_key(index: int, row: dict[str, Any]) -> tuple:
    return (index, _slug(row))


def _balanced_key(row: dict[str, Any]) -> tuple:
    """
    Lexicographic balanced contract (not a weighted average):

    1. AVAILABLE independent family count (DESC)
    2. HISTORICAL generativity present (DESC) — after available families
    3. distinct external child authors (DESC) — diversity, not raw children
    4. ranking-eligible completion denominator + rate (rate never leads; self-play excluded)
    5. unique authenticated started viewers excluding author self-play (confidence)
    6. log1p ranking-eligible starts LAST among semantic keys
    7. slug ASC
    """
    gen = row.get("generativityEvidence") or {}
    unique_auth = _ranking_unique_auth(row)
    _num, den, raw = _ranking_completion(row)
    rate = float(raw) if raw is not None else -1.0
    return (
        -_available_family_count(row),
        -1 if _historical_generativity(row) else 0,
        -_int(gen.get("distinctExternalChildAuthorCount")),
        -_int(gen.get("externalDirectChildYansiCount")),
        -_status_rank(_nested(row, "engagementEvidence", "status")),
        -_log1p(den) if den >= 1 else 0.0,
        -rate,
        -unique_auth,
        -_log1p(_nested(row, "selfInteraction", "rankingEligibleStartedCount")),
        _slug(row),
    )


def _generativity_key(row: dict[str, Any]) -> tuple:
    """
    Generativity-led. Not children DESC.

    1. generativity family status
    2. distinct external child authors
    3. external direct children
    4. ranking-eligible continuations (self-play excluded)
    5. childPublicationRate only when the stored availability is not a
       version-scoped conversion — scope-incompatible rates are ignored
    6. slug ASC
    """
    gen = row.get("generativityEvidence") or {}
    pub = gen.get("childPublicationRateCandidate") or {}
    scope_ok = bool(gen.get("scopeCompatible"))
    pub_den = _int(pub.get("denominator"))
    pub_rate = pub.get("rawRate")
    publication_available = (
        scope_ok
        and pub_den >= 1
        and isinstance(pub_rate, (int, float))
        and pub.get("availability") not in (None, "UNAVAILABLE", "SCOPE_INCOMPATIBLE")
    )
    return (
        -_status_rank(gen.get("status")),
        -_int(gen.get("distinctExternalChildAuthorCount")),
        -_int(gen.get("externalDirectChildYansiCount")),
        -_int(gen.get("rankingEligibleContinuationCount")),
        -1 if publication_available else 0,
        -float(pub_rate) if publication_available else 0.0,
        -_log1p(pub_den) if publication_available else 0.0,
        _slug(row),
    )


def _engagement_key(row: dict[str, Any]) -> tuple:
    """
    Engagement-led. Completion rate never leads.

    1. engagement family status
    2. log1p(ranking-eligible started sample used as completion denominator)
    3. ranking-eligible completion ratio only after sample support
    4. ranking-eligible completed count (damped)
    Skip is ignored. Replay length is diagnostic context, not a 6-vs-8 formula.
    """
    _num, den, raw = _ranking_completion(row)
    rate = float(raw) if raw is not None else -1.0
    return (
        -_status_rank(_nested(row, "engagementEvidence", "status")),
        -_log1p(den) if den >= 1 else 0.0,
        -rate,
        -_log1p(_nested(row, "engagementEvidence", "rankingEligibleCompletedCount")),
        _slug(row),
    )


def _stability_key(row: dict[str, Any]) -> tuple:
    """
    Evidence-confidence / stability. Not quality.

    Unique authenticated viewers are anti-gaming context, not popularity.
    Author self-play is removed from unique-auth confidence.
    Guest uniqueness remains UNAVAILABLE and is not invented.
    """
    unique_auth = _ranking_unique_auth(row)
    sample = _int(_nested(row, "selfInteraction", "rankingEligibleStartedCount"))
    return (
        -1 if unique_auth >= 1 else 0,
        -_log1p(unique_auth),
        -_log1p(sample),
        _slug(row),
    )


def _sort_key(strategy: ShadowStrategy, row: dict[str, Any], index: int) -> tuple:
    if strategy == "control_input_order":
        return _control_key(index, row)
    if strategy == "balanced_evidence":
        return _balanced_key(row)
    if strategy == "generativity_led":
        return _generativity_key(row)
    if strategy == "engagement_led":
        return _engagement_key(row)
    if strategy == "evidence_stability":
        return _stability_key(row)
    raise ValueError(f"unknown_shadow_strategy:{strategy}")


def order_shadow_candidates(
    candidates: Sequence[dict[str, Any]],
    *,
    strategy: ShadowStrategy,
) -> list[dict[str, Any]]:
    pool = pool_candidates(candidates)
    indexed = list(enumerate(pool))
    ordered = sorted(indexed, key=lambda item: _sort_key(strategy, item[1], item[0]))
    return [row for _, row in ordered]


def _ordered_entry(
    row: dict[str, Any], *, strategy: ShadowStrategy, ordinal: int
) -> dict[str, Any]:
    entry = {
        "slug": _slug(row),
        "journeyVersion": int(row.get("journeyVersion") or 1),
        "candidateState": row.get("candidateState"),
        "ordinal": ordinal,
        "reasonCodes": _item_reason_codes(row, strategy),
        "reasonSummary": _reason_summary(row, strategy),
        "evidenceSnapshot": _evidence_snapshot(row),
        "familyStatuses": _family_statuses(row),
        "tieBreak": TIE_BREAK,
        "profileBucket": row.get("profileBucket"),
        "smallSample": bool(row.get("smallSample")),
    }
    _assert_no_score_fields(entry)
    return entry


def build_shadow_result(
    candidates: Sequence[dict[str, Any]],
    *,
    strategy: ShadowStrategy,
    corpus_cap: int = MAX_DISCOVER_ELIGIBLE_LOAD,
    evaluated_count: int | None = None,
) -> dict[str, Any]:
    ordered = order_shadow_candidates(candidates, strategy=strategy)
    items = [
        _ordered_entry(row, strategy=strategy, ordinal=index)
        for index, row in enumerate(ordered, start=1)
    ]
    insufficient = sum(
        1 for row in candidates if row.get("candidateState") == "INSUFFICIENT_EVIDENCE"
    )
    not_eligible = sum(
        1 for row in candidates if row.get("candidateState") == "NOT_ELIGIBLE"
    )
    payload = {
        "strategy": strategy,
        "strategyFamily": SHADOW_STRATEGY_LABELS[strategy],
        "liveRanking": False,
        "public": False,
        "corpusBound": True,
        "corpusCap": int(corpus_cap),
        "rankedBeyondCorpus": False,
        "orderedCandidates": items,
        "diagnostics": {
            "evaluatedCount": int(
                evaluated_count if evaluated_count is not None else len(list(candidates))
            ),
            "poolCount": len(items),
            "insufficientEvidenceCount": insufficient,
            "notEligibleCount": not_eligible,
            "comparator": _comparator_contract(strategy),
            "tieBreak": TIE_BREAK,
            "log1pUsedInternally": strategy != "control_input_order",
            "log1pEmitted": False,
            "skipRateUsedAsPenalty": False,
            "attractionRateInvented": False,
            "personalization": False,
            "freshnessBoost": False,
            "agePenalty": False,
        },
    }
    _assert_no_score_fields(payload)
    return payload


def _comparator_contract(strategy: ShadowStrategy) -> list[str]:
    contracts = {
        "control_input_order": [
            "preserve_eligible_candidate_input_order",
            TIE_BREAK,
        ],
        "balanced_evidence": [
            "available_independent_family_count DESC",
            "historical_generativity_present DESC",
            "distinct_external_child_author_count DESC",
            "external_direct_child_yansi_count DESC",
            "engagement_status DESC",
            "log1p(ranking_eligible_completion_denominator) DESC",
            "ranking_eligible_completion_ratio DESC (after denominator)",
            "unique_authenticated_started_viewers_excluding_author DESC",
            "log1p(ranking_eligible_started_count) DESC (last semantic key)",
            TIE_BREAK,
        ],
        "generativity_led": [
            "generativity_family_status DESC",
            "distinct_external_child_author_count DESC",
            "external_direct_child_yansi_count DESC",
            "ranking_eligible_continuation_count DESC",
            "scope_compatible_publication_rate only if available",
            TIE_BREAK,
        ],
        "engagement_led": [
            "engagement_family_status DESC",
            "log1p(ranking_eligible_started_as_completion_denominator) DESC",
            "ranking_eligible_completion_ratio DESC (after sample support)",
            "log1p(ranking_eligible_completed_count) DESC",
            "skip ignored as navigational branching",
            TIE_BREAK,
        ],
        "evidence_stability": [
            "unique_authenticated_viewers_excluding_author present DESC",
            "log1p(unique_authenticated_started_viewers_excluding_author) DESC",
            "log1p(ranking_eligible_started_sample) DESC",
            TIE_BREAK,
        ],
    }
    return list(contracts[strategy])


def run_shadow_on_candidates(
    candidates: Sequence[dict[str, Any]],
    *,
    strategies: Sequence[ShadowStrategy] | None = None,
    top_k: Sequence[int] = DIAGNOSTIC_TOP_K,
    corpus_cap: int = MAX_DISCOVER_ELIGIBLE_LOAD,
    debug_volume: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Pure shadow runner. No I/O. No persistence.
    """
    chosen: tuple[ShadowStrategy, ...] = tuple(strategies or SHADOW_STRATEGIES)
    results = [
        build_shadow_result(
            candidates,
            strategy=strategy,
            corpus_cap=corpus_cap,
            evaluated_count=len(list(candidates)),
        )
        for strategy in chosen
    ]
    comparison = compare_shadow_strategy_results(
        results, top_k=top_k, debug_volume=debug_volume
    )
    payload = {
        "shadow": True,
        "liveRanking": False,
        "public": False,
        "corpusBound": True,
        "corpusCap": int(corpus_cap),
        "strategies": list(chosen),
        "results": results,
        "comparison": comparison,
    }
    _assert_no_score_fields(payload)
    return payload


async def run_strong_curiosity_shadow_ordering(
    db: AsyncSession,
    *,
    evaluated_at: Any = None,
    strategies: Sequence[ShadowStrategy] | None = None,
    top_k: Sequence[int] = DIAGNOSTIC_TOP_K,
) -> dict[str, Any]:
    """
    Internal batch runner over the Phase 7.1 Discover eligible corpus (capped).
    Not a public route. Not imported by list_discover_mirrors.
    """
    pool = await evaluate_discover_strong_curiosity_pool(db, evaluated_at=evaluated_at)
    return run_shadow_on_candidates(
        pool.get("items") or [],
        strategies=strategies,
        top_k=top_k,
        corpus_cap=MAX_DISCOVER_ELIGIBLE_LOAD,
    )


def _positions(result: dict[str, Any]) -> dict[str, int]:
    return {
        item["slug"]: int(item["ordinal"])
        for item in result.get("orderedCandidates") or []
    }


def _top_slugs(result: dict[str, Any], k: int) -> list[str]:
    return [item["slug"] for item in (result.get("orderedCandidates") or [])[:k]]


def _pairwise_volume_agreement(
    positions: dict[str, int], volumes: dict[str, int]
) -> dict[str, Any]:
    slugs = [slug for slug in positions if slug in volumes]
    concordant = 0
    comparable = 0
    for left, right in combinations(slugs, 2):
        delta_volume = volumes[left] - volumes[right]
        if delta_volume == 0:
            continue
        comparable += 1
        delta_pos = positions[left] - positions[right]
        # Higher volume with better (lower) ordinal is concordance with popularity.
        if (delta_volume > 0 and delta_pos < 0) or (delta_volume < 0 and delta_pos > 0):
            concordant += 1
    ratio = (concordant / comparable) if comparable else None
    dependence = "HIGH_MONOTONIC_DEPENDENCE" if (
        ratio is not None and ratio >= HIGH_VOLUME_DEPENDENCE_RATIO
    ) else "NOT_PROVEN"
    return {
        "comparablePairs": comparable,
        "concordantWithHigherVolumeFirst": concordant,
        "agreementRatio": ratio,
        "dependence": dependence,
    }


def compare_shadow_strategy_results(
    results: Sequence[dict[str, Any]],
    *,
    top_k: Sequence[int] = DIAGNOSTIC_TOP_K,
    debug_volume: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    by_strategy = {row["strategy"]: row for row in results}
    pair_rows: list[dict[str, Any]] = []
    names = [row["strategy"] for row in results]
    for left, right in combinations(names, 2):
        pos_left = _positions(by_strategy[left])
        pos_right = _positions(by_strategy[right])
        shared = sorted(set(pos_left) & set(pos_right))
        deltas = [
            {
                "slug": slug,
                "leftOrdinal": pos_left[slug],
                "rightOrdinal": pos_right[slug],
                "delta": pos_left[slug] - pos_right[slug],
            }
            for slug in shared
        ]
        k_block = []
        for k in top_k:
            top_left = set(_top_slugs(by_strategy[left], k))
            top_right = set(_top_slugs(by_strategy[right], k))
            k_block.append(
                {
                    "k": int(k),
                    "overlapCount": len(top_left & top_right),
                    "onlyLeft": sorted(top_left - top_right),
                    "onlyRight": sorted(top_right - top_left),
                }
            )
        pair_rows.append(
            {
                "left": left,
                "right": right,
                "identicalOrder": [item["slug"] for item in (by_strategy[left].get("orderedCandidates") or [])]
                == [item["slug"] for item in (by_strategy[right].get("orderedCandidates") or [])],
                "topK": k_block,
                "positionDeltas": deltas,
            }
        )

    volume_started: dict[str, int] = {}
    volume_children: dict[str, int] = {}
    volume_legacy: dict[str, int] = {}
    first = results[0] if results else None
    for item in (first.get("orderedCandidates") or [] if first else []):
        snap = item.get("evidenceSnapshot") or {}
        slug = item["slug"]
        volume_started[slug] = _int(snap.get("publicStartedCount") or snap.get("rankingEligibleStartedCount"))
        volume_children[slug] = _int(snap.get("directChildYansiCount"))
        extra = (debug_volume or {}).get(slug) or {}
        if "yansiCount" in extra:
            volume_legacy[slug] = _int(extra.get("yansiCount"))

    popularity = []
    for row in results:
        positions = _positions(row)
        popularity.append(
            {
                "strategy": row["strategy"],
                "vsRawStartedCount": _pairwise_volume_agreement(positions, volume_started),
                "vsRawDirectChildYansiCount": _pairwise_volume_agreement(
                    positions, volume_children
                ),
                "vsLegacyYansiCount": (
                    _pairwise_volume_agreement(positions, volume_legacy)
                    if volume_legacy
                    else {"availability": "UNAVAILABLE"}
                ),
            }
        )

    age_rows = []
    if first:
        ages = {
            item["slug"]: item.get("evidenceSnapshot", {}).get("ageDays")
            for item in first.get("orderedCandidates") or []
        }
        numeric_age = {
            slug: int(days)
            for slug, days in ages.items()
            if isinstance(days, (int, float))
        }
        for row in results:
            age_rows.append(
                {
                    "strategy": row["strategy"],
                    "olderVolumeBias": _pairwise_volume_agreement(
                        _positions(row), numeric_age
                    )
                    if numeric_age
                    else {"availability": "UNAVAILABLE"},
                }
            )

    payload = {
        "topKInspected": [int(k) for k in top_k],
        "liveTopK": False,
        "pairs": pair_rows,
        "popularityCorrelation": popularity,
        "ageBiasInspection": age_rows,
        "allStrategiesIdentical": bool(pair_rows)
        and all(item["identicalOrder"] for item in pair_rows),
    }
    _assert_no_score_fields(payload)
    return payload
