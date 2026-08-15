# -*- coding: utf-8 -*-
"""
Phase 6.5 — Yansı normalization / anti-gaming context (not ranking).

This module answers: how trustworthy and comparable are these signals?
It does not answer: which Yansı is best.

"Normalized" here means comparison context is prepared.
It does NOT mean a 0–1 score, Wilson interval, Bayesian average, or rank.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal, Optional

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.mirror_network import MirrorNetworkNode
from backend.models.yansi_experience_event import (
    YANSI_EXPERIENCE_COMPLETED,
    YANSI_EXPERIENCE_SKIPPED,
    YANSI_EXPERIENCE_STARTED,
    YansiExperienceEvent,
)
from backend.models.yansi_exposure_event import (
    YANSI_EXPOSURE_CONTEXTS,
    YansiExposureEvent,
)
from backend.models.yansi_own_continuation_event import YansiOwnContinuationEvent
from backend.services.mirror_network.author_profile import (
    list_eligible_direct_child_author_ids_batch,
)
from backend.services.mirror_network.frozen_journey_artifact import (
    get_public_frozen_journey_artifact,
)
from backend.services.mirror_network.yansi_metrics import (
    PUBLIC_METRIC_KEYS,
    YansiMetricsError,
    compute_experience_aggregates,
    public_metrics_dict,
)
from backend.services.mirror_network.yansi_signal_semantics import (
    FORBIDDEN_COMPOSITE_KEYS,
    build_yansi_signal_semantics,
)

Availability = Literal["AVAILABLE", "PARTIAL", "UNAVAILABLE", "HISTORICAL_GAP"]

PRODUCT_QUESTION = (
    "How trustworthy and comparable are these signals? "
    "Not: which Yansı ranks above another."
)

PHASE_7_BOUNDARY = (
    "Phase 6.5 prepares ranking-input context only. Phase 7 owns ranking. "
    "No weights, no rank formula, no Discover reorder."
)

TIME_AUTHORITY = "received_at"

FUTURE_TIME_WINDOWS = ("24h", "7d", "30d", "lifetime")

SESSION_SIGNAL_MEANING = "how many replay attempts occurred?"
UNIQUE_AUTH_VIEWER_MEANING = (
    "how many distinct logged-in accounts participated?"
)
GUEST_UNIQUE_HUMAN_POLICY = (
    "Guest unique-human dedupe is UNAVAILABLE. No IP+UA identity, no device "
    "fingerprint. Guest sessions are not unique people."
)

# Future ranking MUST NOT sort by these raw volumes without context.
RANKING_MUST_NOT_SORT_BY = frozenset(
    {
        "experienceStartedCount",
        "directChildYansiCount",
        "ownContinuationStartedCount",
        "exposureCount",
    }
)

PHASE_7_ALLOWED_INPUTS = (
    "canonical_signal_semantics",
    "numerators_and_denominators",
    "sample_sizes",
    "self_vs_external_interaction_counts",
    "authenticated_unique_viewer_evidence",
    "content_age",
    "selectedCount",
    "context_specific_exposure_evidence",
    "child_author_diversity",
    "historical_gap_flags",
    "availability_flags",
)

PHASE_7_FORBIDDEN_INPUTS = (
    "eza_private_profile",
    "assistantScore",
    "userScore",
    "alignment",
    "relationship_map",
    "behavioral_profile",
    "processing_preference",
    "followers",
    "profile_visits",
    "author_total_experiences",
    "author_account_age",
    "creator_reputation",
    "raw_user_identity",
    "guest_fingerprint",
    "ip_geo",
    "device_fingerprint",
    "public_popularity_alone",
    "client_only_unverified_timestamps",
    "global_attraction_rate",
    "composite_quality_score",
    "wilson_or_bayesian_rank",
    "skip_as_simple_negative",
)

FORBIDDEN_PUBLIC_NORMALIZATION_KEYS = frozenset(
    {
        "normalization",
        "rankingEligibleStartedCount",
        "uniqueAuthenticatedStartedViewerCount",
        "selfAuthoredChildCount",
        "externalDirectChildYansiCount",
        "distinctExternalChildAuthorCount",
        "historicalMeasurementGap",
        "isAuthorSelfInteraction",
        "highSessionBurst",
        "authorUserId",
        "viewer_user_id",
        "viewerUserId",
        *FORBIDDEN_COMPOSITE_KEYS,
    }
)

# Scope / bias / abuse audit of canonical 6.3/6.4 units. Not ranking.
SIGNAL_UNIT_AUDIT: tuple[dict[str, str], ...] = (
    {
        "id": "contextSpecificExposureCounts",
        "family": "attraction",
        "scope": "slug+journeyVersion+context",
        "numerator": "distinct exposureSessionId per allowlisted context",
        "denominator": "not a global attraction denominator",
        "knownBias": "contexts are incomparable; guests and auth mixed",
        "abuseSurface": "new exposureSessionId per tab; actor rate-limited",
        "normalizationReadiness": "keep_contexts_separate",
    },
    {
        "id": "experienceStartedCount",
        "family": "attraction",
        "scope": "slug+journeyVersion",
        "numerator": "distinct STARTED experienceSessionId",
        "denominator": "none (volume, not a rate)",
        "knownBias": "session repeats; author self-play; guest != unique human",
        "abuseSurface": "authenticated session minting; guest session minting",
        "normalizationReadiness": "volume_plus_self_and_unique_auth_context",
    },
    {
        "id": "attractionRate",
        "family": "attraction",
        "scope": "incompatible",
        "numerator": "STARTED experienceSessionId",
        "denominator": "exposureSessionId (unrelated id, multi-context)",
        "knownBias": "no attribution proof across units",
        "abuseSurface": "n/a — rate deferred",
        "normalizationReadiness": "unavailable_deferred_do_not_merge_contexts",
    },
    {
        "id": "completionRate",
        "family": "engagement",
        "scope": "slug+journeyVersion",
        "numerator": "STARTED sessions that COMPLETED",
        "denominator": "STARTED sessions",
        "knownBias": "selectedCount 6 vs 7 vs 8; not age-biased as a rate",
        "abuseSurface": "self-play completion loops",
        "normalizationReadiness": "rate_plus_volume_plus_selectedCount",
    },
    {
        "id": "skipRate",
        "family": "engagement",
        "scope": "slug+journeyVersion",
        "numerator": "STARTED sessions with destination-backed SKIPPED",
        "denominator": "STARTED sessions",
        "knownBias": "navigational branching, not abandonment",
        "abuseSurface": "do_not_anti_game_as_penalty",
        "normalizationReadiness": "preserve_as_branching_not_negative",
    },
    {
        "id": "observedAverageDepth",
        "family": "engagement",
        "scope": "slug+journeyVersion",
        "numerator": "sum of milestone-observed depths",
        "denominator": "STARTED sessions",
        "knownBias": "unobserved mid-replay is not invented",
        "abuseSurface": "low — milestone events only",
        "normalizationReadiness": "volume_aware_milestone_mean",
    },
    {
        "id": "ownContinuationStartedCount",
        "family": "generativity",
        "scope": "slug",
        "numerator": "distinct continuation_session_id",
        "denominator": "none (volume)",
        "knownBias": "author self-continue is legitimate product behavior",
        "abuseSurface": "chat-accepted first live question; standalone RL",
        "normalizationReadiness": "self_vs_external_plus_unique_auth",
    },
    {
        "id": "directChildYansiCount",
        "family": "generativity",
        "scope": "slug",
        "numerator": "eligible direct published children",
        "denominator": "none (volume); not version-scoped",
        "knownBias": "age accumulation; same viewer may publish many children",
        "abuseSurface": "self-authored children; one user many children",
        "normalizationReadiness": "diversity_plus_age_plus_do_not_attribute_to_version",
    },
    {
        "id": "childPublicationRateCandidate",
        "family": "generativity",
        "scope": "slug/slug",
        "numerator": "directChildYansiCount",
        "denominator": "ownContinuationStartedCount",
        "knownBias": "historical gap when children exist without Phase 6 continuations",
        "abuseSurface": "null when denominator is 0 — never infinite",
        "normalizationReadiness": "preserve_null_on_missing_denominator",
    },
    {
        "id": "confidenceSampleSizes",
        "family": "confidence",
        "scope": "mixed_see_each_signal",
        "numerator": "n/a",
        "denominator": "exposure/started/completed/continuation/child sample sizes",
        "knownBias": "small samples are not low quality",
        "abuseSurface": "no categorical quality buckets",
        "normalizationReadiness": "carry_denominator_no_invented_threshold",
    },
)


def _norm_id(value: str | None) -> str:
    return (value or "").strip().lower()


def _as_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def parse_eval_datetime(value: datetime | str | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return _as_aware(value)
    raw = str(value).strip()
    if not raw:
        return None
    try:
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        return _as_aware(datetime.fromisoformat(raw))
    except ValueError:
        return None


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat()


def signal_rate_evidence(
    *,
    numerator: int,
    denominator: int,
    scope: str,
    availability: Availability,
    scopeCompatible: bool = True,
) -> dict[str, Any]:
    """Transparent rate+volume helper. No Wilson/Bayesian/rank value."""
    raw = None
    if denominator > 0:
        raw = round(numerator / denominator, 4)
    return {
        "numerator": int(numerator),
        "denominator": int(denominator),
        "rawRate": raw,
        "sampleSize": int(denominator),
        "scope": scope,
        "availability": availability,
        "scopeCompatible": bool(scopeCompatible),
    }


def compute_age_context(
    published_at: datetime | str | None,
    *,
    evaluated_at: datetime,
) -> dict[str, Any]:
    """Evaluation-time maturity metadata. Not persisted. No penalty or boost."""
    now = _as_aware(evaluated_at)
    published = parse_eval_datetime(published_at)
    age_seconds = None
    if published is not None:
        age_seconds = max(0, int((now - published).total_seconds()))
    return {
        "publishedAt": _iso(published) if published else None,
        "evaluatedAt": _iso(now),
        "ageSeconds": age_seconds,
        "ageHours": round(age_seconds / 3600, 4) if age_seconds is not None else None,
        "ageDays": round(age_seconds / 86400, 4) if age_seconds is not None else None,
        "contentAgeAvailable": published is not None,
        "signalAgePolicy": (
            "lifetime_evidence_accumulates_with_content_age; "
            "windowed_signal_age_not_computed"
        ),
        "interpretation": (
            "age_is_comparability_context_not_a_freshness_boost_or_penalty"
        ),
    }


def _distinct_viewer_count(ids: list[str | None]) -> int:
    seen: set[str] = set()
    for raw in ids:
        key = _norm_id(raw)
        if key:
            seen.add(key)
    return len(seen)


def _count_self(ids: list[str | None], author_id: str) -> int:
    if not author_id:
        return 0
    return sum(1 for raw in ids if _norm_id(raw) == author_id)


def derive_interaction_splits(
    *,
    viewer_ids: list[str | None],
    author_user_id: str | None,
) -> dict[str, int]:
    """
    Query-time self vs external vs guest. Repeat authenticated users are
    NOT collapsed here — unique counts are a separate evidence family.
    """
    author = _norm_id(author_user_id)
    self_n = _count_self(viewer_ids, author) if author else 0
    guest_n = sum(1 for raw in viewer_ids if not _norm_id(raw))
    auth_n = len(viewer_ids) - guest_n
    external_n = len(viewer_ids) - self_n
    ranking_eligible = external_n
    return {
        "authorSelfCount": self_n,
        "externalCount": external_n,
        "guestCount": guest_n,
        "authenticatedCount": auth_n,
        "rankingEligibleCount": ranking_eligible,
        "uniqueAuthenticatedViewerCount": _distinct_viewer_count(viewer_ids),
    }


def derive_child_diversity(
    *,
    child_author_ids: list[str | None],
    parent_author_id: str | None,
) -> dict[str, Any]:
    parent = _norm_id(parent_author_id)
    ids = [_norm_id(raw) for raw in child_author_ids]
    total = len(ids)
    self_n = sum(1 for item in ids if parent and item == parent)
    external_ids = [item for item in ids if item and item != parent]
    distinct_all = {item for item in ids if item}
    distinct_external = {item for item in external_ids if item}
    return {
        "directChildYansiCount": total,
        "selfAuthoredChildCount": self_n,
        "externalDirectChildYansiCount": total - self_n,
        "distinctChildAuthorCount": len(distinct_all),
        "distinctExternalChildAuthorCount": len(distinct_external),
        "childScope": "slug",
        "versionAttribution": "not_attributed",
        "availability": "AVAILABLE" if total or parent else "UNAVAILABLE",
    }


def _language_topic_from_payload(public_payload: Any) -> tuple[str | None, str | None]:
    if not isinstance(public_payload, dict):
        return None, None
    seed = public_payload.get("seed")
    if not isinstance(seed, dict):
        return None, None
    locale = str(seed.get("locale") or "").strip() or None
    topic = str(seed.get("topicCategory") or "").strip() or None
    return locale, topic


def build_yansi_normalization_context(
    *,
    slug: str,
    journey_version: int,
    author_user_id: str | None,
    published_at: datetime | str | None,
    evaluated_at: datetime,
    selected_count: int | None,
    canonical_started_count: int,
    canonical_completed_count: int,
    canonical_skipped_count: int,
    canonical_child_count: int,
    canonical_continuation_count: int,
    started_viewer_ids: list[str | None],
    completed_viewer_ids: list[str | None],
    continuation_viewer_ids: list[str | None],
    exposure_by_context: dict[str, int] | None,
    exposure_viewer_ids_by_context: dict[str, list[str | None]] | None,
    child_author_ids: list[str | None],
    language: str | None,
    topic_category: str | None,
) -> dict[str, Any]:
    """
    Pure comparison-context builder. author_user_id is input-only and never
    serialized. No composite number.
    """
    started = derive_interaction_splits(
        viewer_ids=started_viewer_ids, author_user_id=author_user_id
    )
    completed = derive_interaction_splits(
        viewer_ids=completed_viewer_ids, author_user_id=author_user_id
    )
    continuation = derive_interaction_splits(
        viewer_ids=continuation_viewer_ids, author_user_id=author_user_id
    )
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
    unique_exposure: dict[str, int] = {}
    self_exposure: dict[str, int] = {}
    viewer_map = exposure_viewer_ids_by_context or {}
    for ctx in exposures:
        split = derive_interaction_splits(
            viewer_ids=viewer_map.get(ctx, []),
            author_user_id=author_user_id,
        )
        unique_exposure[ctx] = split["uniqueAuthenticatedViewerCount"]
        self_exposure[ctx] = split["authorSelfCount"]

    children = derive_child_diversity(
        child_author_ids=child_author_ids, parent_author_id=author_user_id
    )
    historical_gap = bool(
        canonical_child_count > 0
        and canonical_started_count == 0
        and canonical_continuation_count == 0
    )
    language_available = bool(language)
    topic_available = bool(topic_category)
    started_avail: Availability = (
        "AVAILABLE" if canonical_started_count >= 0 else "UNAVAILABLE"
    )
    unique_auth_avail: Availability = (
        "AVAILABLE" if started["authenticatedCount"] > 0 else "PARTIAL"
    )
    if canonical_started_count > 0 and started["authenticatedCount"] == 0:
        unique_auth_avail = "PARTIAL"

    return {
        "identity": {
            "slug": slug,
            "journeyVersion": int(journey_version),
        },
        "scope": {
            "experienceSignals": "slug+journeyVersion",
            "directChildYansiCount": "slug",
            "ownContinuationStarted": "slug",
            "canonicalExposure": "slug+journeyVersion+context",
            "childAuthors": "slug",
        },
        "sampleSizes": {
            "started": int(canonical_started_count),
            "completed": int(canonical_completed_count),
            "skipped": int(canonical_skipped_count),
            "continuation": int(canonical_continuation_count),
            "children": int(canonical_child_count),
            "exposureByContext": dict(exposures),
        },
        "selfInteraction": {
            "policy": (
                "public_counters_keep_canonical_product_semantics; "
                "ranking_eligible_excludes_authenticated_author_self_interactions"
            ),
            "authorSelfStartedSessions": started["authorSelfCount"],
            "externalStartedSessions": started["externalCount"],
            "authorSelfCompletedSessions": completed["authorSelfCount"],
            "externalCompletedSessions": completed["externalCount"],
            "authorSelfContinuationCount": continuation["authorSelfCount"],
            "externalContinuationCount": continuation["externalCount"],
            "authorSelfExposureCountByContext": self_exposure,
            "rankingEligibleStartedCount": started["rankingEligibleCount"],
            "rankingEligibleCompletedCount": completed["rankingEligibleCount"],
            "rankingEligibleContinuationCount": continuation["rankingEligibleCount"],
            "repeatAuthenticatedUsersNotAutoDeduped": True,
        },
        "uniqueViewerEvidence": {
            "sessionSignalMeaning": SESSION_SIGNAL_MEANING,
            "authenticatedUniqueViewerMeaning": UNIQUE_AUTH_VIEWER_MEANING,
            "uniqueAuthenticatedStartedViewerCount": started[
                "uniqueAuthenticatedViewerCount"
            ],
            "uniqueAuthenticatedCompletedViewerCount": completed[
                "uniqueAuthenticatedViewerCount"
            ],
            "uniqueAuthenticatedContinuationViewerCount": continuation[
                "uniqueAuthenticatedViewerCount"
            ],
            "uniqueAuthenticatedExposureViewerCountByContext": unique_exposure,
            "guestStartedSessions": started["guestCount"],
            "guestUniqueHumanAvailability": "UNAVAILABLE",
            "guestPolicy": GUEST_UNIQUE_HUMAN_POLICY,
        },
        "ageContext": compute_age_context(published_at, evaluated_at=evaluated_at),
        "replayLength": {
            "selectedCount": (
                int(selected_count)
                if selected_count in (6, 7, 8)
                else selected_count
            ),
            "completionNotAgeNormalized": True,
            "noAdjustmentFormula": True,
        },
        "exposureByContext": {
            "counts": dict(exposures),
            "globalMergedDenominatorUsed": False,
            "globalExposureTotalForAttractionRate": None,
            "discoverToStartedAttribution": "UNAVAILABLE",
            "attractionRate": None,
        },
        "generativityDiversity": children,
        "historicalGaps": {
            "historicalMeasurementGap": historical_gap,
            "versionVsSlug": (
                "children_and_continuations_are_slug_level; "
                "experience_and_exposure_are_version_scoped; "
                "do_not_attribute_slug_children_to_one_version"
            ),
        },
        "contentContext": {
            "language": language,
            "languageAvailability": (
                "AVAILABLE" if language_available else "UNAVAILABLE"
            ),
            "region": None,
            "regionAvailability": "UNAVAILABLE",
            "topicCategory": topic_category,
            "topicAvailability": "AVAILABLE" if topic_available else "UNAVAILABLE",
            "topicComparabilityNote": (
                "completion behavior may differ by topic; "
                "Phase 7 must not use naive universal thresholds"
            ),
            "languageInference": "none",
            "regionFingerprint": "none",
            "topicClassification": "none",
        },
        "antiGamingDiagnostics": {
            "deferred": True,
            "reason": "no_invented_thresholds_preserve_raw_evidence",
            "highSessionBurst": None,
            "highSelfInteractionRatio": None,
            "highSingleViewerConcentration": None,
            "noPublicFraudFlag": True,
            "noContentSuppression": True,
        },
        "timeAuthority": TIME_AUTHORITY,
        "futureTimeWindows": list(FUTURE_TIME_WINDOWS),
        "windowsImplemented": [],
        "smallSample": None,
        "smallSampleDecision": "deferred_carry_denominator_no_invented_threshold",
        "ezaExcluded": True,
        "authorPopularityExcluded": True,
        "rankingMustNotSortBy": sorted(RANKING_MUST_NOT_SORT_BY),
        "availability": {
            "canonicalPublicStartedCount": started_avail,
            "rankingEligibleStartedCount": "AVAILABLE",
            "uniqueAuthenticatedStarts": unique_auth_avail,
            "guestUniqueHumans": "UNAVAILABLE",
            "topic": "AVAILABLE" if topic_available else "UNAVAILABLE",
            "language": "AVAILABLE" if language_available else "UNAVAILABLE",
            "region": "UNAVAILABLE",
            "globalAttractionRate": "UNAVAILABLE",
            "childAuthorDiversity": children["availability"],
            "historicalMeasurementGap": (
                "HISTORICAL_GAP" if historical_gap else "AVAILABLE"
            ),
            "discoverToStartedAttribution": "UNAVAILABLE",
        },
    }


def build_rate_evidence_bundle(
    *,
    started: int,
    completed: int,
    skipped: int,
    children: int,
    continuations: int,
    historical_gap: bool,
) -> dict[str, Any]:
    pub_avail: Availability = "AVAILABLE"
    if continuations <= 0:
        pub_avail = "HISTORICAL_GAP" if children > 0 else "UNAVAILABLE"
    gen_avail: Availability = "PARTIAL"
    if started <= 0:
        gen_avail = "HISTORICAL_GAP" if children > 0 else "UNAVAILABLE"
    return {
        "completion": signal_rate_evidence(
            numerator=completed,
            denominator=started,
            scope="slug+journeyVersion",
            availability="AVAILABLE" if started > 0 else "UNAVAILABLE",
        ),
        "skip": signal_rate_evidence(
            numerator=skipped,
            denominator=started,
            scope="slug+journeyVersion",
            availability="AVAILABLE" if started > 0 else "UNAVAILABLE",
        ),
        "childPublicationRateCandidate": signal_rate_evidence(
            numerator=children,
            denominator=continuations,
            scope="slug",
            availability=pub_avail,
        ),
        "childGenerationRateCandidate": signal_rate_evidence(
            numerator=children,
            denominator=started,
            scope="slug_children_over_version_starts",
            availability=gen_avail,
            scopeCompatible=False,
        ),
        "historicalMeasurementGap": historical_gap,
        "skipInterpretation": "navigational_branching_not_abandonment_not_a_penalty",
    }


def build_yansi_normalized_signal_evidence(
    semantics: dict[str, Any],
    context: dict[str, Any],
) -> dict[str, Any]:
    """6.3 semantics + 6.4 confidence + 6.5 context. No score."""
    started = int(context["sampleSizes"]["started"])
    completed = int(context["sampleSizes"]["completed"])
    skipped = int(context["sampleSizes"]["skipped"])
    children = int(context["sampleSizes"]["children"])
    continuations = int(context["sampleSizes"]["continuation"])
    historical = bool(context["historicalGaps"]["historicalMeasurementGap"])
    return {
        "productQuestion": PRODUCT_QUESTION,
        "phase7Boundary": PHASE_7_BOUNDARY,
        "semantics": semantics,
        "normalization": context,
        "rateEvidence": build_rate_evidence_bundle(
            started=started,
            completed=completed,
            skipped=skipped,
            children=children,
            continuations=continuations,
            historical_gap=historical,
        ),
        "ranking": {
            "implemented": False,
            "weightsDefined": False,
            "formulaDefined": False,
            "mustNotSortByRawCounts": sorted(RANKING_MUST_NOT_SORT_BY),
        },
        "phase7": {
            "allowedInputs": list(PHASE_7_ALLOWED_INPUTS),
            "forbiddenInputs": list(PHASE_7_FORBIDDEN_INPUTS),
            "rankingStatus": "NO-GO",
        },
    }


_LEAK_KEYS = frozenset(
    {
        "authoruserid",
        "author_user_id",
        "viewer_user_id",
        "vieweruserid",
        "userid",
        "user_id",
        "followers",
        "assistantscore",
        "relationshipmap",
        "ip",
        "useragent",
        "user_agent",
    }
)


def _keys_lower(payload: Any) -> set[str]:
    found: set[str] = set()
    if isinstance(payload, dict):
        for key, value in payload.items():
            found.add(str(key).lower())
            found |= _keys_lower(value)
    elif isinstance(payload, (list, tuple)):
        for item in payload:
            found |= _keys_lower(item)
    return found


def assert_no_identity_leak(payload: dict[str, Any]) -> None:
    leaked = _keys_lower(payload) & _LEAK_KEYS
    if leaked:
        raise ValueError(f"normalization_identity_leak:{','.join(sorted(leaked))}")


async def _load_experience_bundle(
    db: AsyncSession,
    items: list[tuple[str, int]],
) -> dict[tuple[str, int], dict[str, Any]]:
    out: dict[tuple[str, int], dict[str, Any]] = {
        key: {
            "rows": [],
            "started": [],
            "completed": [],
        }
        for key in items
    }
    if not items:
        return out
    conds = [
        and_(
            YansiExperienceEvent.mirror_slug == slug,
            YansiExperienceEvent.journey_version == version,
        )
        for slug, version in items
    ]
    result = await db.execute(
        select(
            YansiExperienceEvent.mirror_slug,
            YansiExperienceEvent.journey_version,
            YansiExperienceEvent.experience_session_id,
            YansiExperienceEvent.event_type,
            YansiExperienceEvent.completed_step_count,
            YansiExperienceEvent.viewer_user_id,
        ).where(
            YansiExperienceEvent.event_type.in_(
                (
                    YANSI_EXPERIENCE_STARTED,
                    YANSI_EXPERIENCE_COMPLETED,
                    YANSI_EXPERIENCE_SKIPPED,
                )
            ),
            or_(*conds),
        )
    )
    started_viewer_by_session: dict[tuple[str, int, str], str | None] = {}
    completed_sessions: set[tuple[str, int, str]] = set()
    for slug, version, session_id, event_type, step, viewer in result.all():
        key = (str(slug).strip().lower(), int(version))
        if key not in out:
            continue
        sid = str(session_id)
        out[key]["rows"].append(
            (sid, str(event_type), int(step) if step is not None else None)
        )
        if event_type == YANSI_EXPERIENCE_STARTED:
            started_viewer_by_session[(key[0], key[1], sid)] = (
                str(viewer) if viewer else None
            )
        elif event_type == YANSI_EXPERIENCE_COMPLETED:
            completed_sessions.add((key[0], key[1], sid))
    for (slug, version, sid), viewer in started_viewer_by_session.items():
        pair = (slug, version)
        if pair in out:
            out[pair]["started"].append(viewer)
    for slug, version, sid in completed_sessions:
        pair = (slug, version)
        if pair not in out:
            continue
        viewer = started_viewer_by_session.get((slug, version, sid))
        out[pair]["completed"].append(viewer)
    return out


async def _load_continuation_viewers(
    db: AsyncSession,
    slugs: list[str],
) -> dict[str, list[str | None]]:
    out: dict[str, list[str | None]] = {slug: [] for slug in slugs}
    if not slugs:
        return out
    result = await db.execute(
        select(
            YansiOwnContinuationEvent.origin_mirror_slug,
            YansiOwnContinuationEvent.viewer_user_id,
        ).where(YansiOwnContinuationEvent.origin_mirror_slug.in_(slugs))
    )
    for origin, viewer in result.all():
        key = str(origin).strip().lower()
        if key in out:
            out[key].append(str(viewer) if viewer else None)
    return out


async def _load_exposure_viewers(
    db: AsyncSession,
    items: list[tuple[str, int]],
) -> tuple[dict[tuple[str, int], dict[str, int]], dict[tuple[str, int], dict[str, list[str | None]]]]:
    counts: dict[tuple[str, int], dict[str, int]] = {
        key: {ctx: 0 for ctx in sorted(YANSI_EXPOSURE_CONTEXTS)} for key in items
    }
    viewers: dict[tuple[str, int], dict[str, list[str | None]]] = {
        key: {ctx: [] for ctx in sorted(YANSI_EXPOSURE_CONTEXTS)} for key in items
    }
    if not items:
        return counts, viewers
    conds = [
        and_(
            YansiExposureEvent.mirror_slug == slug,
            YansiExposureEvent.journey_version == version,
        )
        for slug, version in items
    ]
    result = await db.execute(
        select(
            YansiExposureEvent.mirror_slug,
            YansiExposureEvent.journey_version,
            YansiExposureEvent.context,
            YansiExposureEvent.exposure_session_id,
            YansiExposureEvent.viewer_user_id,
        ).where(or_(*conds))
    )
    seen: set[tuple[str, int, str, str]] = set()
    for slug, version, context, session_id, viewer in result.all():
        key = (str(slug).strip().lower(), int(version))
        ctx = str(context)
        if key not in counts or ctx not in counts[key]:
            continue
        token = (key[0], key[1], ctx, str(session_id))
        if token in seen:
            continue
        seen.add(token)
        counts[key][ctx] += 1
        viewers[key][ctx].append(str(viewer) if viewer else None)
    return counts, viewers


async def _load_nodes_by_slug(
    db: AsyncSession, slugs: list[str]
) -> dict[str, MirrorNetworkNode]:
    if not slugs:
        return {}
    result = await db.execute(
        select(MirrorNetworkNode).where(MirrorNetworkNode.slug.in_(slugs))
    )
    nodes_by_slug: dict[str, MirrorNetworkNode] = {}
    for node in result.scalars().all():
        nodes_by_slug[str(node.slug).strip().lower()] = node
    return nodes_by_slug


async def get_yansi_normalized_signal_evidence_batch(
    db: AsyncSession,
    items: list[tuple[str, int]],
    *,
    evaluated_at: datetime | None = None,
) -> dict[tuple[str, int], dict[str, Any]]:
    """
    Page-oriented ranking-input context. Query-time. No materialized rank state.
    Does not change Discover sort and must not be imported there.
    """
    pairs: list[tuple[str, int]] = []
    seen: set[tuple[str, int]] = set()
    for slug, version in items:
        key = ((slug or "").strip().lower(), int(version or 0))
        if not key[0] or key[1] < 1 or key in seen:
            continue
        seen.add(key)
        pairs.append(key)
    now = _as_aware(evaluated_at or datetime.now(timezone.utc))
    out: dict[tuple[str, int], dict[str, Any]] = {}
    if not pairs:
        return out

    slugs = sorted({slug for slug, _ in pairs})
    nodes_by_slug = await _load_nodes_by_slug(db, slugs)
    experience = await _load_experience_bundle(db, pairs)
    continuation_viewers = await _load_continuation_viewers(db, slugs)
    exposure_counts, exposure_viewers = await _load_exposure_viewers(db, pairs)
    child_authors = await list_eligible_direct_child_author_ids_batch(db, slugs)

    for slug, version in pairs:
        public = await get_public_frozen_journey_artifact(
            db, slug=slug, journey_version=version
        )
        if public is None:
            continue
        selected = int(public.get("selectedCount") or 0)
        if selected < 6 or selected > 8 or public.get("replayReady") is not True:
            continue
        node = nodes_by_slug.get(slug)
        language, topic = _language_topic_from_payload(
            getattr(node, "public_payload", None) if node is not None else None
        )
        author_id = None
        if node is not None:
            author_id = str(getattr(node, "user_id", "") or "") or None
        elif public.get("authorUserId"):
            author_id = str(public.get("authorUserId"))
        published_at = public.get("publishedAt")
        if node is not None and getattr(node, "published_at", None) is not None:
            published_at = node.published_at
        bundle = experience.get(
            (slug, version), {"rows": [], "started": [], "completed": []}
        )
        aggregates = compute_experience_aggregates(
            bundle["rows"], selected_count=selected
        )
        child_ids = child_authors.get(slug, [])
        metrics = public_metrics_dict(
            slug=slug,
            journey_version=int(public.get("journeyVersion") or version),
            aggregates=aggregates,
            direct_child_yansi_count=len(child_ids),
        )
        continuations = continuation_viewers.get(slug, [])
        semantics = build_yansi_signal_semantics(
            {key: metrics[key] for key in PUBLIC_METRIC_KEYS},
            exposure_by_context=exposure_counts.get((slug, version)),
            own_continuation_started_count=len(continuations),
        )
        context = build_yansi_normalization_context(
            slug=slug,
            journey_version=int(metrics["journeyVersion"]),
            author_user_id=author_id,
            published_at=published_at,
            evaluated_at=now,
            selected_count=selected,
            canonical_started_count=int(metrics["experienceStartedCount"] or 0),
            canonical_completed_count=int(
                metrics["experienceCompletedCount"] or 0
            ),
            canonical_skipped_count=int(
                metrics["experienceSkippedSessionCount"] or 0
            ),
            canonical_child_count=int(metrics["directChildYansiCount"] or 0),
            canonical_continuation_count=len(continuations),
            started_viewer_ids=bundle["started"],
            completed_viewer_ids=bundle["completed"],
            continuation_viewer_ids=continuations,
            exposure_by_context=exposure_counts.get((slug, version)),
            exposure_viewer_ids_by_context=exposure_viewers.get((slug, version)),
            child_author_ids=child_ids,
            language=language,
            topic_category=topic,
        )
        evidence = build_yansi_normalized_signal_evidence(
            semantics.to_dict(), context
        )
        assert_no_identity_leak(evidence)
        out[(slug, version)] = evidence
    return out


async def get_yansi_normalized_signal_evidence(
    db: AsyncSession,
    *,
    slug: str,
    journey_version: Optional[int] = None,
    evaluated_at: datetime | None = None,
) -> dict[str, Any]:
    """Internal-only. Not a public API. No ranking value."""
    public = await get_public_frozen_journey_artifact(
        db, slug=slug, journey_version=journey_version
    )
    if public is None:
        raise YansiMetricsError("frozen_journey_not_found", status_code=404)
    version = int(public.get("journeyVersion") or 0)
    slug_n = (slug or "").strip().lower()
    batch = await get_yansi_normalized_signal_evidence_batch(
        db, [(slug_n, version)], evaluated_at=evaluated_at
    )
    row = batch.get((slug_n, version))
    if row is None:
        raise YansiMetricsError("frozen_journey_not_found", status_code=404)
    return row
