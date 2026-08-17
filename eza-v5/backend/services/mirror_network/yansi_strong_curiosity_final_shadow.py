# -*- coding: utf-8 -*-
"""
Phase 7.4.2 — Güçlü Merak final layered shadow policy (internal only).

Applies Phase 7.4.1 roles to frozen 7.3 comparators. Does not activate live
ranking. Must not be imported by public Discover listing.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from statistics import median
from typing import Any, Sequence

from backend.services.mirror_network.discover import MAX_DISCOVER_ELIGIBLE_LOAD
from backend.services.mirror_network.yansi_strong_curiosity_evaluation import (
    NOW,
    _candidate,
    _overlay_counts,
    _pairwise_agreement,
    build_phase74_reference_cohorts,
)
from backend.services.mirror_network.yansi_strong_curiosity_policy import (
    FORBIDDEN_POLICY_SCORE_KEYS,
    PHASE742_READINESS_REQUIREMENTS,
    build_strong_curiosity_selection_policy,
)
from backend.services.mirror_network.yansi_strong_curiosity_shadow import (
    DIAGNOSTIC_TOP_K,
    FORBIDDEN_SHADOW_SCORE_KEYS,
    HIGH_VOLUME_DEPENDENCE_RATIO,
    SUBJECTIVE_LABELS,
    TIE_BREAK,
    _available_family_count,
    _historical_generativity,
    _int,
    _log1p,
    _nested,
    _ranking_completion,
    _ranking_unique_auth,
    _slug,
    _status_rank,
    order_shadow_candidates,
    pool_candidates,
    run_shadow_on_candidates,
)

POLICY_VERSION = "strong_curiosity_final_shadow_v742"
FORBIDDEN_FINAL_SCORE_KEYS = frozenset(
    {
        *FORBIDDEN_SHADOW_SCORE_KEYS,
        *FORBIDDEN_POLICY_SCORE_KEYS,
        "strongCuriosityScore",
        "curiosityScore",
        "rankScore",
    }
)
DEPENDENCE_WARNING_RATIO = HIGH_VOLUME_DEPENDENCE_RATIO
ENGAGEMENT_COMPARE_BAND = 2


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
    leaked = FORBIDDEN_FINAL_SCORE_KEYS.intersection(_keys_raw(payload))
    if leaked:
        raise RuntimeError(f"strong_curiosity_final_score_leak:{','.join(sorted(leaked))}")
    blob = str(payload)
    for label in SUBJECTIVE_LABELS + ("WINNER", "LOW_QUALITY", "TOP_QUALITY"):
        if label in blob:
            raise RuntimeError(f"strong_curiosity_final_subjective_label:{label}")


def has_credible_external_generativity(row: dict[str, Any]) -> bool:
    """
    Evidence availability, not a quality cut.

    Matches Phase 7.2 independent generativity (AVAILABLE), excluding
    HISTORICAL_ONLY so historical rows cannot floor into modern 2-family bands.
    """
    gen = row.get("generativityEvidence") or {}
    if str(gen.get("status") or "") != "AVAILABLE":
        return False
    if gen.get("historicalMeasurementGap") or row.get("candidateState") == "HISTORICAL_ONLY":
        return False
    return (
        _int(gen.get("distinctExternalChildAuthorCount")) >= 1
        or _int(gen.get("externalDirectChildYansiCount")) >= 1
        or _int(gen.get("rankingEligibleContinuationCount")) >= 1
    )


def representation_band(row: dict[str, Any]) -> int:
    """
    Structural representation, not a quota.

    Credible AVAILABLE external generativity may compete in the same band as
    two-family engagement/attraction rows so volume-only 2-family evidence
    cannot occupy the entire band. Three-family mixed rows still lead.
    Historical rows do not receive this floor.
    """
    families = _available_family_count(row)
    if has_credible_external_generativity(row):
        return max(families, ENGAGEMENT_COMPARE_BAND)
    return families


def _final_semantic_key(row: dict[str, Any]) -> tuple:
    """
    Layer B keys from frozen balanced_evidence, with Layer C replacing only
    the family-count axis by representation_band. No weighted sum.
    """
    gen = row.get("generativityEvidence") or {}
    unique_auth = _ranking_unique_auth(row)
    _num, den, raw = _ranking_completion(row)
    rate = float(raw) if raw is not None else -1.0
    return (
        -representation_band(row),
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


def order_final_shadow_candidates(
    candidates: Sequence[dict[str, Any]],
) -> list[dict[str, Any]]:
    pool = pool_candidates(candidates)
    stability = {
        _slug(row): index
        for index, row in enumerate(
            order_shadow_candidates(pool, strategy="evidence_stability"),
            start=1,
        )
    }

    def sort_key(row: dict[str, Any]) -> tuple:
        semantic = _final_semantic_key(row)
        # Layer D: confidence only after all semantic keys except slug.
        return semantic[:-1] + (stability.get(_slug(row), 10_000), semantic[-1])

    return sorted(pool, key=sort_key)


def _item_reason_codes(
    row: dict[str, Any],
    *,
    final_pos: int,
    engagement_pos: int | None,
) -> list[str]:
    codes = ["BALANCED_FOUNDATION"]
    if has_credible_external_generativity(row):
        codes.append("EXTERNAL_GENERATIVITY_REPRESENTED")
        if _int(_nested(row, "generativityEvidence", "distinctExternalChildAuthorCount")) >= 1:
            codes.append("EXTERNAL_AUTHOR_DIVERSITY")
        if _int(_nested(row, "generativityEvidence", "rankingEligibleContinuationCount")) >= 1:
            codes.append("GENERATION_WITH_CONTINUATION_SUPPORT")
    if _ranking_unique_auth(row) >= 1:
        codes.append("CONFIDENCE_CONTEXT_AVAILABLE")
    if row.get("smallSample") is True:
        codes.append("LOW_SAMPLE_CAVEAT")
    if row.get("candidateState") == "HISTORICAL_ONLY" or _nested(
        row, "generativityEvidence", "historicalMeasurementGap"
    ):
        codes.append("HISTORICAL_GAP")
    if "SCOPE_INCOMPATIBLE" in (row.get("scopeWarnings") or []) or (
        _nested(row, "generativityEvidence", "scopeCompatible") is False
    ):
        codes.append("SCOPE_INCOMPATIBLE")
    unique = _ranking_unique_auth(row)
    sessions = _int(_nested(row, "selfInteraction", "rankingEligibleStartedCount"))
    if unique == 1 and sessions > 1:
        codes.append("AUTH_CONCENTRATION")
    if engagement_pos is not None and final_pos != engagement_pos:
        codes.append("ENGAGEMENT_DIAGNOSTIC_DISAGREEMENT")
    ordered: list[str] = []
    seen: set[str] = set()
    for code in codes:
        if code not in seen:
            seen.add(code)
            ordered.append(code)
    return ordered


def _movement(foundation: dict[str, int], final: dict[str, int]) -> dict[str, Any]:
    shared = sorted(set(foundation) & set(final))
    deltas = [final[slug] - foundation[slug] for slug in shared]
    overlap = []
    for k in DIAGNOSTIC_TOP_K:
        top_f = {slug for slug, pos in foundation.items() if pos <= k}
        top_n = {slug for slug, pos in final.items() if pos <= k}
        overlap.append(
            {
                "k": k,
                "overlapCount": len(top_f & top_n),
                "onlyFoundation": sorted(top_f - top_n),
                "onlyFinal": sorted(top_n - top_f),
            }
        )
    return {
        "maxPositiveOrdinalDelta": max(deltas) if deltas else None,
        "maxNegativeOrdinalDelta": min(deltas) if deltas else None,
        "medianAbsDelta": float(median([abs(d) for d in deltas])) if deltas else None,
        "positionalLimitUsed": False,
        "arbitraryMoveBudget": False,
        "topKOverlap": overlap,
        "movedSlugs": [
            {
                "slug": slug,
                "foundationOrdinal": foundation[slug],
                "finalOrdinal": final[slug],
                "delta": final[slug] - foundation[slug],
            }
            for slug in shared
            if foundation[slug] != final[slug]
        ],
    }


def build_phase742_reference_cohorts(
    *, evaluated_at: datetime | None = None
) -> list[dict[str, Any]]:
    now = evaluated_at or NOW
    rows = build_phase74_reference_cohorts(evaluated_at=now)
    rows.append(
        _overlay_counts(
            _candidate(
                slug="smaller-external-generativity",
                started=80,
                completed=52,
                unique=30,
                children=20,
                continuations=8,
                child_authors=[f"extgen-{i}" for i in range(15)]
                + [f"extgen-{i}" for i in range(5)],
                published_at=now - timedelta(days=35),
                evaluated_at=now,
            ),
            public_started=2_000,
            public_completed=1_300,
            ranking_started=2_000,
            ranking_completed=1_300,
            unique_auth=40,
            author_self=0,
        )
    )
    for index in range(8):
        rows.append(
            _overlay_counts(
                _candidate(
                    slug=f"fill-volume-{index:02d}",
                    started=40,
                    completed=28,
                    unique=20,
                    published_at=now - timedelta(days=80),
                    evaluated_at=now,
                ),
                public_started=8_000 + index * 500,
                public_completed=5_600 + index * 300,
                ranking_started=8_000 + index * 500,
                ranking_completed=5_600 + index * 300,
                unique_auth=25,
                author_self=0,
            )
        )
    for slug, prefix in (("gen-only-alpha", "goa"), ("gen-only-bravo", "gob"), ("gen-only-charlie", "goc")):
        rows.append(
            _candidate(
                slug=slug,
                started=0,
                completed=0,
                continuations=7,
                children=8,
                child_authors=[f"{prefix}-{i}" for i in range(7)] + [f"{prefix}-0"],
                published_at=now - timedelta(days=50),
                evaluated_at=now,
            )
        )
    # Older row has the earlier slug so slug-ASC and newest-first disagree.
    rows.append(
        _candidate(
            slug="age-twin-alpha",
            started=24,
            completed=16,
            unique=16,
            published_at=now - timedelta(days=400),
            evaluated_at=now,
        )
    )
    rows.append(
        _candidate(
            slug="age-twin-zeta",
            started=24,
            completed=16,
            unique=16,
            published_at=now - timedelta(days=35),
            evaluated_at=now,
        )
    )
    return rows


def evaluate_strong_curiosity_final_shadow(
    candidates: Sequence[dict[str, Any]] | None = None,
    *,
    evaluated_at: datetime | None = None,
    corpus_cap: int = MAX_DISCOVER_ELIGIBLE_LOAD,
) -> dict[str, Any]:
    now = evaluated_at or NOW
    policy = build_strong_curiosity_selection_policy()
    rows = (
        list(candidates)
        if candidates is not None
        else build_phase742_reference_cohorts(evaluated_at=now)
    )
    pool = pool_candidates(rows)
    foundation_ordered = order_shadow_candidates(pool, strategy="balanced_evidence")
    generativity_ordered = order_shadow_candidates(pool, strategy="generativity_led")
    stability_ordered = order_shadow_candidates(pool, strategy="evidence_stability")
    engagement_ordered = order_shadow_candidates(pool, strategy="engagement_led")
    final_ordered = order_final_shadow_candidates(pool)

    foundation_pos = {_slug(row): i for i, row in enumerate(foundation_ordered, start=1)}
    gen_pos = {_slug(row): i for i, row in enumerate(generativity_ordered, start=1)}
    stab_pos = {_slug(row): i for i, row in enumerate(stability_ordered, start=1)}
    eng_pos = {_slug(row): i for i, row in enumerate(engagement_ordered, start=1)}
    final_pos = {_slug(row): i for i, row in enumerate(final_ordered, start=1)}

    ordered_out = []
    for row in final_ordered:
        slug = _slug(row)
        entry = {
            "slug": slug,
            "journeyVersion": int(row.get("journeyVersion") or 1),
            "candidateState": row.get("candidateState"),
            "ordinal": final_pos[slug],
            "foundationPosition": foundation_pos.get(slug),
            "generativityLedPosition": gen_pos.get(slug),
            "confidencePosition": stab_pos.get(slug),
            "engagementDiagnosticPosition": eng_pos.get(slug),
            "representationBand": representation_band(row),
            "availableFamilyCount": _available_family_count(row),
            "credibleExternalGenerativity": has_credible_external_generativity(row),
            "reasonCodes": _item_reason_codes(
                row,
                final_pos=final_pos[slug],
                engagement_pos=eng_pos.get(slug),
            ),
            "confidenceContext": {
                "uniqueAuthenticatedViewersExcludingAuthor": _ranking_unique_auth(row),
                "guestUniqueHuman": "UNAVAILABLE",
                "smallSample": bool(row.get("smallSample")),
            },
            "attractionRate": None,
            "historicalGap": bool(
                _nested(row, "generativityEvidence", "historicalMeasurementGap")
            ),
            "scopeIncompatible": bool(
                _nested(row, "generativityEvidence", "scopeCompatible") is False
            ),
            "tieBreak": TIE_BREAK,
        }
        _assert_no_score_fields(entry)
        ordered_out.append(entry)

    shadow = run_shadow_on_candidates(pool, corpus_cap=corpus_cap)
    by_slug = {str(row.get("slug")): row for row in pool}
    series = {
        "publicStartedCount": {
            slug: float(_int(_nested(row, "attractionEvidence", "publicStartedCount")))
            for slug, row in by_slug.items()
        },
        "rankingEligibleStartedCount": {
            slug: float(_int(_nested(row, "selfInteraction", "rankingEligibleStartedCount")))
            for slug, row in by_slug.items()
        },
        "directChildYansiCount": {
            slug: float(_int(_nested(row, "generativityEvidence", "directChildYansiCount")))
            for slug, row in by_slug.items()
        },
        "rankingEligibleCompletedCount": {
            slug: float(_int(_nested(row, "engagementEvidence", "rankingEligibleCompletedCount")))
            for slug, row in by_slug.items()
        },
        "uniqueAuthenticatedStartedViewerCount": {
            slug: float(_int(_nested(row, "uniqueViewerEvidence", "uniqueAuthenticatedStartedViewerCount")))
            for slug, row in by_slug.items()
        },
    }
    dependence = {
        name: _pairwise_agreement(final_pos, values) for name, values in series.items()
    }
    started_dep = dependence["rankingEligibleStartedCount"]
    mass_before = final_pos.get("mass-popularity", 99)
    gen_before = final_pos.get("smaller-external-generativity") or final_pos.get(
        "small-generative", 0
    )
    tiny_before = final_pos.get("tiny-perfect", 99)
    supported_before = final_pos.get("supported-engagement", 0)
    farm_before = final_pos.get("child-self-farm", 99)
    diverse_before = final_pos.get("external-diversity", 0)
    resistant = (
        gen_before < mass_before
        and supported_before < tiny_before
        and diverse_before < farm_before
        and started_dep.get("dependence") != "HIGH_MONOTONIC_DEPENDENCE"
    )
    verdict = "PROVEN RESISTANT" if resistant else (
        "DEPENDENT"
        if started_dep.get("dependence") == "HIGH_MONOTONIC_DEPENDENCE"
        else "PARTIAL"
    )

    comparison = []
    final_slugs = [item["slug"] for item in ordered_out]
    for result in shadow.get("results") or []:
        other = [item["slug"] for item in result.get("orderedCandidates") or []]
        k_block = []
        for k in (10, 20):
            k_block.append(
                {
                    "k": k,
                    "overlapCount": len(set(final_slugs[:k]) & set(other[:k])),
                }
            )
        comparison.append(
            {
                "strategy": result["strategy"],
                "topK": k_block,
                "identicalOrder": other == final_slugs,
            }
        )

    visible_k = min(10, len(ordered_out))
    visible = ordered_out[:visible_k]
    gen_in_visible = sum(1 for item in visible if item["credibleExternalGenerativity"])
    gen_total = sum(1 for item in ordered_out if item["credibleExternalGenerativity"])

    payload = {
        "policyVersion": POLICY_VERSION,
        "evaluatedAt": now.isoformat(),
        "liveRanking": False,
        "public": False,
        "automaticWinner": False,
        "corpusBound": True,
        "corpusCap": int(corpus_cap),
        "poolCount": len(pool),
        "inputCount": len(rows),
        "insufficientEvidenceCount": sum(
            1 for row in rows if row.get("candidateState") == "INSUFFICIENT_EVIDENCE"
        ),
        "roles": policy["strategyRoles"],
        "layeredContract": policy["layeredContract"],
        "quotaPercent": None,
        "weightedCompositeRejected": True,
        "orderedCandidates": ordered_out,
        "movement": _movement(foundation_pos, final_pos),
        "popularityDependence": dependence,
        "rawPopularityDominance": verdict,
        "strategyComparison": comparison,
        "generativityRepresentation": {
            "mechanism": "representation_band_floor_for_available_external_generativity",
            "quotaPercent": None,
            "visibleK": visible_k,
            "generativeInVisibleTop": gen_in_visible,
            "generativeInPool": gen_total,
            "systematicallyBuried": bool(gen_total and visible_k >= 3 and gen_in_visible == 0),
        },
        "guestLimitation": {
            "guestUniqueHuman": "UNAVAILABLE",
            "fingerprinting": False,
        },
        "phase742Readiness": {
            "requirements": list(PHASE742_READINESS_REQUIREMENTS),
            "evaluatedAgainstCombinedPolicy": True,
            "limitedLiveExperiment": "NO-GO",
        },
        "limitedLiveExperiment": "NO-GO",
    }
    _assert_no_score_fields(payload)
    return payload
