# -*- coding: utf-8 -*-
"""
Phase 7.4 — Güçlü Merak shadow evaluation (internal only).

Evaluates Phase 7.3 ordering behaviour. Does not activate live ranking.
Does not invent a composite score or pick a winner.
Must not be imported by public Discover listing.
"""

from __future__ import annotations

import copy
from datetime import datetime, timedelta, timezone
from itertools import combinations
from typing import Any, Callable, Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from backend.services.mirror_network.discover import MAX_DISCOVER_ELIGIBLE_LOAD
from backend.services.mirror_network.yansi_normalization import (
    build_yansi_normalization_context,
    build_yansi_normalized_signal_evidence,
)
from backend.services.mirror_network.yansi_signal_semantics import (
    build_yansi_signal_semantics,
)
from backend.services.mirror_network.yansi_strong_curiosity_candidate import (
    FORBIDDEN_CANDIDATE_SCORE_KEYS,
    build_strong_curiosity_candidate,
)
from backend.services.mirror_network.yansi_strong_curiosity_pairwise_diagnostic import (
    pairwise_volume_agreement_diagnostic,
)
from backend.services.mirror_network.yansi_strong_curiosity_shadow import (
    FORBIDDEN_SHADOW_SCORE_KEYS,
    HIGH_VOLUME_DEPENDENCE_RATIO,
    SHADOW_STRATEGIES,
    ShadowStrategy,
    order_shadow_candidates,
    run_shadow_on_candidates,
)

AUTHOR = "eval-author"
NOW = datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc)

# Frozen Phase 7.3 contracts. Evaluation reads them; it must not rewrite them.
PHASE73_SEMANTIC_KEYS: dict[str, tuple[str, ...]] = {
    "control_input_order": (
        "preserve_eligible_candidate_input_order",
        "slug_asc",
    ),
    "balanced_evidence": (
        "available_independent_family_count DESC",
        "historical_generativity_present DESC",
        "distinct_external_child_author_count DESC",
        "external_direct_child_yansi_count DESC",
        "engagement_status DESC",
        "log1p(ranking_eligible_completion_denominator) DESC",
        "ranking_eligible_completion_ratio DESC",
        "unique_authenticated_started_viewers_excluding_author DESC",
        "log1p(ranking_eligible_started_count) DESC last",
        "slug_asc",
    ),
    "generativity_led": (
        "generativity_family_status DESC",
        "distinct_external_child_author_count DESC",
        "external_direct_child_yansi_count DESC",
        "ranking_eligible_continuation_count DESC",
        "scope_compatible_publication_rate only if available",
        "slug_asc",
    ),
    "engagement_led": (
        "engagement_family_status DESC",
        "log1p(ranking_eligible_started_as_completion_denominator) DESC",
        "ranking_eligible_completion_ratio DESC after sample support",
        "log1p(ranking_eligible_completed_count) DESC",
        "skip ignored",
        "slug_asc",
    ),
    "evidence_stability": (
        "unique_authenticated_viewers_excluding_author present DESC",
        "log1p(unique_authenticated_started_viewers_excluding_author) DESC",
        "log1p(ranking_eligible_started_sample) DESC",
        "slug_asc",
    ),
}

FORBIDDEN_EVAL_SCORE_KEYS = frozenset(
    {
        *FORBIDDEN_CANDIDATE_SCORE_KEYS,
        *FORBIDDEN_SHADOW_SCORE_KEYS,
        "finalScore",
        "winnerScore",
        "recommendedWeight",
        "winner",
    }
)
SUBJECTIVE_LABELS = ("BEST", "BORING", "VIRAL", "HIGH_QUALITY")

# Engineering warning copied from 7.3. Not a product quality threshold.
DEPENDENCE_WARNING_RATIO = HIGH_VOLUME_DEPENDENCE_RATIO
LOW_DIFFERENTIATION_AVG_ABS_DELTA = 1.0
TOP_K_FAMILY_DOMINANCE_SHARE = 0.70
EVAL_TOP_K = (10, 20, 50)

RANKING_STRATEGIES: tuple[ShadowStrategy, ...] = (
    "balanced_evidence",
    "generativity_led",
    "engagement_led",
    "evidence_stability",
)


def _int(value: Any, default: int = 0) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return default


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
    leaked = FORBIDDEN_EVAL_SCORE_KEYS.intersection(_keys_raw(payload))
    if leaked:
        raise RuntimeError(f"strong_curiosity_eval_score_leak:{','.join(sorted(leaked))}")
    blob = str(payload)
    for label in SUBJECTIVE_LABELS:
        if label in blob:
            raise RuntimeError(f"strong_curiosity_eval_subjective_label:{label}")


def _viewers(count: int, *, unique: int, prefix: str) -> list[str]:
    unique_n = max(1, int(unique))
    return [f"{prefix}-{i % unique_n}" for i in range(max(0, int(count)))]


def _semantics(**kwargs: Any) -> dict[str, Any]:
    started = kwargs.get("started", 0)
    completed = kwargs.get("completed", 0)
    skipped = kwargs.get("skipped", 0)
    row = {
        "slug": kwargs.get("slug", "yansi-a"),
        "journeyVersion": kwargs.get("version", 1),
        "experienceStartedCount": started,
        "experienceCompletedCount": completed,
        "experienceSkippedSessionCount": skipped,
        "completionRate": None if started <= 0 else completed / started,
        "skipRate": None if started <= 0 else skipped / started,
        "observedAverageDepth": kwargs.get("depth"),
        "directChildYansiCount": kwargs.get("children", 0),
    }
    return build_yansi_signal_semantics(
        row,
        exposure_by_context=kwargs.get("exposure"),
        own_continuation_started_count=kwargs.get("continuations", 0),
    ).to_dict()


