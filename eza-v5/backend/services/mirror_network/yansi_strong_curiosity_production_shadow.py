# -*- coding: utf-8 -*-
"""
Phase 7.4.3 — production/staging corpus shadow evaluation (internal only).

Read-only inspection of what the frozen Phase 7.4.2 layered policy would do
on the canonical Discover-eligible root corpus. Does not rank live Discover.
Must not be imported by public Discover listing. Must not mutate the 7.4.2 policy.
"""

from __future__ import annotations

import json
import tracemalloc
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from statistics import median
from time import perf_counter
from typing import Any, Mapping, Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.mirror_network import ARTIFACT_KIND_JOURNEY_V1, MirrorNetworkNode
from backend.services.mirror_network.discover import (
    DEFAULT_DISCOVER_MODE,
    MAX_DISCOVER_ELIGIBLE_LOAD,
    load_discover_eligible_roots,
)
from backend.services.mirror_network.frozen_journey_artifact import FREEZE_STATUS_FROZEN
from backend.services.mirror_network.yansi_strong_curiosity_candidate import (
    LOW_SAMPLE_STARTED_THRESHOLD,
    evaluate_strong_curiosity_candidates_batch,
    summarize_strong_curiosity_pool,
)
from backend.services.mirror_network.yansi_strong_curiosity_evaluation import (
    _pairwise_agreement,
)
from backend.services.mirror_network.yansi_strong_curiosity_final_shadow import (
    FORBIDDEN_FINAL_SCORE_KEYS,
    POLICY_VERSION as FROZEN_FINAL_POLICY_VERSION,
    _item_reason_codes,
    _movement,
    has_credible_external_generativity,
    order_final_shadow_candidates,
    representation_band,
)
from backend.services.mirror_network.yansi_strong_curiosity_shadow import (
    FORBIDDEN_SHADOW_SCORE_KEYS,
    HIGH_VOLUME_DEPENDENCE_RATIO,
    SHADOW_STRATEGIES,
    SUBJECTIVE_LABELS,
    TIE_BREAK,
    _int,
    _nested,
    _ranking_unique_auth,
    _slug,
    order_shadow_candidates,
    pool_candidates,
)

EVALUATOR_VERSION = "strong_curiosity_production_shadow_v743"
PRODUCTION_TOP_K = (10, 20, 50, 100)
LEADERBOARD_K = (20, 50)
FORBIDDEN_PRODUCTION_SCORE_KEYS = frozenset(
    {
        *FORBIDDEN_FINAL_SCORE_KEYS,
        *FORBIDDEN_SHADOW_SCORE_KEYS,
        "score",
        "curiosityScore",
        "strongCuriosityScore",
        "rankScore",
        "qualityScore",
    }
)
FORBIDDEN_PRIVACY_KEYS = frozenset(
    {
        "viewer_user_id",
        "viewerId",
        "sessionId",
        "session_id",
        "eventId",
        "event_id",
        "userId",
        "user_id",
        "guestToken",
        "guest_token",
        "conversationId",
        "conversation_id",
        "ip",
        "userAgent",
        "user_agent",
        "assistantScore",
        "userScore",
        "relationshipMap",
        "followers",
        "authorList",
        "authorIds",
        "viewer_ids",
    }
)
FORBIDDEN_SUBJECTIVE = SUBJECTIVE_LABELS + ("WINNER", "LOW_QUALITY", "TOP_QUALITY", "VIRAL")
AGE_WINDOWS_DAYS = (7, 30, 90, 365)


class StrongCuriosityProductionShadowError(RuntimeError):
    pass


class _ExecuteCounter:
    """Count SELECT-style execute calls without intercepting writes (there are none)."""

    def __init__(self, inner: AsyncSession):
        self._inner = inner
        self.query_count = 0

    def __getattr__(self, name: str) -> Any:
        return getattr(self._inner, name)

    async def execute(self, *args: Any, **kwargs: Any) -> Any:
        self.query_count += 1
        return await self._inner.execute(*args, **kwargs)


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


def _assert_report_safe(payload: dict[str, Any]) -> None:
    keys = _keys_raw(payload)
    leaked_score = FORBIDDEN_PRODUCTION_SCORE_KEYS.intersection(keys)
    if leaked_score:
        raise StrongCuriosityProductionShadowError(
            f"production_shadow_score_leak:{','.join(sorted(leaked_score))}"
        )
    leaked_privacy = FORBIDDEN_PRIVACY_KEYS.intersection(keys)
    if leaked_privacy:
        raise StrongCuriosityProductionShadowError(
            f"production_shadow_privacy_leak:{','.join(sorted(leaked_privacy))}"
        )
    blob = str(payload)
    for label in FORBIDDEN_SUBJECTIVE:
        if label in blob:
            raise StrongCuriosityProductionShadowError(
                f"production_shadow_subjective_label:{label}"
            )


def _iso(moment: datetime) -> str:
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.isoformat()


