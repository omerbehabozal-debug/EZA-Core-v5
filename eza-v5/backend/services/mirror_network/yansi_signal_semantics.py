# -*- coding: utf-8 -*-
"""
Phase 6.3 — internal Yansı signal semantics (not ranking).

EZA Mirror does not optimize for views, likes, followers, or watch time
alone. It values:

  attraction   — curiosity initiation  (does this Yansı make people begin?)
  engagement   — curiosity continuation (once begun, does it hold?)
  generativity — curiosity generation  (does it cause new Yansılar?)

These families must not be collapsed into one popularity / quality number.

Phase 6.3 consumes Phase 6.1 canonical metrics. It does not re-aggregate
events, invent impression denominators, or query lineage depth.

Phase 7 may later add normalization, confidence weighting, ranking,
exploration/exploitation, freshness, and diversity. Not here.

Skip is navigational branching when a destination Yansı exists — not
drop-off, failure, or bounce. Skip and complete may coexist.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Literal, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.services.mirror_network.yansi_metrics import (
    PUBLIC_METRIC_KEYS,
    get_yansi_public_metrics,
)
from backend.services.mirror_network.yansi_exposure import count_exposures_by_context
from backend.services.mirror_network.yansi_own_continuation import (
    count_own_continuation_started,
)

Availability = Literal["AVAILABLE", "DERIVED", "UNAVAILABLE", "FUTURE", "PARTIAL"]

PRODUCT_PRINCIPLE = (
    "EZA Mirror does not optimize for views, likes, followers, or watch time "
    "alone. It values curiosity initiation, curiosity continuation, and "
    "curiosity generation."
)

PHASE_7_BOUNDARY = (
    "Phase 6.3 defines signal meaning only. Phase 7 may later decide "
    "normalization, confidence weighting, ranking, exploration/exploitation, "
    "freshness, and diversity. Those are not implemented here."
)

# Immutable meanings — Phase 7 must not casually reinterpret these.
SIGNAL_MEANINGS = {
    "experienceStartedCount": (
        "Distinct canonical STARTED sessions for exact slug + journeyVersion. "
        "Attraction evidence of beginning, not quality, popularity, or "
        "impression-normalized conversion."
    ),
    "completionRate": (
        "Share of started sessions that reached final frozen-answer reveal. "
        "Positive engagement evidence. Not THE quality score. 100% is not "
        "inherently perfect."
    ),
    "skipRate": (
        "Share of started sessions with a durable SKIPPED transition to another "
        "Yansı. Current skips are destination-backed navigational branching, "
        "not abandonment, drop-off, bounce, or a simple penalty."
    ),
    "observedAverageDepth": (
        "Milestone-observed depth across started sessions. Not average "
        "questions viewed and not average completion depth. STARTED-only "
        "sessions contribute 0; unobserved mid-replay is not invented."
    ),
    "directChildYansiCount": (
        "Eligible direct published children (slug-level, not version-scoped). "
        "High-confidence generativity evidence requiring continuation, "
        "Journey threshold, freeze, and lineage verification. Not popularity."
    ),
    "childGenerationRateCandidate": (
        "Unadjusted derived candidate: directChildYansiCount / "
        "experienceStartedCount when started > 0, else null. Not a ranking "
        "key. Statistical stability is undefined."
    ),
    "ownContinuationStarted": (
        "Generativity precursor: first NEW live user question after a verified "
        "Yansı continuation. Not CTA click, /sohbet page load, session/proof "
        "create, or frozen replay. Origin is server proof source_mirror_slug. "
        "Slug-level: proof does not pin journeyVersion."
    ),
}

ATTRACTION_INTERPRETATION = (
    "started_count_is_attraction_evidence_not_quality",
    "attraction_rate_deferred_session_units_not_reconciled",
    "do_not_reuse_landing_views_or_generic_impressions",
    "exposure_is_context_specific_not_global_denominator",
)

ENGAGEMENT_INTERPRETATION = (
    "completion_is_positive_engagement_not_quality_score",
    "skip_is_navigational_branching_not_abandonment",
    "skip_and_complete_are_non_exclusive",
    "observed_average_depth_is_milestone_observed",
    "do_not_label_skip_as_drop_off_failure_or_bounce",
)

GENERATIVITY_INTERPRETATION = (
    "direct_child_count_is_not_popularity",
    "direct_children_are_slug_level_not_version_scoped",
    "experience_signals_are_version_scoped",
    "own_continuation_started_is_first_live_question_not_sohbet_load",
    "own_continuation_is_slug_level_proof_does_not_pin_version",
    "lineage_depth_is_future_no_network_recursion",
    "descendant_count_is_not_direct_child_count",
    "author_and_eza_are_not_inputs",
)

FORBIDDEN_COMPOSITE_KEYS = frozenset(
    {
        "qualityScore",
        "curiosityScore",
        "viralScore",
        "signalScore",
        "rankScore",
        "engagementScore",
        "creatorScore",
        "viralityScore",
    }
)

FORBIDDEN_PUBLIC_LEAK_KEYS = frozenset(
    {
        "attraction",
        "engagement",
        "generativity",
        "confidence",
        "childGenerationRateCandidate",
        "childPublicationRateCandidate",
        "ownContinuationStarted",
        "ownContinuationStartedCount",
        "lineageDepth",
        *FORBIDDEN_COMPOSITE_KEYS,
    }
)

SIGNAL_REGISTRY: tuple[dict[str, str], ...] = (
    {
        "id": "experienceStartedCount",
        "family": "attraction",
        "availability": "AVAILABLE",
        "scope": "slug+journeyVersion",
    },
    {
        "id": "attractionRate",
        "family": "attraction",
        "availability": "UNAVAILABLE",
        "reason": "exposure_session_and_experience_session_units_not_reconciled",
    },
    {
        "id": "canonicalExposure",
        "family": "attraction",
        "availability": "AVAILABLE",
        "scope": "slug+journeyVersion+context",
    },
    {
        "id": "completionRate",
        "family": "engagement",
        "availability": "AVAILABLE",
        "scope": "slug+journeyVersion",
    },
    {
        "id": "skipRate",
        "family": "engagement",
        "availability": "AVAILABLE",
        "scope": "slug+journeyVersion",
    },
    {
        "id": "observedAverageDepth",
        "family": "engagement",
        "availability": "AVAILABLE",
        "scope": "slug+journeyVersion",
        "precision": "milestone_observed",
    },
    {
        "id": "directChildYansiCount",
        "family": "generativity",
        "availability": "AVAILABLE",
        "scope": "slug",
    },
    {
        "id": "childGenerationRateCandidate",
        "family": "generativity",
        "availability": "DERIVED",
        "scope": "mixed",
        "note": "unadjusted_not_for_ranking",
    },
    {
        "id": "ownContinuationStarted",
        "family": "generativity",
        "availability": "AVAILABLE",
        "scope": "slug",
        "reason": "first_live_question_after_verified_proof",
    },
    {
        "id": "childPublicationRateCandidate",
        "family": "generativity",
        "availability": "DERIVED",
        "scope": "slug",
        "note": "children_over_continuations_when_continuation_gt_0",
    },
    {
        "id": "lineageDepth",
        "family": "generativity",
        "availability": "FUTURE",
        "reason": "no_network_recursion_in_phase_63",
    },
    {
        "id": "totalDescendantCount",
        "family": "generativity",
        "availability": "FUTURE",
        "reason": "distinct_from_direct_children",
    },
    {
        "id": "returnReplayRate",
        "family": "engagement",
        "availability": "FUTURE",
    },
    {
        "id": "impressionToStartConversion",
        "family": "attraction",
        "availability": "FUTURE",
        "reason": "global_attraction_rate_deferred",
    },
    {
        "id": "publishedAtMaturity",
        "family": "maturity",
        "availability": "FUTURE",
        "note": "newness_is_not_a_quality_penalty",
    },
    {
        "id": "languageRegionSegment",
        "family": "normalization",
        "availability": "FUTURE",
    },
    {
        "id": "topicNormalization",
        "family": "normalization",
        "availability": "FUTURE",
    },
)

GENERATIVITY_FUNNEL: tuple[dict[str, str], ...] = (
    {
        "stage": "yansi_started",
        "availability": "AVAILABLE",
        "source": "experienceStartedCount",
    },
    {
        "stage": "own_continuation_chosen",
        "availability": "UNAVAILABLE",
        "note": "cta_or_sohbet_load_is_not_this_stage",
    },
    {
        "stage": "first_live_question",
        "availability": "AVAILABLE",
        "signal": "ownContinuationStarted",
        "scope": "slug",
    },
    {
        "stage": "eight_live_questions",
        "availability": "UNAVAILABLE",
    },
    {
        "stage": "journey_review",
        "availability": "UNAVAILABLE",
    },
    {
        "stage": "child_yansi_published",
        "availability": "AVAILABLE",
        "source": "directChildYansiCount",
    },
)


@dataclass(frozen=True)
class AttractionSemantics:
    startedCount: int
    rateAvailable: bool
    attractionRate: None
    attractionEvidence: Literal["available"]
    exposureEvidenceAvailable: bool
    exposureByContext: dict[str, int]
    attractionRateDeferredReason: str
    interpretation: tuple[str, ...]


@dataclass(frozen=True)
class EngagementSemantics:
    completionRate: Optional[float]
    skipRate: Optional[float]
    observedAverageDepth: Optional[float]
    completionNumerator: int
    completionDenominator: int
    skipNumerator: int
    skipDenominator: int
    skipKind: Literal["navigational_branching"]
    interpretation: tuple[str, ...]


@dataclass(frozen=True)
class GenerativitySemantics:
    directChildYansiCount: int
    childGenerationRateCandidate: Optional[float]
    ownContinuationStartedCount: int
    childPublicationRateCandidate: Optional[float]
    ownContinuationAvailable: bool
    lineageDepthAvailable: bool
    descendantCountAvailable: bool
    childScope: Literal["slug"]
    continuationScope: Literal["slug"]
    interpretation: tuple[str, ...]


@dataclass(frozen=True)
class ConfidenceSemantics:
    """Evidence volume only. Categorical buckets still deferred — no quality thresholds."""

    sampleSize: int
    exposureSampleSize: int
    startedSampleSize: int
    completedSampleSize: int
    continuationSampleSize: int
    childSampleSize: int
    categoryAvailable: bool
    category: None


@dataclass(frozen=True)
class YansiSignalSemantics:
    slug: str
    journeyVersion: int
    productPrinciple: str
    phase7Boundary: str
    attraction: AttractionSemantics
    engagement: EngagementSemantics
    generativity: GenerativitySemantics
    confidence: ConfidenceSemantics
    scopes: dict[str, str]
    hasEvidence: bool

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _require_canonical_metrics(metrics: dict[str, Any]) -> dict[str, Any]:
    missing = [key for key in PUBLIC_METRIC_KEYS if key not in metrics]
    if missing:
        raise ValueError(f"missing_canonical_metrics:{','.join(missing)}")
    return metrics


def _child_generation_rate_candidate(started: int, children: int) -> Optional[float]:
    if started <= 0:
        return None
    return round(children / started, 4)


def _child_publication_rate_candidate(
    children: int, continuations: int
) -> Optional[float]:
    if continuations <= 0:
        return None
    return round(children / continuations, 4)


def build_yansi_signal_semantics(
    metrics: dict[str, Any],
    *,
    exposure_by_context: dict[str, int] | None = None,
    own_continuation_started_count: int = 0,
) -> YansiSignalSemantics:
    """
    Pure transform of Phase 6.1 public metrics plus optional 6.4 evidence.

    Extra keys (EZA, identity, ranking hints) are ignored. No composite score.
    Attraction rate stays UNAVAILABLE: exposureSessionId ≠ experienceSessionId
    and contexts are not a single global opportunity.
    """
    row = _require_canonical_metrics(metrics)
    started = int(row["experienceStartedCount"] or 0)
    completed = int(row["experienceCompletedCount"] or 0)
    skipped = int(row["experienceSkippedSessionCount"] or 0)
    children = int(row["directChildYansiCount"] or 0)
    continuations = max(0, int(own_continuation_started_count or 0))
    exposures = {
        "discover": 0,
        "public_profile": 0,
        "landing": 0,
        "chain": 0,
    }
    if exposure_by_context:
        for key in exposures:
            try:
                exposures[key] = max(0, int(exposure_by_context.get(key, 0) or 0))
            except (TypeError, ValueError):
                exposures[key] = 0
    exposure_total = sum(exposures.values())
    return YansiSignalSemantics(
        slug=str(row["slug"]),
        journeyVersion=int(row["journeyVersion"]),
        productPrinciple=PRODUCT_PRINCIPLE,
        phase7Boundary=PHASE_7_BOUNDARY,
        attraction=AttractionSemantics(
            startedCount=started,
            rateAvailable=False,
            attractionRate=None,
            attractionEvidence="available",
            exposureEvidenceAvailable=True,
            exposureByContext=exposures,
            attractionRateDeferredReason=(
                "exposure_session_and_experience_session_units_not_reconciled"
            ),
            interpretation=ATTRACTION_INTERPRETATION,
        ),
        engagement=EngagementSemantics(
            completionRate=row["completionRate"],
            skipRate=row["skipRate"],
            observedAverageDepth=row["observedAverageDepth"],
            completionNumerator=completed,
            completionDenominator=started,
            skipNumerator=skipped,
            skipDenominator=started,
            skipKind="navigational_branching",
            interpretation=ENGAGEMENT_INTERPRETATION,
        ),
        generativity=GenerativitySemantics(
            directChildYansiCount=children,
            childGenerationRateCandidate=_child_generation_rate_candidate(
                started, children
            ),
            ownContinuationStartedCount=continuations,
            childPublicationRateCandidate=_child_publication_rate_candidate(
                children, continuations
            ),
            ownContinuationAvailable=True,
            lineageDepthAvailable=False,
            descendantCountAvailable=False,
            childScope="slug",
            continuationScope="slug",
            interpretation=GENERATIVITY_INTERPRETATION,
        ),
        confidence=ConfidenceSemantics(
            sampleSize=started,
            exposureSampleSize=exposure_total,
            startedSampleSize=started,
            completedSampleSize=completed,
            continuationSampleSize=continuations,
            childSampleSize=children,
            categoryAvailable=False,
            category=None,
        ),
        scopes={
            "experienceSignals": "slug+journeyVersion",
            "directChildYansiCount": "slug",
            "ownContinuationStarted": "slug",
            "canonicalExposure": "slug+journeyVersion+context",
        },
        hasEvidence=bool(
            started or completed or skipped or children or continuations or exposure_total
        ),
    )


async def get_yansi_signal_semantics(
    db: AsyncSession,
    *,
    slug: str,
    journey_version: Optional[int] = None,
) -> dict[str, Any]:
    """Internal-only read. Not a public API. No ranking. No new public fields."""
    metrics = await get_yansi_public_metrics(
        db, slug=slug, journey_version=journey_version
    )
    version = int(metrics["journeyVersion"])
    slug_n = str(metrics["slug"])
    exposure_by_context = await count_exposures_by_context(
        db, slug=slug_n, journey_version=version
    )
    continuations = await count_own_continuation_started(db, origin_slug=slug_n)
    return build_yansi_signal_semantics(
        metrics,
        exposure_by_context=exposure_by_context,
        own_continuation_started_count=continuations,
    ).to_dict()