def _ctx(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = dict(
        slug="yansi-a",
        journey_version=1,
        author_user_id=AUTHOR,
        published_at=NOW - timedelta(days=30),
        evaluated_at=NOW,
        selected_count=8,
        canonical_started_count=0,
        canonical_completed_count=0,
        canonical_skipped_count=0,
        canonical_child_count=0,
        canonical_continuation_count=0,
        started_viewer_ids=[],
        completed_viewer_ids=[],
        continuation_viewer_ids=[],
        exposure_by_context=None,
        exposure_viewer_ids_by_context=None,
        child_author_ids=[],
        language="tr",
        topic_category="travel",
    )
    base.update(overrides)
    return build_yansi_normalization_context(**base)


def _candidate(**kwargs: Any) -> dict[str, Any]:
    slug = str(kwargs.get("slug") or "yansi-a")
    started = _int(kwargs.get("started"))
    completed = _int(kwargs.get("completed"))
    skipped = _int(kwargs.get("skipped"))
    children = _int(kwargs.get("children"))
    continuations = _int(kwargs.get("continuations"))
    unique = _int(kwargs.get("unique"), min(started, 8) or 1)
    prefix = kwargs.get("prefix") or slug.replace("-", "")[:10]
    child_authors = kwargs.get("child_authors")
    if child_authors is None and children:
        child_authors = [f"{prefix}-child-{i}" for i in range(children)]
    started_ids = kwargs.get("started_ids")
    if started_ids is None:
        started_ids = _viewers(started, unique=unique, prefix=f"{prefix}-s")
    completed_ids = kwargs.get("completed_ids")
    if completed_ids is None:
        completed_ids = list(started_ids[:completed])
    continuation_ids = kwargs.get("continuation_ids")
    if continuation_ids is None:
        continuation_ids = _viewers(
            continuations, unique=max(1, min(unique, continuations or 1)), prefix=f"{prefix}-c"
        )
    ctx = _ctx(
        slug=slug,
        journey_version=_int(kwargs.get("version"), 1),
        published_at=kwargs.get("published_at", NOW - timedelta(days=30)),
        evaluated_at=kwargs.get("evaluated_at", NOW),
        selected_count=_int(kwargs.get("selected_count"), 8),
        canonical_started_count=started,
        canonical_completed_count=completed,
        canonical_skipped_count=skipped,
        canonical_child_count=children,
        canonical_continuation_count=continuations,
        started_viewer_ids=started_ids,
        completed_viewer_ids=completed_ids,
        continuation_viewer_ids=continuation_ids,
        child_author_ids=child_authors or [],
        language=kwargs.get("language", "tr"),
        topic_category=kwargs.get("topic_category", "travel"),
    )
    evidence = build_yansi_normalized_signal_evidence(
        _semantics(
            slug=slug,
            started=started,
            completed=completed,
            skipped=skipped,
            children=children,
            continuations=continuations,
        ),
        ctx,
    )
    return build_strong_curiosity_candidate(
        slug=slug,
        journey_version=_int(kwargs.get("version"), 1),
        discover_eligible=bool(kwargs.get("eligible", True)),
        normalized_evidence=evidence,
    )


def _overlay_counts(
    row: dict[str, Any],
    *,
    public_started: int | None = None,
    ranking_started: int | None = None,
    ranking_completed: int | None = None,
    unique_auth: int | None = None,
    author_self: int | None = None,
    public_completed: int | None = None,
) -> dict[str, Any]:
    """Adjust magnitudes 7.3 actually reads without rebuilding 100k viewer rows."""
    out = copy.deepcopy(row)
    if ranking_started is not None:
        out["attractionEvidence"]["rankingEligibleStartedCount"] = ranking_started
        out["engagementEvidence"]["rankingEligibleStartedCount"] = ranking_started
        out["selfInteraction"]["rankingEligibleStartedCount"] = ranking_started
        if ranking_started >= 1:
            out["attractionEvidence"]["status"] = "AVAILABLE"
            out["engagementEvidence"]["status"] = "AVAILABLE"
            out["attractionEvidence"]["independentEvidence"] = True
            out["engagementEvidence"]["independentEvidence"] = True
            out["engagementEvidence"]["denominatorAvailable"] = True
    if ranking_completed is not None:
        out["engagementEvidence"]["rankingEligibleCompletedCount"] = ranking_completed
        out["selfInteraction"]["rankingEligibleCompletedCount"] = ranking_completed
    if public_started is not None:
        out["attractionEvidence"]["publicStartedCount"] = public_started
        out["uniqueViewerEvidence"]["sessionCount"] = public_started
        num = (
            public_completed
            if public_completed is not None
            else _int(out["engagementEvidence"].get("rankingEligibleCompletedCount"))
        )
        out["engagementEvidence"]["completionNumerator"] = num
        out["engagementEvidence"]["completionDenominator"] = public_started
        out["engagementEvidence"]["completionRawRate"] = (
            num / public_started if public_started else None
        )
    if unique_auth is not None:
        out["uniqueViewerEvidence"]["uniqueAuthenticatedStartedViewerCount"] = unique_auth
    if author_self is not None:
        out["selfInteraction"]["authorSelfStartedSessions"] = author_self
    return out


def build_phase74_reference_cohorts(
    *, evaluated_at: datetime | None = None
) -> list[dict[str, Any]]:
    """Controlled synthetic/reference pathologies. Not a live corpus."""
    now = evaluated_at or NOW
    cohorts: list[dict[str, Any]] = []

    mass = _candidate(
        slug="mass-popularity",
        started=80,
        completed=56,
        unique=40,
        published_at=now - timedelta(days=400),
        evaluated_at=now,
    )
    cohorts.append(
        _overlay_counts(
            mass,
            public_started=100_000,
            public_completed=70_000,
            ranking_started=100_000,
            ranking_completed=70_000,
            unique_auth=400,
            author_self=0,
        )
    )

    cohorts.append(
        _candidate(
            slug="small-generative",
            started=200,
            completed=130,
            unique=40,
            children=12,
            continuations=9,
            child_authors=[f"ext-auth-{i}" for i in range(9)] + ["ext-auth-0", "ext-auth-1", "ext-auth-2"],
            published_at=now - timedelta(days=40),
            evaluated_at=now,
        )
    )

    cohorts.append(
        _candidate(
            slug="tiny-perfect",
            started=2,
            completed=2,
            unique=2,
            published_at=now - timedelta(days=8),
            evaluated_at=now,
        )
    )
    cohorts.append(
        _candidate(
            slug="sample-five-perfect",
            started=5,
            completed=5,
            unique=5,
            published_at=now - timedelta(days=8),
            evaluated_at=now,
        )
    )
    cohorts.append(
        _candidate(
            slug="sample-twenty-perfect",
            started=20,
            completed=20,
            unique=20,
            published_at=now - timedelta(days=12),
            evaluated_at=now,
        )
    )
    supported = _candidate(
        slug="supported-engagement",
        started=80,
        completed=56,
        unique=40,
        published_at=now - timedelta(days=90),
        evaluated_at=now,
    )
    cohorts.append(
        _overlay_counts(
            supported,
            public_started=10_000,
            public_completed=7_000,
            ranking_started=10_000,
            ranking_completed=7_000,
            unique_auth=80,
            author_self=0,
        )
    )
    mid = _candidate(
        slug="sample-seven-hundred",
        started=40,
        completed=28,
        unique=30,
        published_at=now - timedelta(days=50),
        evaluated_at=now,
    )
    cohorts.append(
        _overlay_counts(
            mid,
            public_started=1_000,
            public_completed=700,
            ranking_started=1_000,
            ranking_completed=700,
            unique_auth=60,
            author_self=0,
        )
    )

    self_play = _candidate(
        slug="self-play-heavy",
        started=50,
        completed=30,
        unique=20,
        started_ids=[f"ext-{i}" for i in range(50)],
        completed_ids=[f"ext-{i}" for i in range(30)],
        published_at=now - timedelta(days=20),
        evaluated_at=now,
    )
    cohorts.append(
        _overlay_counts(
            self_play,
            public_started=500,
            public_completed=480,
            ranking_started=50,
            ranking_completed=30,
            unique_auth=20,
            author_self=450,
        )
    )

    cohorts.append(
        _candidate(
            slug="child-self-farm",
            started=40,
            completed=20,
            unique=15,
            children=20,
            child_authors=[AUTHOR] * 18 + ["farm-ext", "farm-ext"],
            published_at=now - timedelta(days=60),
            evaluated_at=now,
        )
    )
    cohorts.append(
        _candidate(
            slug="external-diversity",
            started=40,
            completed=20,
            unique=15,
            children=8,
            child_authors=["div-a", "div-b", "div-c", "div-d", "div-e", "div-f", "div-a", AUTHOR],
            published_at=now - timedelta(days=60),
            evaluated_at=now,
        )
    )

    cohorts.append(
        _candidate(
            slug="auth-concentrated",
            started=100,
            completed=80,
            unique=1,
            started_ids=["one-acct"] * 100,
            completed_ids=["one-acct"] * 80,
            published_at=now - timedelta(days=25),
            evaluated_at=now,
        )
    )
    cohorts.append(
        _candidate(
            slug="auth-diverse",
            started=100,
            completed=80,
            unique=70,
            published_at=now - timedelta(days=25),
            evaluated_at=now,
        )
    )

    cohorts.append(
        _candidate(
            slug="historical-yansi",
            started=0,
            completed=0,
            children=10,
            child_authors=[f"hist-ext-{i}" for i in range(10)],
            published_at=now - timedelta(days=500),
            evaluated_at=now,
        )
    )
    cohorts.append(
        _candidate(
            slug="new-yansi",
            started=0,
            completed=0,
            published_at=now - timedelta(hours=6),
            evaluated_at=now,
        )
    )

    old_vol = _candidate(
        slug="old-high-volume",
        started=80,
        completed=40,
        unique=30,
        published_at=now - timedelta(days=800),
        evaluated_at=now,
    )
    cohorts.append(
        _overlay_counts(
            old_vol,
            public_started=40_000,
            public_completed=18_000,
            ranking_started=40_000,
            ranking_completed=18_000,
            unique_auth=120,
            author_self=0,
        )
    )

    skip_row = _candidate(
        slug="skip-and-complete",
        started=80,
        completed=50,
        skipped=30,
        unique=25,
        published_at=now - timedelta(days=18),
        evaluated_at=now,
    )
    cohorts.append(skip_row)

    cohorts.append(
        _candidate(
            slug="replay-length-six",
            started=30,
            completed=18,
            unique=18,
            selected_count=6,
            published_at=now - timedelta(days=22),
            evaluated_at=now,
        )
    )
    cohorts.append(
        _candidate(
            slug="replay-length-eight",
            started=30,
            completed=18,
            unique=18,
            selected_count=8,
            published_at=now - timedelta(days=22),
            evaluated_at=now,
        )
    )

    scope = _candidate(
        slug="scope-incompatible",
        started=80,
        completed=40,
        unique=25,
        children=6,
        child_authors=[f"scope-ext-{i}" for i in range(6)],
        version=2,
        published_at=now - timedelta(days=100),
        evaluated_at=now,
    )
    cohorts.append(scope)

    cohorts.append(
        _candidate(
            slug="engagement-without-generativity",
            started=80,
            completed=64,
            unique=40,
            published_at=now - timedelta(days=35),
            evaluated_at=now,
        )
    )
    cohorts.append(
        _overlay_counts(
            _candidate(
                slug="supported-engagement-without-gen",
                started=60,
                completed=45,
                unique=30,
                published_at=now - timedelta(days=70),
                evaluated_at=now,
            ),
            public_started=800,
            public_completed=600,
            ranking_started=800,
            ranking_completed=600,
            unique_auth=50,
        )
    )
    cohorts.append(
        _candidate(
            slug="generativity-without-strong-engagement",
            started=40,
            completed=12,
            unique=20,
            children=11,
            continuations=8,
            child_authors=[f"prop-{i}" for i in range(8)] + ["prop-0", "prop-1", "prop-2"],
            published_at=now - timedelta(days=45),
            evaluated_at=now,
        )
    )
    cohorts.append(
        _candidate(
            slug="balanced-reference",
            started=180,
            completed=110,
            unique=50,
            children=7,
            continuations=6,
            child_authors=[f"bal-{i}" for i in range(6)] + ["bal-0"],
            published_at=now - timedelta(days=55),
            evaluated_at=now,
        )
    )
    return cohorts


def _positions(result: dict[str, Any]) -> dict[str, int]:
    return {
        item["slug"]: int(item["ordinal"])
        for item in result.get("orderedCandidates") or []
    }


def _family_kind(row: dict[str, Any]) -> str:
    if row.get("candidateState") == "HISTORICAL_ONLY":
        return "historical-only"
    if row.get("candidateState") == "INSUFFICIENT_EVIDENCE":
        return "evidence-poor"
    if row.get("smallSample") is True:
        return "low-sample"
    bucket = row.get("profileBucket")
    if bucket == "engagementHeavy":
        return "engagement-only"
    if bucket == "generativityHeavy":
        return "generativity-only"
    if bucket == "mixed":
        return "mixed"
    if bucket == "attractionOnly":
        return "attraction-only"
    return str(bucket or "unclassified")


def _pairwise_agreement(
    positions: dict[str, int],
    volumes: dict[str, float],
    *,
    series_key: str = "default",
) -> dict[str, Any]:
    return pairwise_volume_agreement_diagnostic(
        positions,
        volumes,
        series_key=series_key,
        warning_ratio=DEPENDENCE_WARNING_RATIO,
    )


def _series_from_candidates(candidates: Sequence[dict[str, Any]]) -> dict[str, dict[str, float]]:
    out = {
        "publicStartedCount": {},
        "rankingEligibleStartedCount": {},
        "directChildYansiCount": {},
        "externalDirectChildYansiCount": {},
        "distinctExternalChildAuthorCount": {},
        "ageDays": {},
    }
    for row in candidates:
        slug = str(row.get("slug") or "")
        out["publicStartedCount"][slug] = float(
            _int(_nested(row, "attractionEvidence", "publicStartedCount"))
        )
        out["rankingEligibleStartedCount"][slug] = float(
            _int(_nested(row, "selfInteraction", "rankingEligibleStartedCount"))
        )
        gen = row.get("generativityEvidence") or {}
        out["directChildYansiCount"][slug] = float(_int(gen.get("directChildYansiCount")))
        out["externalDirectChildYansiCount"][slug] = float(
            _int(gen.get("externalDirectChildYansiCount"))
        )
        out["distinctExternalChildAuthorCount"][slug] = float(
            _int(gen.get("distinctExternalChildAuthorCount"))
        )
        age = _nested(row, "normalizationContext", "ageContext", "ageDays")
        if isinstance(age, (int, float)):
            out["ageDays"][slug] = float(age)
    return out


def _nested(payload: Any, *path: str, default: Any = None) -> Any:
    cur = payload
    for key in path:
        if not isinstance(cur, dict) or key not in cur:
            return default
        cur = cur[key]
    return cur


def _before(positions: dict[str, int], left: str, right: str) -> str | None:
    if left not in positions or right not in positions:
        return None
    if positions[left] < positions[right]:
        return left
    if positions[right] < positions[left]:
        return right
    return "tie"


def _behavior_rows(shadow: dict[str, Any]) -> list[dict[str, Any]]:
    by_strategy = {row["strategy"]: _positions(row) for row in shadow.get("results") or []}
    specs = (
        {
            "id": "tiny_perfect_vs_supported_engagement",
            "left": "tiny-perfect",
            "right": "supported-engagement",
            "expectation": "tiny_perfect_must_not_lead_on_rate_alone",
            "strategies": list(RANKING_STRATEGIES),
        },
        {
            "id": "self_farm_vs_external_diversity",
            "left": "child-self-farm",
            "right": "external-diversity",
            "expectation": "raw_child_count_must_not_define_generativity",
            "strategies": ["generativity_led", "balanced_evidence"],
        },
        {
            "id": "mass_popularity_vs_small_generative",
            "left": "mass-popularity",
            "right": "small-generative",
            "expectation": "start_volume_must_not_automatically_dominate_external_generativity",
            "strategies": ["balanced_evidence", "generativity_led", "engagement_led"],
        },
        {
            "id": "auth_concentration_vs_diverse",
            "left": "auth-concentrated",
            "right": "auth-diverse",
            "expectation": "unique_auth_confidence_may_distinguish_without_inventing_guests",
            "strategies": ["evidence_stability"],
        },
    )
    rows = []
    for spec in specs:
        per = []
        for strategy in spec["strategies"]:
            pos = by_strategy.get(strategy) or {}
            leader = _before(pos, spec["left"], spec["right"])
            per.append(
                {
                    "strategy": strategy,
                    "leader": leader,
                    "leftOrdinal": pos.get(spec["left"]),
                    "rightOrdinal": pos.get(spec["right"]),
                }
            )
        rows.append({**spec, "observations": per})
    return rows


def _strategy_differentiation(shadow: dict[str, Any]) -> dict[str, Any]:
    results = list(shadow.get("results") or [])
    pairs = []
    for left, right in combinations(results, 2):
        pos_l = _positions(left)
        pos_r = _positions(right)
        shared = sorted(set(pos_l) & set(pos_r))
        deltas = [abs(pos_l[slug] - pos_r[slug]) for slug in shared]
        avg = (sum(deltas) / len(deltas)) if deltas else None
        mx = max(deltas) if deltas else None
        k_block = []
        flags = []
        if left["strategy"] != right["strategy"] and (
            [item["slug"] for item in left.get("orderedCandidates") or []]
            == [item["slug"] for item in right.get("orderedCandidates") or []]
        ):
            flags.append("LOW_STRATEGY_DIFFERENTIATION")
        for k in EVAL_TOP_K:
            top_l = {item["slug"] for item in (left.get("orderedCandidates") or [])[:k]}
            top_r = {item["slug"] for item in (right.get("orderedCandidates") or [])[:k]}
            overlap = len(top_l & top_r)
            k_block.append(
                {
                    "k": k,
                    "overlapCount": overlap,
                    "onlyLeft": sorted(top_l - top_r),
                    "onlyRight": sorted(top_r - top_l),
                }
            )
            bound = min(k, len(top_l), len(top_r))
            if (
                bound >= 5
                and overlap == bound
                and avg is not None
                and avg <= LOW_DIFFERENTIATION_AVG_ABS_DELTA
            ):
                if "LOW_STRATEGY_DIFFERENTIATION" not in flags:
                    flags.append("LOW_STRATEGY_DIFFERENTIATION")
        pairs.append(
            {
                "left": left["strategy"],
                "right": right["strategy"],
                "averageAbsPositionDelta": avg,
                "maxAbsPositionDelta": mx,
                "topK": k_block,
                "flags": flags,
            }
        )
    return {
        "pairs": pairs,
        "lowDifferentiationAvgAbsDeltaThreshold": LOW_DIFFERENTIATION_AVG_ABS_DELTA,
        "thresholdKind": "engineering_warning_not_quality",
    }


def _family_representation(
    candidates: Sequence[dict[str, Any]], result: dict[str, Any]
) -> dict[str, Any]:
    by_slug = {str(row.get("slug")): row for row in candidates}
    ordered = result.get("orderedCandidates") or []
    k_rows = []
    flags = []
    for k in EVAL_TOP_K:
        slice_items = ordered[:k]
        dist: dict[str, int] = {}
        for item in slice_items:
            kind = _family_kind(by_slug.get(item["slug"]) or item)
            dist[kind] = dist.get(kind, 0) + 1
        n = len(slice_items) or 1
        if dist.get("engagement-only", 0) / n >= TOP_K_FAMILY_DOMINANCE_SHARE:
            flags.append(f"ENGAGEMENT_DOMINATED_TOP_{k}")
        if dist.get("generativity-only", 0) / n >= TOP_K_FAMILY_DOMINANCE_SHARE:
            flags.append(f"GENERATIVITY_DOMINATED_TOP_{k}")
        if dist.get("low-sample", 0) / n >= TOP_K_FAMILY_DOMINANCE_SHARE:
            flags.append(f"LOW_SAMPLE_DOMINATED_TOP_{k}")
        k_rows.append({"k": k, "distribution": dist, "n": len(slice_items)})
    return {
        "topK": k_rows,
        "flags": flags,
        "dominanceShareThreshold": TOP_K_FAMILY_DOMINANCE_SHARE,
        "thresholdKind": "engineering_warning_not_quality",
    }


def _popularity_verdict(
    strategy: str,
    *,
    observations: list[dict[str, Any]],
    start_dep: dict[str, Any],
) -> str:
    if strategy == "control_input_order":
        return "NOT ENOUGH EVIDENCE"
    mass = None
    tiny = None
    farm = None
    for row in observations:
        for item in row.get("observations") or []:
            if item.get("strategy") != strategy:
                continue
            if row["id"] == "mass_popularity_vs_small_generative":
                mass = item.get("leader")
            if row["id"] == "tiny_perfect_vs_supported_engagement":
                tiny = item.get("leader")
            if row["id"] == "self_farm_vs_external_diversity":
                farm = item.get("leader")
    high_start = start_dep.get("dependence") == "HIGH_MONOTONIC_DEPENDENCE"
    if strategy == "engagement_led":
        if mass == "mass-popularity" and high_start:
            return "DEPENDENT"
        if mass == "mass-popularity" or high_start:
            return "PARTIAL"
        return "PARTIAL"
    if strategy == "evidence_stability":
        return "PARTIAL"
    mass_ok = mass == "small-generative"
    tiny_ok = tiny == "supported-engagement"
    farm_ok = farm in (None, "external-diversity")
    if mass_ok and tiny_ok and farm_ok and not high_start:
        return "PROVEN RESISTANT"
    if mass_ok:
        return "PARTIAL"
    if mass == "mass-popularity":
        return "DEPENDENT"
    return "NOT ENOUGH EVIDENCE"


def _strengths_limitations(strategy: str, verdict: str, family_flags: list[str]) -> tuple[list[str], list[str]]:
    strengths = {
        "control_input_order": [
            "preserves input order as a non-popularity reference",
            "shows whether other strategies actually move anyone",
        ],
        "balanced_evidence": [
            "multi-family coverage leads; no weighted composite",
            "external generativity and sample support are both visible",
            "start volume is last among semantic keys",
        ],
        "generativity_led": [
            "external author diversity leads over raw child count",
            "ignores start-volume as a leading key",
            "scope-incompatible conversion rates are not used",
        ],
        "engagement_led": [
            "sample support leads so tiny perfect rates cannot dominate",
            "skip is not subtracted as a penalty",
        ],
        "evidence_stability": [
            "unique authenticated viewers are treated as confidence",
            "author self-play is removed from unique-auth confidence",
            "unsuitable as the sole curiosity order",
        ],
    }[strategy]
    limitations = {
        "control_input_order": [
            "not a curiosity ranking",
            "slug/input order can bury generative evidence",
        ],
        "balanced_evidence": [
            "lexicographic family-count still prefers mixed profiles by construction",
            "guest uniqueness remains UNAVAILABLE",
        ],
        "generativity_led": [
            "weaker engagement representation",
            "historical children without starts can still surface",
        ],
        "engagement_led": [
            "sample-size leaderboard risk versus start volume",
            "weak generativity representation",
        ],
        "evidence_stability": [
            "can track unique-auth / sample size more than curiosity families",
            "cannot claim unique guest humans",
        ],
    }[strategy]
    if verdict == "DEPENDENT":
        limitations = ["raw start-volume dependence observed on this cohort", *limitations]
    if any("ENGAGEMENT_DOMINATED" in flag for flag in family_flags):
        limitations = ["top-K is engagement-heavy on this cohort", *limitations]
    if any("GENERATIVITY_DOMINATED" in flag for flag in family_flags):
        limitations = ["top-K is generativity-heavy on this cohort", *limitations]
    return strengths, limitations


def _apply_perturbation(row: dict[str, Any], kind: str) -> dict[str, Any]:
    out = copy.deepcopy(row)
    if kind == "starts":
        return _overlay_counts(
            out,
            ranking_started=_int(out["selfInteraction"]["rankingEligibleStartedCount"]) + 50,
            public_started=_int(out["attractionEvidence"]["publicStartedCount"]) + 50,
            ranking_completed=_int(out["engagementEvidence"]["rankingEligibleCompletedCount"]),
        )
    if kind == "completions":
        current = _int(out["engagementEvidence"]["rankingEligibleCompletedCount"])
        ceiling = _int(out["selfInteraction"]["rankingEligibleStartedCount"])
        return _overlay_counts(out, ranking_completed=min(ceiling, current + 10))
    if kind == "external_children":
        gen = out["generativityEvidence"]
        gen["externalDirectChildYansiCount"] = _int(gen.get("externalDirectChildYansiCount")) + 2
        gen["directChildYansiCount"] = _int(gen.get("directChildYansiCount")) + 2
        if gen.get("status") in (None, "UNAVAILABLE"):
            gen["status"] = "AVAILABLE"
        return out
    if kind == "external_authors":
        gen = out["generativityEvidence"]
        gen["distinctExternalChildAuthorCount"] = _int(gen.get("distinctExternalChildAuthorCount")) + 2
        if gen.get("status") in (None, "UNAVAILABLE"):
            gen["status"] = "AVAILABLE"
        return out
    if kind == "continuations":
        gen = out["generativityEvidence"]
        gen["rankingEligibleContinuationCount"] = _int(gen.get("rankingEligibleContinuationCount")) + 3
        if gen.get("status") in (None, "UNAVAILABLE"):
            gen["status"] = "AVAILABLE"
        return out
    if kind == "age_only":
        age = out.setdefault("normalizationContext", {}).setdefault("ageContext", {})
        days = age.get("ageDays") or 0
        age["ageDays"] = float(days) + 365.0
        return out
    if kind == "author_self_play_only":
        ranking = _int(out["selfInteraction"]["rankingEligibleStartedCount"])
        completed = _int(out["engagementEvidence"]["rankingEligibleCompletedCount"])
        unique = _int(out["uniqueViewerEvidence"]["uniqueAuthenticatedStartedViewerCount"])
        return _overlay_counts(
            out,
            public_started=_int(out["attractionEvidence"]["publicStartedCount"]) + 400,
            ranking_started=ranking,
            ranking_completed=completed,
            unique_auth=unique + 1,
            author_self=_int(out["selfInteraction"]["authorSelfStartedSessions"]) + 400,
        )
    raise ValueError(kind)


def _sensitivity(
    candidates: Sequence[dict[str, Any]], *, strategies: Sequence[ShadowStrategy]
) -> list[dict[str, Any]]:
    focus = [
        "balanced-reference",
        "small-generative",
        "mass-popularity",
        "engagement-without-generativity",
    ]
    by_slug = {str(row.get("slug")): row for row in candidates}
    traces = []
    for slug in focus:
        base = by_slug.get(slug)
        if base is None or not base.get("inCandidatePool"):
            continue
        for kind in (
            "starts",
            "completions",
            "external_children",
            "external_authors",
            "continuations",
            "age_only",
            "author_self_play_only",
        ):
            mutated = _apply_perturbation(base, kind)
            others = [row for row in candidates if str(row.get("slug")) != slug]
            sample = others + [mutated]
            for strategy in strategies:
                before = [
                    item["slug"]
                    for item in order_shadow_candidates(candidates, strategy=strategy)
                ]
                after = [
                    item["slug"]
                    for item in order_shadow_candidates(sample, strategy=strategy)
                ]
                b_pos = before.index(slug) + 1 if slug in before else None
                a_pos = after.index(slug) + 1 if slug in after else None
                traces.append(
                    {
                        "slug": slug,
                        "dimension": kind,
                        "strategy": strategy,
                        "ordinalBefore": b_pos,
                        "ordinalAfter": a_pos,
                        "delta": (
                            None if b_pos is None or a_pos is None else a_pos - b_pos
                        ),
                    }
                )
    return traces


def evaluate_strong_curiosity_shadow(
    candidates: Sequence[dict[str, Any]] | None = None,
    *,
    evaluated_at: datetime | None = None,
    corpus_cap: int = MAX_DISCOVER_ELIGIBLE_LOAD,
) -> dict[str, Any]:
    """
    Internal structured evaluation. No public DTO. No automatic winner.
    """
    now = evaluated_at or NOW
    rows = list(candidates) if candidates is not None else build_phase74_reference_cohorts(
        evaluated_at=now
    )
    shadow = run_shadow_on_candidates(rows, corpus_cap=corpus_cap)
    series = _series_from_candidates(rows)
    behaviors = _behavior_rows(shadow)
    differentiation = _strategy_differentiation(shadow)
    sensitivity = _sensitivity(rows, strategies=SHADOW_STRATEGIES)

    strategy_reports = []
    popularity = []
    family_rep = []
    for result in shadow.get("results") or []:
        strategy = result["strategy"]
        pos = _positions(result)
        deps = {
            name: _pairwise_agreement(pos, values, series_key=f"{strategy}:{name}")
            for name, values in series.items()
            if values
        }
        family = _family_representation(rows, result)
        verdict = _popularity_verdict(
            strategy,
            observations=behaviors,
            start_dep=deps.get("rankingEligibleStartedCount") or {},
        )
        flags = list(family.get("flags") or [])
        start_flag = deps.get("rankingEligibleStartedCount", {}).get("dependence")
        if start_flag == "HIGH_MONOTONIC_DEPENDENCE":
            flags.append("HIGH_MONOTONIC_DEPENDENCE")
            flags.append("EVIDENCE_VOLUME_DOMINATED_TOP_K")
        strengths, limitations = _strengths_limitations(strategy, verdict, flags)
        report = {
            "strategy": strategy,
            "evaluatedCount": result.get("diagnostics", {}).get("poolCount"),
            "topKSummaries": [
                {
                    "k": k,
                    "slugs": [item["slug"] for item in (result.get("orderedCandidates") or [])[:k]],
                }
                for k in EVAL_TOP_K
            ],
            "evidenceFamilyDistribution": family,
            "dependenceDiagnostics": deps,
            "pathologyReasonCodes": flags,
            "rawPopularityDominance": verdict,
            "strengths": strengths,
            "limitations": limitations,
            "automaticWinner": False,
        }
        _assert_no_score_fields(report)
        strategy_reports.append(report)
        popularity.append({"strategy": strategy, "series": deps, "verdict": verdict})
        family_rep.append({"strategy": strategy, **family})

    pool = [row for row in rows if row.get("inCandidatePool")]
    new_rows = [row for row in rows if row.get("slug") == "new-yansi"]
    hist_rows = [row for row in rows if row.get("candidateState") == "HISTORICAL_ONLY"]
    new_yansi = new_rows[0] if new_rows else None
    historical = hist_rows[0] if hist_rows else None

    tiny_findings = []
    for result in shadow.get("results") or []:
        pos = _positions(result)
        leader = _before(pos, "tiny-perfect", "supported-engagement")
        tiny_findings.append(
            {
                "strategy": result["strategy"],
                "leader": leader,
                "tinyOrdinal": pos.get("tiny-perfect"),
                "supportedOrdinal": pos.get("supported-engagement"),
                "rateAloneWouldPreferTiny": True,
                "observedPrefersTiny": leader == "tiny-perfect",
            }
        )

    self_play_findings = _self_play_invariance(rows)
    age_findings = _age_only_invariance(rows)
    skip_findings = _skip_invariance(rows)
    selected_findings = _selected_count_invariance(rows)

    blockers = [
        "NO_AUTOMATIC_WINNER",
        "LIVE_STRONG_CURIOSITY_REMAINS_PLACEHOLDER",
        "GUEST_UNIQUE_HUMAN_UNAVAILABLE",
        "CORPUS_BOUND_10000",
        "NO_LIMITED_LIVE_EXPERIMENT_WITHOUT_PRODUCT_CHOICE",
    ]

    payload = {
        "evaluatedAt": now.isoformat(),
        "corpusSize": len(rows),
        "poolCount": len(pool),
        "corpusBound": True,
        "corpusCap": int(corpus_cap),
        "liveRanking": False,
        "public": False,
        "automaticWinner": False,
        "recommendedLiveStrategy": None,
        "phase73SemanticKeys": PHASE73_SEMANTIC_KEYS,
        "dependenceWarningThreshold": DEPENDENCE_WARNING_RATIO,
        "dependenceThresholdKind": "engineering_warning_not_quality",
        "strategyReports": strategy_reports,
        "pairwiseComparisons": behaviors,
        "popularityDependence": popularity,
        "familyRepresentation": family_rep,
        "strategyDifferentiation": differentiation,
        "smallSampleFindings": tiny_findings,
        "selfPlayFindings": self_play_findings,
        "historicalGapFindings": {
            "historicalSlug": historical.get("slug") if historical else None,
            "historicalState": historical.get("candidateState") if historical else None,
            "historicalRateNull": (
                _nested(historical, "generativityEvidence", "childGenerationRateCandidate", "rawRate")
                is None
                if historical
                else None
            ),
            "newSlug": new_yansi.get("slug") if new_yansi else None,
            "newState": new_yansi.get("candidateState") if new_yansi else None,
            "newInPool": bool(new_yansi and new_yansi.get("inCandidatePool")),
            "newQualityLabel": None,
            "newClassifiedAsBad": False,
            "ageDecayUsed": False,
            "freshnessBoostUsed": False,
        },
        "sensitivityFindings": sensitivity,
        "ageFindings": age_findings,
        "skipFindings": skip_findings,
        "selectedCountFindings": selected_findings,
        "guestLimitations": {
            "guestUniqueHuman": "UNAVAILABLE",
            "fingerprinting": False,
            "rankingEligibleSessionsMayIncludeGuestRepeats": True,
            "strategiesUsingRankingEligibleSessionVolume": [
                "engagement_led",
                "balanced_evidence",
                "evidence_stability",
            ],
        },
        "diagnostics": {
            "phase73StrategiesUnchanged": True,
            "compositeFormula": False,
            "inventedRateInterval": False,
            "shadowReuse": True,
        },
        "blockers": blockers,
        "limitedLiveExperiment": "NO-GO",
    }
    _assert_no_score_fields(payload)
    return payload


def _self_play_invariance(candidates: Sequence[dict[str, Any]]) -> dict[str, Any]:
    by_slug = {str(row.get("slug")): row for row in candidates}
    base = by_slug.get("self-play-heavy")
    if base is None:
        return {"available": False}
    ranking_started = _int(base["selfInteraction"]["rankingEligibleStartedCount"])
    ranking_completed = _int(base["engagementEvidence"]["rankingEligibleCompletedCount"])
    unique = _int(base["uniqueViewerEvidence"]["uniqueAuthenticatedStartedViewerCount"])
    self_n = _int(base["selfInteraction"]["authorSelfStartedSessions"])
    ranking_unique = unique - 1 if self_n >= 1 and unique >= 1 else unique
    clean = _overlay_counts(
        base,
        public_started=ranking_started,
        ranking_started=ranking_started,
        ranking_completed=ranking_completed,
        unique_auth=ranking_unique,
        author_self=0,
    )
    dirty = base
    others = [row for row in candidates if row.get("slug") != "self-play-heavy"]
    per = []
    for strategy in RANKING_STRATEGIES:
        clean_order = [
            item["slug"]
            for item in order_shadow_candidates(others + [clean], strategy=strategy)
        ]
        dirty_order = [
            item["slug"]
            for item in order_shadow_candidates(others + [dirty], strategy=strategy)
        ]
        per.append(
            {
                "strategy": strategy,
                "improvedBySelfPlay": (
                    clean_order.index("self-play-heavy") > dirty_order.index("self-play-heavy")
                    if "self-play-heavy" in clean_order and "self-play-heavy" in dirty_order
                    else None
                ),
                "identicalPosition": (
                    clean_order.index("self-play-heavy") == dirty_order.index("self-play-heavy")
                    if "self-play-heavy" in clean_order and "self-play-heavy" in dirty_order
                    else None
                ),
            }
        )
    return {"available": True, "publicStartsDirty": 500, "rankingEligibleFixed": 50, "perStrategy": per}


def _invariant_delta(
    candidates: Sequence[dict[str, Any]],
    slug: str,
    mutate: Callable[[dict[str, Any]], dict[str, Any]],
) -> list[dict[str, Any]]:
    by_slug = {str(row.get("slug")): copy.deepcopy(row) for row in candidates}
    if slug not in by_slug:
        return []
    mutated = mutate(by_slug[slug])
    others = [row for row in candidates if row.get("slug") != slug]
    out = []
    for strategy in SHADOW_STRATEGIES:
        before = [
            item["slug"] for item in order_shadow_candidates(candidates, strategy=strategy)
        ]
        after = [
            item["slug"]
            for item in order_shadow_candidates(others + [mutated], strategy=strategy)
        ]
        out.append(
            {
                "strategy": strategy,
                "changed": before != after,
                "slug": slug,
            }
        )
    return out


def _age_only_invariance(candidates: Sequence[dict[str, Any]]) -> dict[str, Any]:
    rows = _invariant_delta(
        candidates,
        "balanced-reference",
        lambda row: _apply_perturbation(row, "age_only"),
    )
    return {"changedAnyRankingStrategy": any(item["changed"] for item in rows if item["strategy"] != "control_input_order"), "perStrategy": rows}


def _skip_invariance(candidates: Sequence[dict[str, Any]]) -> dict[str, Any]:
    def bump_skip(row: dict[str, Any]) -> dict[str, Any]:
        out = copy.deepcopy(row)
        out["engagementEvidence"]["skipNumerator"] = _int(out["engagementEvidence"].get("skipNumerator")) + 20
        out["engagementEvidence"]["skipRawRate"] = 0.9
        return out

    rows = _invariant_delta(candidates, "skip-and-complete", bump_skip)
    return {"changedAnyRankingStrategy": any(item["changed"] for item in rows if item["strategy"] != "control_input_order"), "perStrategy": rows}


def _selected_count_invariance(candidates: Sequence[dict[str, Any]]) -> dict[str, Any]:
    def bump(row: dict[str, Any]) -> dict[str, Any]:
        out = copy.deepcopy(row)
        out["engagementEvidence"]["selectedCount"] = 6
        out.setdefault("normalizationContext", {})["selectedCount"] = 6
        return out

    rows = _invariant_delta(candidates, "replay-length-eight", bump)
    return {"changedAnyRankingStrategy": any(item["changed"] for item in rows if item["strategy"] != "control_input_order"), "perStrategy": rows}


async def evaluate_discover_shadow_corpus(
    db: AsyncSession,
    *,
    evaluated_at: datetime | None = None,
) -> dict[str, Any]:
    """
    Optional DB path: reuse Phase 7.3 pool/shadow, then evaluate.
    Not a public route. Not called by public Discover listing.
    """
    from backend.services.mirror_network.yansi_strong_curiosity_candidate import (
        evaluate_discover_strong_curiosity_pool,
    )

    pool = await evaluate_discover_strong_curiosity_pool(db, evaluated_at=evaluated_at)
    return evaluate_strong_curiosity_shadow(
        pool.get("items") or [],
        evaluated_at=evaluated_at,
    )