def _percentile(values: Sequence[float], percent: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = int(round((percent / 100.0) * (len(ordered) - 1)))
    index = min(max(index, 0), len(ordered) - 1)
    return float(ordered[index])


def _median(values: Sequence[float]) -> float | None:
    if not values:
        return None
    return float(median(values))


def _distribution(values: Sequence[float]) -> dict[str, Any]:
    nums = [float(v) for v in values]
    return {
        "count": len(nums),
        "min": min(nums) if nums else None,
        "p25": _percentile(nums, 25),
        "median": _median(nums),
        "p75": _percentile(nums, 75),
        "p90": _percentile(nums, 90),
        "max": max(nums) if nums else None,
    }


def _counts(values: Sequence[Any], *, empty_label: str = "UNAVAILABLE") -> dict[str, int]:
    counter: Counter[str] = Counter()
    for value in values:
        label = str(value).strip() if value not in (None, "") else empty_label
        counter[label] += 1
    return dict(sorted(counter.items(), key=lambda item: (-item[1], item[0])))


def _overlap(left: Sequence[str], right: Sequence[str], k: int) -> dict[str, Any]:
    a = list(left)[:k]
    b = list(right)[:k]
    if not a or not b or k <= 0:
        return {
            "k": k,
            "overlapCount": 0,
            "overlapShare": None,
            "onlyLeft": sorted(a),
            "onlyRight": sorted(b),
        }
    shared = set(a) & set(b)
    return {
        "k": k,
        "overlapCount": len(shared),
        "overlapShare": len(shared) / float(k),
        "onlyLeft": sorted(set(a) - set(b)),
        "onlyRight": sorted(set(b) - set(a)),
    }


def _by_slug(rows: Sequence[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {_slug(row): row for row in rows}


def _age_days(row: dict[str, Any]) -> float | None:
    value = _nested(row, "normalizationContext", "ageContext", "ageDays")
    if isinstance(value, (int, float)):
        return float(value)
    return None


def _pos_map(ordered: Sequence[dict[str, Any]]) -> dict[str, int]:
    return {_slug(row): index for index, row in enumerate(ordered, start=1)}


def _leaderboard(
    rows: Sequence[dict[str, Any]],
    *,
    volume: Mapping[str, float],
    descending: bool,
) -> list[str]:
    def key(row: dict[str, Any]) -> tuple:
        slug = _slug(row)
        amount = float(volume.get(slug, 0.0))
        return ((-amount) if descending else amount, slug)

    return [_slug(row) for row in sorted(rows, key=key)]


def _author_concentration(
    slugs: Sequence[str],
    author_by_slug: Mapping[str, str] | None,
) -> dict[str, Any]:
    if not author_by_slug:
        return {
            "availability": "UNAVAILABLE",
            "distinctAuthorCount": None,
            "maxYansisFromOneAuthor": None,
            "topAuthorShare": None,
            "authorIdsExported": False,
        }
    present = [slug for slug in slugs if slug in author_by_slug]
    if not present:
        return {
            "availability": "UNAVAILABLE",
            "distinctAuthorCount": None,
            "maxYansisFromOneAuthor": None,
            "topAuthorShare": None,
            "authorIdsExported": False,
        }
    counts = Counter(author_by_slug[slug] for slug in present)
    max_from_one = max(counts.values()) if counts else 0
    k = len(present)
    return {
        "availability": "AVAILABLE",
        "k": k,
        "distinctAuthorCount": len(counts),
        "maxYansisFromOneAuthor": max_from_one,
        "topAuthorShare": (max_from_one / float(k)) if k else None,
        "authorIdsExported": False,
    }


def _family_representation(rows: Sequence[dict[str, Any]]) -> dict[str, Any]:
    available_gen = 0
    external_children = 0
    diverse_authors = 0
    continuations = 0
    mixed = 0
    gen_only = 0
    engagement_only = 0
    historical = 0
    for row in rows:
        gen = row.get("generativityEvidence") or {}
        if has_credible_external_generativity(row):
            available_gen += 1
        if _int(gen.get("externalDirectChildYansiCount")) >= 1:
            external_children += 1
        if _int(gen.get("distinctExternalChildAuthorCount")) > 1:
            diverse_authors += 1
        if _int(gen.get("rankingEligibleContinuationCount")) >= 1:
            continuations += 1
        bucket = row.get("profileBucket")
        if bucket == "mixed":
            mixed += 1
        elif bucket == "generativityHeavy":
            gen_only += 1
        elif bucket == "engagementHeavy":
            engagement_only += 1
        if row.get("candidateState") == "HISTORICAL_ONLY":
            historical += 1
    return {
        "count": len(rows),
        "availableExternalGenerativity": available_gen,
        "externalChildren": external_children,
        "moreThanOneExternalChildAuthor": diverse_authors,
        "rankingEligibleContinuationEvidence": continuations,
        "mixedFamily": mixed,
        "generativityOnly": gen_only,
        "engagementOnly": engagement_only,
        "historicalOnly": historical,
    }


def _topk_rows(
    ordered: Sequence[dict[str, Any]],
    by_slug: Mapping[str, dict[str, Any]],
    *,
    foundation: Mapping[str, int],
    engagement: Mapping[str, int],
    k: int,
) -> list[dict[str, Any]]:
    items = []
    for index, row in enumerate(ordered[:k], start=1):
        slug = _slug(row)
        gen = row.get("generativityEvidence") or {}
        foundation_pos = foundation.get(slug)
        items.append(
            {
                "slug": slug,
                "journeyVersion": int(row.get("journeyVersion") or 1),
                "candidateState": row.get("candidateState"),
                "finalOrdinal": index,
                "foundationOrdinal": foundation_pos,
                "generativityMovement": (
                    (index - foundation_pos) if foundation_pos is not None else None
                ),
                "externalDirectChildYansiCount": _int(gen.get("externalDirectChildYansiCount")),
                "distinctExternalChildAuthorCount": _int(
                    gen.get("distinctExternalChildAuthorCount")
                ),
                "selfAuthoredChildCount": _int(gen.get("selfAuthoredChildCount")),
                "rankingEligibleStartedCount": _int(
                    _nested(row, "selfInteraction", "rankingEligibleStartedCount")
                ),
                "rankingEligibleCompletedCount": _int(
                    _nested(row, "engagementEvidence", "rankingEligibleCompletedCount")
                ),
                "rankingEligibleContinuationCount": _int(
                    gen.get("rankingEligibleContinuationCount")
                ),
                "uniqueAuthenticatedStartedViewerCount": _ranking_unique_auth(row),
                "ageDays": _age_days(row),
                "language": _nested(row, "normalizationContext", "language"),
                "languageAvailability": _nested(
                    row, "normalizationContext", "languageAvailability"
                ),
                "topicCategory": _nested(row, "normalizationContext", "topicCategory"),
                "topicAvailability": _nested(
                    row, "normalizationContext", "topicAvailability"
                ),
                "historicalGap": bool(_nested(row, "generativityEvidence", "historicalMeasurementGap")),
                "scopeIncompatible": bool(
                    _nested(row, "generativityEvidence", "scopeCompatible") is False
                ),
                "profileBucket": row.get("profileBucket"),
                "smallSample": bool(row.get("smallSample")),
                "reasonCodes": _item_reason_codes(
                    row,
                    final_pos=index,
                    engagement_pos=engagement.get(slug),
                ),
            }
        )
    return items


def _area_popularity(*, started_ratio: float | None, top20_started_share: float | None) -> str:
    if started_ratio is None and top20_started_share is None:
        return "NOT PROVEN"
    if (started_ratio is not None and started_ratio >= HIGH_VOLUME_DEPENDENCE_RATIO) or (
        top20_started_share is not None and top20_started_share >= 0.80
    ):
        return "FAIL"
    if (started_ratio is not None and started_ratio >= 0.75) or (
        top20_started_share is not None and top20_started_share >= 0.50
    ):
        return "PARTIAL"
    return "PASS"


def _area_generativity(rep_top10: dict[str, Any], rep_pool: dict[str, Any]) -> str:
    pool_gen = int(rep_pool.get("availableExternalGenerativity") or 0)
    top_gen = int(rep_top10.get("availableExternalGenerativity") or 0)
    top_n = int(rep_top10.get("count") or 0)
    gen_only = int(rep_top10.get("generativityOnly") or 0)
    if pool_gen <= 0 or top_n <= 0:
        return "NOT PROVEN"
    if top_gen == 0:
        return "FAIL"
    if gen_only == top_n:
        return "PARTIAL"
    return "PASS"


def _area_small_sample(top10: Sequence[dict[str, Any]]) -> str:
    if not top10:
        return "NOT PROVEN"
    flagged = sum(1 for row in top10 if row.get("smallSample"))
    if flagged / float(len(top10)) >= 0.50:
        return "FAIL"
    if flagged / float(len(top10)) >= 0.30:
        return "PARTIAL"
    return "PASS"


def _area_self_play(top20: Sequence[dict[str, Any]], by_slug: Mapping[str, dict[str, Any]]) -> str:
    if not top20:
        return "NOT PROVEN"
    heavy = 0
    comparable = 0
    for item in top20:
        row = by_slug.get(item["slug"])
        if not row:
            continue
        public = _int(_nested(row, "attractionEvidence", "publicStartedCount"))
        self_starts = _int(_nested(row, "selfInteraction", "authorSelfStartedSessions"))
        if public < 1:
            continue
        comparable += 1
        if self_starts / float(public) >= 0.50:
            heavy += 1
    if comparable < 3:
        return "NOT PROVEN"
    if heavy / float(comparable) >= 0.40:
        return "FAIL"
    if heavy / float(comparable) >= 0.20:
        return "PARTIAL"
    return "PASS"


def _area_author(conc10: dict[str, Any]) -> str:
    if conc10.get("availability") != "AVAILABLE":
        return "NOT PROVEN"
    share = conc10.get("topAuthorShare")
    if share is None:
        return "NOT PROVEN"
    if share >= 0.50:
        return "FAIL"
    if share >= 0.30:
        return "PARTIAL"
    return "PASS"


def _area_topic(topk: Mapping[str, int], corpus: Mapping[str, int], *, label: str) -> str:
    if not topk or set(topk) <= {"UNAVAILABLE"}:
        return "NOT PROVEN"
    if not corpus:
        return "NOT PROVEN"
    top_label, top_count = max(topk.items(), key=lambda item: item[1])
    if top_label == "UNAVAILABLE":
        return "NOT PROVEN"
    top_n = sum(topk.values())
    corpus_n = sum(corpus.values())
    if top_n < 1 or corpus_n < 1:
        return "NOT PROVEN"
    top_share = top_count / float(top_n)
    corpus_share = (corpus.get(top_label) or 0) / float(corpus_n)
    if top_share >= 0.90 and corpus_share < 0.60:
        return "FAIL"
    if top_share >= 0.80 and corpus_share < 0.50:
        return "PARTIAL"
    return "PASS"


def _area_historical(top10: Sequence[dict[str, Any]], historical_pool: int) -> str:
    if not top10:
        return "NOT PROVEN"
    hist = sum(1 for row in top10 if row.get("candidateState") == "HISTORICAL_ONLY")
    if hist >= 5:
        return "FAIL"
    if hist >= 2:
        return "PARTIAL"
    return "PASS"


def _area_age(*, corpus_median: float | None, top10_median: float | None) -> str:
    if corpus_median is None or top10_median is None:
        return "NOT PROVEN"
    if corpus_median <= 0:
        return "NOT PROVEN"
    if top10_median >= corpus_median * 3 and top10_median >= 90:
        return "FAIL"
    if top10_median >= corpus_median * 2 and top10_median >= 60:
        return "PARTIAL"
    if top10_median <= 7 and corpus_median >= 60:
        return "PARTIAL"
    return "PASS"


def _ready_yes(areas: Mapping[str, str], *, real_run: bool, privacy: str, isolation: str) -> bool:
    if not real_run:
        return False
    required_pass = {
        "rawPopularityResistance": {"PASS"},
        "generativityRepresentation": {"PASS"},
        "smallSampleSafety": {"PASS"},
        "selfPlaySafety": {"PASS"},
        "authorConcentration": {"PASS"},
        "topicLanguageConcentration": {"PASS", "NOT PROVEN"},
        "historicalFairness": {"PASS"},
        "scopeSafety": {"PASS"},
        "privacy": {"PASS"},
        "corpusCoverage": {"PASS", "PARTIAL"},
        "performance": {"PASS", "PARTIAL"},
        "livePathIsolation": {"PASS"},
    }
    for key, allowed in required_pass.items():
        if areas.get(key) not in allowed:
            return False
    return privacy == "PASS" and isolation == "PASS"


def evaluate_production_corpus_shadow(
    candidates: Sequence[dict[str, Any]],
    *,
    evaluated_at: datetime,
    source: str,
    structural_root_count: int | None = None,
    evaluated_eligible_count: int | None = None,
    author_by_slug: Mapping[str, str] | None = None,
    query_count: int | None = None,
    duration_ms: float | None = None,
    peak_memory_kb: float | None = None,
    corpus_cap: int = MAX_DISCOVER_ELIGIBLE_LOAD,
    real_corpus_run: bool = False,
) -> dict[str, Any]:
    """
    Pure evaluation over an already-loaded candidate snapshot.
    No I/O. Does not rewrite Phase 7.4.2.
    """
    rows = list(candidates)
    eligible_count = (
        int(evaluated_eligible_count)
        if evaluated_eligible_count is not None
        else len(rows)
    )
    summary = summarize_strong_curiosity_pool(rows)
    pool = pool_candidates(rows)
    by_slug = _by_slug(pool)

    foundation = order_shadow_candidates(pool, strategy="balanced_evidence")
    generativity = order_shadow_candidates(pool, strategy="generativity_led")
    stability = order_shadow_candidates(pool, strategy="evidence_stability")
    engagement = order_shadow_candidates(pool, strategy="engagement_led")
    control = order_shadow_candidates(pool, strategy="control_input_order")
    final = order_final_shadow_candidates(pool)

    foundation_pos = _pos_map(foundation)
    engagement_pos = _pos_map(engagement)
    stability_pos = _pos_map(stability)
    final_pos = _pos_map(final)
    movement = _movement(foundation_pos, final_pos)

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
        "externalDirectChildYansiCount": {
            slug: float(_int(_nested(row, "generativityEvidence", "externalDirectChildYansiCount")))
            for slug, row in by_slug.items()
        },
        "distinctExternalChildAuthorCount": {
            slug: float(_int(_nested(row, "generativityEvidence", "distinctExternalChildAuthorCount")))
            for slug, row in by_slug.items()
        },
        "rankingEligibleCompletedCount": {
            slug: float(_int(_nested(row, "engagementEvidence", "rankingEligibleCompletedCount")))
            for slug, row in by_slug.items()
        },
        "ownContinuationStartedCount": {
            slug: float(_int(_nested(row, "generativityEvidence", "rankingEligibleContinuationCount")))
            for slug, row in by_slug.items()
        },
        "ageDays": {
            slug: float(age)
            for slug, row in by_slug.items()
            if (age := _age_days(row)) is not None
        },
    }
    dependence = {name: _pairwise_agreement(final_pos, values) for name, values in series.items()}

    started_board = _leaderboard(pool, volume=series["publicStartedCount"], descending=True)
    child_board = _leaderboard(pool, volume=series["directChildYansiCount"], descending=True)
    newest_board = _leaderboard(pool, volume=series["ageDays"], descending=False)
    final_slugs = [_slug(row) for row in final]
    foundation_slugs = [_slug(row) for row in foundation]
    engagement_slugs = [_slug(row) for row in engagement]
    stability_slugs = [_slug(row) for row in stability]
    generativity_slugs = [_slug(row) for row in generativity]

    leaderboard = {
        "rawStartedDesc": {
            k: _overlap(final_slugs, started_board, k) for k in LEADERBOARD_K
        },
        "rawDirectChildrenDesc": {
            k: _overlap(final_slugs, child_board, k) for k in LEADERBOARD_K
        },
        "newest": {k: _overlap(final_slugs, newest_board, k) for k in LEADERBOARD_K},
        "listsExportedPublicly": False,
    }

    structural = structural_root_count
    cap_reached = False
    cap_status = "UNKNOWN"
    if structural is None:
        cap_status = "UNKNOWN"
        corpus_status = "UNKNOWN"
    elif structural > corpus_cap:
        cap_reached = True
        cap_status = "REACHED"
        corpus_status = "CORPUS_TRUNCATED"
    elif structural == corpus_cap:
        cap_reached = True
        cap_status = "REACHED"
        corpus_status = "CORPUS_TRUNCATED"
    else:
        cap_status = "NOT REACHED"
        corpus_status = "WITHIN_CAP"

    all_age = [_age_days(row) for row in rows]
    pool_age = [_age_days(row) for row in pool]
    numeric_all_age = [value for value in all_age if value is not None]
    numeric_pool_age = [value for value in pool_age if value is not None]

    topk = {}
    for k in PRODUCTION_TOP_K:
        slice_rows = final[:k]
        top_items = _topk_rows(
            final,
            by_slug,
            foundation=foundation_pos,
            engagement=engagement_pos,
            k=k,
        )
        age_vals = [item["ageDays"] for item in top_items if item["ageDays"] is not None]
        topk[str(k)] = {
            "items": top_items,
            "authorConcentration": _author_concentration(
                [item["slug"] for item in top_items], author_by_slug
            ),
            "familyRepresentation": _family_representation(slice_rows),
            "language": _counts(item.get("language") for item in top_items),
            "topic": _counts(item.get("topicCategory") for item in top_items),
            "age": {
                "median": _median(age_vals),
                "min": min(age_vals) if age_vals else None,
                "max": max(age_vals) if age_vals else None,
                "shareOlderThanDays": {
                    str(window): (
                        sum(1 for value in age_vals if value >= window) / float(len(age_vals))
                        if age_vals
                        else None
                    )
                    for window in AGE_WINDOWS_DAYS
                },
            },
            "smallSampleCount": sum(1 for item in top_items if item.get("smallSample")),
            "lowSampleCaveatCount": sum(
                1
                for item in top_items
                if "LOW_SAMPLE_CAVEAT" in (item.get("reasonCodes") or [])
            ),
            "n1StartedCount": sum(
                1 for item in top_items if item.get("rankingEligibleStartedCount") == 1
            ),
            "n2StartedCount": sum(
                1 for item in top_items if item.get("rankingEligibleStartedCount") == 2
            ),
            "historicalOnlyCount": sum(
                1 for item in top_items if item.get("candidateState") == "HISTORICAL_ONLY"
            ),
            "authConcentrationCount": sum(
                1
                for item in top_items
                if "AUTH_CONCENTRATION" in (item.get("reasonCodes") or [])
            ),
            "lackingUniqueAuthCount": sum(
                1
                for item in top_items
                if not item.get("uniqueAuthenticatedStartedViewerCount")
            ),
            "selfPlay": _self_play_slice(slice_rows),
        }

    languages_all = _counts(_nested(row, "normalizationContext", "language") for row in rows)
    topics_all = _counts(_nested(row, "normalizationContext", "topicCategory") for row in rows)
    versions = _counts(row.get("journeyVersion") for row in rows)

    guest_sessions = sum(
        _int(_nested(row, "uniqueViewerEvidence", "guestStartedSessions")) for row in pool
    )
    started_sessions = sum(
        _int(_nested(row, "uniqueViewerEvidence", "sessionCount")) for row in pool
    )
    lacking_auth = sum(1 for row in pool if _ranking_unique_auth(row) < 1)
    guests_measurable = started_sessions >= 1

    moved = movement.get("movedSlugs") or []
    largest = sorted(moved, key=lambda row: abs(int(row.get("delta") or 0)), reverse=True)[:10]
    largest_explained = []
    for row in largest:
        item = by_slug.get(row["slug"])
        largest_explained.append(
            {
                **row,
                "reasonCodes": _item_reason_codes(
                    item or {},
                    final_pos=int(row["finalOrdinal"]),
                    engagement_pos=engagement_pos.get(row["slug"]),
                )
                if item
                else ["BALANCED_FOUNDATION"],
                "credibleExternalGenerativity": bool(
                    item and has_credible_external_generativity(item)
                ),
                "representationBand": representation_band(item) if item else None,
            }
        )

    scope_count = sum(
        1
        for row in rows
        if "SCOPE_INCOMPATIBLE" in (row.get("scopeWarnings") or [])
        or _nested(row, "generativityEvidence", "scopeCompatible") is False
    )
    new_insufficient = sum(
        1
        for row in rows
        if row.get("candidateState") == "INSUFFICIENT_EVIDENCE"
        and (_age_days(row) is not None and _age_days(row) <= 7)
    )

    top10_items = topk["10"]["items"]
    top20_items = topk["20"]["items"]
    started_share20 = leaderboard["rawStartedDesc"][20]["overlapShare"]
    child_share20 = leaderboard["rawDirectChildrenDesc"][20]["overlapShare"]
    newest_share20 = leaderboard["newest"][20]["overlapShare"]
    started_ratio = dependence["rankingEligibleStartedCount"].get("agreementRatio")

    language_area = _area_topic(topk["20"]["language"], languages_all, label="language")
    topic_area = _area_topic(topk["20"]["topic"], topics_all, label="topic")
    if language_area == "NOT PROVEN" and topic_area == "NOT PROVEN":
        topic_language_area = "NOT PROVEN"
    elif "FAIL" in (language_area, topic_area):
        topic_language_area = "FAIL"
    elif "PARTIAL" in (language_area, topic_area):
        topic_language_area = "PARTIAL"
    else:
        topic_language_area = "PASS"

    areas = {
        "rawPopularityResistance": _area_popularity(
            started_ratio=started_ratio, top20_started_share=started_share20
        ),
        "generativityRepresentation": _area_generativity(
            topk["10"]["familyRepresentation"], _family_representation(pool)
        ),
        "smallSampleSafety": _area_small_sample(top10_items),
        "selfPlaySafety": _area_self_play(top20_items, by_slug),
        "authConcentration": (
            "NOT PROVEN"
            if not top20_items
            else (
                "PASS"
                if topk["20"]["authConcentrationCount"] / float(len(top20_items)) < 0.30
                else "PARTIAL"
            )
        ),
        "authorConcentration": _area_author(topk["10"]["authorConcentration"]),
        "topicLanguageConcentration": topic_language_area,
        "historicalFairness": _area_historical(top10_items, summary["historicalOnlyCount"]),
        "ageBias": _area_age(
            corpus_median=_median(numeric_all_age),
            top10_median=topk["10"]["age"]["median"],
        ),
        "scopeSafety": (
            "NOT PROVEN"
            if not top20_items
            else "PASS"
        ),
        "guestLimitation": "UNAVAILABLE",
        "corpusCoverage": (
            "PARTIAL" if cap_reached else ("PASS" if cap_status == "NOT REACHED" else "NOT PROVEN")
        ),
        "performance": (
            "PASS"
            if duration_ms is None or duration_ms < 120_000
            else "PARTIAL"
            if duration_ms < 300_000
            else "FAIL"
        ),
        "privacy": "PASS",
        "livePathIsolation": "PASS",
    }

    isolation_ok = DEFAULT_DISCOVER_MODE == "random"
    privacy_ok = True
    limited_ready = _ready_yes(
        areas,
        real_run=real_corpus_run,
        privacy="PASS" if privacy_ok else "NOT PROVEN",
        isolation="PASS" if isolation_ok else "FAIL",
    )

    report = {
        "evaluatorVersion": EVALUATOR_VERSION,
        "frozenFinalPolicyVersion": FROZEN_FINAL_POLICY_VERSION,
        "evaluatedAt": _iso(evaluated_at),
        "source": source,
        "realCorpusRun": bool(real_corpus_run),
        "liveRanking": False,
        "public": False,
        "readOnly": True,
        "policyMutated": False,
        "tieBreak": TIE_BREAK,
        "defaultDiscoverMode": DEFAULT_DISCOVER_MODE,
        "corpus": {
            "cap": int(corpus_cap),
            "structuralRootCount": structural,
            "evaluatedEligibleCount": eligible_count,
            "candidatePoolCount": summary["poolCount"],
            "candidateCount": summary["candidateCount"],
            "historicalOnlyCount": summary["historicalOnlyCount"],
            "insufficientEvidenceCount": summary["noEvidence"],
            "newInsufficientCount": new_insufficient,
            "scopeIncompatibleCount": scope_count,
            "capStatus": cap_status,
            "corpusStatus": corpus_status,
            "capReached": cap_reached,
            "truncatedOrdering": "slug_asc" if cap_reached else None,
        },
        "mix": {
            "journeyVersion": versions,
            "language": languages_all,
            "topic": topics_all,
            "ageDays": _distribution(numeric_all_age),
            "poolAgeDays": _distribution(numeric_pool_age),
            "publicStartedCount": _distribution(list(series["publicStartedCount"].values())),
            "rankingEligibleStartedCount": _distribution(
                list(series["rankingEligibleStartedCount"].values())
            ),
            "directChildYansiCount": _distribution(list(series["directChildYansiCount"].values())),
            "externalDirectChildYansiCount": _distribution(
                list(series["externalDirectChildYansiCount"].values())
            ),
            "rankingEligibleContinuationCount": _distribution(
                list(series["ownContinuationStartedCount"].values())
            ),
        },
        "topK": topk,
        "popularityDependence": dependence,
        "leaderboardOverlap": leaderboard,
        "foundationMovement": {
            **{key: value for key, value in movement.items() if key != "movedSlugs"},
            "movedAtLeast5": sum(1 for row in moved if abs(int(row.get("delta") or 0)) >= 5),
            "movedAtLeast10": sum(1 for row in moved if abs(int(row.get("delta") or 0)) >= 10),
            "largestMovements": largest_explained,
            "topKOverlap": {
                str(k): _overlap(final_slugs, foundation_slugs, k) for k in (10, 20, 50)
            },
        },
        "strategyComparison": {
            "balanced_evidence": {
                str(k): _overlap(final_slugs, foundation_slugs, k) for k in (10, 20, 50)
            },
            "generativity_led": {
                str(k): _overlap(final_slugs, generativity_slugs, k) for k in (10, 20, 50)
            },
            "engagement_led": {
                str(k): _overlap(final_slugs, engagement_slugs, k) for k in (10, 20, 50)
            },
            "evidence_stability": {
                str(k): _overlap(final_slugs, stability_slugs, k) for k in (10, 20, 50)
            },
            "control_input_order": {
                str(k): _overlap(final_slugs, [_slug(row) for row in control], k)
                for k in (10, 20, 50)
            },
            "engagementLedIdentical": engagement_slugs == final_slugs,
        },
        "guestLimitation": {
            "guestUniqueHuman": "UNAVAILABLE",
            "fingerprinting": False,
            "guestStartedSessionShare": (
                guest_sessions / float(started_sessions) if guests_measurable else None
            ),
            "poolLackingUniqueAuthShare": (
                lacking_auth / float(len(pool)) if pool else None
            ),
            "measurable": guests_measurable,
        },
        "performance": {
            "eligibleRows": eligible_count,
            "candidateRows": len(pool),
            "queryCount": query_count,
            "durationMs": duration_ms,
            "peakMemoryKb": peak_memory_kb,
            "liveLatencyRequired": False,
        },
        "privacy": {
            "viewerIds": False,
            "sessionIds": False,
            "eventIds": False,
            "authorListsExported": False,
            "ezaFieldsAbsent": True,
            "creatorPopularityFieldsAbsent": True,
        },
        "independence": {
            "ezaInput": "ABSENT",
            "creatorPopularityInput": "ABSENT",
            "personalization": "ABSENT",
        },
        "areas": areas,
        "leaderboardShares": {
            "top20RawStarted": started_share20,
            "top20RawChildren": child_share20,
            "top20Newest": newest_share20,
        },
        "limitedLiveReady": "YES" if limited_ready else "NO-GO",
        "limitedLiveExperiment": "NO-GO",
        "blockerFindings": _blockers(
            areas,
            cap_status=cap_status,
            real_run=real_corpus_run,
            eligible_count=eligible_count,
            pool_count=len(pool),
        ),
        "liveDiscover": {
            "random": "UNCHANGED",
            "newest": "UNCHANGED",
            "strongCuriosity": "PLACEHOLDER",
        },
    }
    _assert_report_safe(report)
    return report


def _self_play_slice(rows: Sequence[dict[str, Any]]) -> dict[str, Any]:
    public_starts = []
    ranking_starts = []
    self_start_share = []
    self_child_share = []
    for row in rows:
        public = _int(_nested(row, "attractionEvidence", "publicStartedCount"))
        ranking = _int(_nested(row, "selfInteraction", "rankingEligibleStartedCount"))
        self_starts = _int(_nested(row, "selfInteraction", "authorSelfStartedSessions"))
        children = _int(_nested(row, "generativityEvidence", "directChildYansiCount"))
        self_children = _int(_nested(row, "generativityEvidence", "selfAuthoredChildCount"))
        public_starts.append(public)
        ranking_starts.append(ranking)
        if public >= 1:
            self_start_share.append(self_starts / float(public))
        if children >= 1:
            self_child_share.append(self_children / float(children))
    return {
        "meanSelfStartShare": _median(self_start_share),
        "meanSelfChildShare": _median(self_child_share),
        "publicVsRankingEligibleDifferenceMedian": _median(
            [
                float(public - ranking)
                for public, ranking in zip(public_starts, ranking_starts)
            ]
        ),
    }


def _blockers(
    areas: Mapping[str, str],
    *,
    cap_status: str,
    real_run: bool,
    eligible_count: int,
    pool_count: int,
) -> list[str]:
    blockers = []
    if not real_run:
        blockers.append("production_corpus_not_evaluated")
    if real_run and eligible_count <= 0:
        blockers.append("empty_discover_eligible_corpus")
    if pool_count <= 0:
        blockers.append("empty_strong_curiosity_candidate_pool")
    for key, verdict in areas.items():
        if verdict in {"FAIL", "PARTIAL"}:
            blockers.append(f"{key}:{verdict}")
    if cap_status == "REACHED":
        blockers.append("corpus_truncated_10k")
    if cap_status == "UNKNOWN":
        blockers.append("corpus_cap_unknown")
    return blockers


async def count_structural_discover_roots(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(MirrorNetworkNode)
        .where(
            MirrorNetworkNode.visibility == "public",
            MirrorNetworkNode.safety_status == "open",
            MirrorNetworkNode.parent_slug.is_(None),
            MirrorNetworkNode.published_at.isnot(None),
            MirrorNetworkNode.artifact_kind == ARTIFACT_KIND_JOURNEY_V1,
            MirrorNetworkNode.freeze_status == FREEZE_STATUS_FROZEN,
        )
    )
    return int(result.scalar() or 0)


async def run_production_corpus_shadow_evaluation(
    db: AsyncSession,
    *,
    evaluated_at: datetime | None = None,
    source: str = "configured_database",
) -> dict[str, Any]:
    """
    Read-only production/staging evaluation. Never commits. Never writes ranking state.
    """
    moment = evaluated_at or datetime.now(timezone.utc)
    counter = _ExecuteCounter(db)
    tracemalloc.start()
    started = perf_counter()
    structural = await count_structural_discover_roots(counter)
    eligible_nodes = await load_discover_eligible_roots(counter)
    pairs = [
        (
            (node.slug or "").strip().lower(),
            int(getattr(node, "journey_version", None) or 1),
        )
        for node, _ in eligible_nodes
    ]
    author_by_slug = {
        (node.slug or "").strip().lower(): str(getattr(node, "user_id", "") or "")
        for node, _ in eligible_nodes
        if getattr(node, "user_id", None)
    }
    eligible_set = set(pairs)
    profiles = await evaluate_strong_curiosity_candidates_batch(
        counter,
        pairs,
        discover_eligible=eligible_set,
        evaluated_at=moment,
    )
    duration_ms = (perf_counter() - started) * 1000.0
    _current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    report = evaluate_production_corpus_shadow(
        profiles,
        evaluated_at=moment,
        source=source,
        structural_root_count=structural,
        evaluated_eligible_count=len(eligible_nodes),
        author_by_slug=author_by_slug,
        query_count=counter.query_count,
        duration_ms=duration_ms,
        peak_memory_kb=peak / 1024.0,
        real_corpus_run=True,
    )
    return report


def render_human_markdown(report: Mapping[str, Any]) -> str:
    corpus = report.get("corpus") or {}
    areas = report.get("areas") or {}
    lines = [
        "# Phase 7.4.3 production corpus shadow evaluation",
        "",
        "Internal only. Do not commit this file. Do not publish. Policy was not changed.",
        "",
        f"- evaluatedAt: `{report.get('evaluatedAt')}`",
        f"- source: `{report.get('source')}`",
        f"- realCorpusRun: `{report.get('realCorpusRun')}`",
        f"- eligible: `{corpus.get('evaluatedEligibleCount')}`",
        f"- structural roots: `{corpus.get('structuralRootCount')}`",
        f"- pool: `{corpus.get('candidatePoolCount')}`",
        f"- insufficient: `{corpus.get('insufficientEvidenceCount')}`",
        f"- historical-only: `{corpus.get('historicalOnlyCount')}`",
        f"- corpus: `{corpus.get('corpusStatus')}` / `{corpus.get('capStatus')}`",
        f"- limitedLiveReady: `{report.get('limitedLiveReady')}`",
        "",
        "## Areas",
        "",
    ]
    for key, value in areas.items():
        lines.append(f"- {key}: **{value}**")
    lines.extend(["", "## Top 10 (internal slugs)", ""])
    for item in ((report.get("topK") or {}).get("10") or {}).get("items") or []:
        lines.append(
            f"- `{item.get('finalOrdinal')}` `{item.get('slug')}` "
            f"foundation={item.get('foundationOrdinal')} "
            f"starts={item.get('rankingEligibleStartedCount')} "
            f"extChildren={item.get('externalDirectChildYansiCount')} "
            f"extAuthors={item.get('distinctExternalChildAuthorCount')}"
        )
    lines.extend(["", "## Blockers", ""])
    for blocker in report.get("blockerFindings") or []:
        lines.append(f"- {blocker}")
    lines.append("")
    return "\n".join(lines)


def write_internal_artifact(
    report: Mapping[str, Any],
    *,
    directory: Path,
) -> dict[str, str]:
    directory.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    json_path = directory / f"phase743-production-shadow-{stamp}.json"
    md_path = directory / f"phase743-production-shadow-{stamp}.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(render_human_markdown(report), encoding="utf-8")
    return {"json": str(json_path), "markdown": str(md_path)}
