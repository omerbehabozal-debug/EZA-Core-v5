# -*- coding: utf-8 -*-
"""
Phase 7.4.3c — author-concentration diagnosis (internal only).

Determines whether Phase 7.4.3b top-K author concentration is a fixture
assignment artifact, a frozen-policy effect, or both.

Does not rank live Discover. Does not add author quotas, penalties, or
creator-popularity inputs. Must not be imported by public Discover listing.
"""

from __future__ import annotations

import copy
import hashlib
import time
from collections import Counter, OrderedDict
from datetime import datetime, timezone
from typing import Any, Mapping, Sequence

from backend.services.mirror_network.yansi_normalization import derive_child_diversity
from backend.services.mirror_network.yansi_strong_curiosity_final_shadow import (
    POLICY_VERSION,
    order_final_shadow_candidates,
)
from backend.services.mirror_network.yansi_strong_curiosity_production_shadow import (
    EVALUATOR_VERSION,
    evaluate_production_corpus_shadow,
)
from backend.services.mirror_network.yansi_strong_curiosity_shadow import (
    SHADOW_STRATEGIES,
    order_shadow_candidates,
    pool_candidates,
)
from backend.services.mirror_network.yansi_strong_curiosity_staging_seed import (
    ARCHETYPE_CYCLE,
    AUTHOR_HANDLES,
    SLUG_PREFIX,
    build_staging_seed_plan,
    fixture_user_id,
)

DIAGNOSIS_VERSION = "strong_curiosity_author_concentration_diagnosis_v743c"
OWNER_LABEL_ONLY = "owner_label_only"
FULL_AUTHOR_SEMANTICS = "full_author_semantics"
MAP_BASELINE = "baseline"
MAP_BALANCED = "balanced_round_robin"
SEEDED_MAP_IDS = tuple(f"author-map-v{i}" for i in range(1, 6))
TOP_K = (10, 20, 50)

FORBIDDEN_DIAGNOSIS_RANKING_KEYS = frozenset(
    {
    "maxPerAuthor",
        "creatorDiversityScore",
        "authorPenalty",
        "authorBoost",
        "followerCount",
        "profileViews",
        "creatorTotalYansis",
        "creatorTotalDeneyim",
        "assistantScore",
        "userScore",
        "relationshipMap",
        "ezaSnapshot",
        "strongCuriosityScore",
        "rankScore",
    }
)


class AuthorConcentrationDiagnosisError(RuntimeError):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def _int(value: Any, default: int = 0) -> int:
    try:
        if value is None:
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _slug(row: Mapping[str, Any]) -> str:
    return str(row.get("slug") or "").strip().lower()


def _handle_for_id(raw: str | None) -> str:
    text = str(raw or "").strip()
    if not text:
        return ""
    if text in AUTHOR_HANDLES:
        return text
    for handle in AUTHOR_HANDLES:
        if str(fixture_user_id(handle)) == text:
            return handle
    return f"author-{text[:8]}"


def baseline_author_handle(index: int, archetype: str) -> str:
    handle = AUTHOR_HANDLES[index % len(AUTHOR_HANDLES)]
    if archetype in {"mass", "old_high_volume"} and index % 3 == 0:
        return "alice"
    return handle


def baseline_child_author_handles(spec: Mapping[str, Any]) -> list[str]:
    parent = str(spec.get("author_handle") or "")
    handles: list[str] = []
    child_slugs = list(spec.get("child_slugs") or [])
    self_n = _int(spec.get("self_children"))
    unique_ext = max(1, _int(spec.get("unique_external_child_authors"), 1))
    for offset, _slug_name in enumerate(child_slugs):
        if offset < self_n:
            handles.append(parent)
            continue
        ext_index = offset - self_n
        handle = AUTHOR_HANDLES[(ext_index % unique_ext) + 2]
        if handle == parent:
            handle = AUTHOR_HANDLES[(ext_index + 7) % len(AUTHOR_HANDLES)]
        handles.append(handle)
    return handles


def analyze_archetype_author_matrix(
    roots: Sequence[Mapping[str, Any]],
    author_by_slug: Mapping[str, str],
) -> dict[str, Any]:
    by_arch: dict[str, list[str]] = OrderedDict((name, []) for name in ARCHETYPE_CYCLE)
    extra: dict[str, list[str]] = {}
    for row in roots:
        slug = str(row.get("slug") or "")
        archetype = str(row.get("archetype") or "unknown")
        author = _handle_for_id(author_by_slug.get(slug) or row.get("author_handle"))
        bucket = by_arch.get(archetype)
        if bucket is None:
            extra.setdefault(archetype, []).append(author)
        else:
            bucket.append(author)
    matrix = []
    for archetype, authors in [*by_arch.items(), *extra.items()]:
        counts = Counter(authors)
        n = len(authors)
        largest = max(counts.values()) if counts else 0
        matrix.append(
            {
                "archetype": archetype,
                "rootCount": n,
                "distinctAuthorCount": len(counts),
                "largestAuthorShare": (largest / float(n)) if n else None,
                "authors": sorted(counts.keys()),
                "authorCounts": dict(counts),
            }
        )
    coupled = [
        row
        for row in matrix
        if row["rootCount"] >= 2 and row["distinctAuthorCount"] == 1
    ]
    return {
        "rows": matrix,
        "archetypesPinnedToOneAuthor": [row["archetype"] for row in coupled],
        "moduloCoupling": len(ARCHETYPE_CYCLE) == len(AUTHOR_HANDLES) == 24,
    }


def interleave_roots_by_archetype(
    roots: Sequence[Mapping[str, Any]],
) -> list[dict[str, Any]]:
    buckets: OrderedDict[str, list[dict[str, Any]]] = OrderedDict(
        (name, []) for name in ARCHETYPE_CYCLE
    )
    unknown: list[dict[str, Any]] = []
    ordered = sorted(
        roots,
        key=lambda row: (str(row.get("slug") or ""), _int(row.get("index"), 10**9)),
    )
    for row in ordered:
        archetype = str(row.get("archetype") or "")
        if archetype in buckets:
            buckets[archetype].append(dict(row))
        else:
            unknown.append(dict(row))
    interleaved: list[dict[str, Any]] = []
    pointers = {name: 0 for name in buckets}
    while True:
        progressed = False
        for name in ARCHETYPE_CYCLE:
            bucket = buckets[name]
            idx = pointers[name]
            if idx < len(bucket):
                interleaved.append(bucket[idx])
                pointers[name] = idx + 1
                progressed = True
        if not progressed:
            break
    interleaved.extend(unknown)
    return interleaved


def balanced_round_robin_author_map(
    roots: Sequence[Mapping[str, Any]],
    *,
    authors: Sequence[str] = AUTHOR_HANDLES,
) -> dict[str, str]:
    """
    Interleave archetypes, then assign authors with a drifting round-robin
    so the 24-archetype cycle is not glued to the 24-author cycle.
    """
    interleaved = interleave_roots_by_archetype(roots)
    n_authors = len(authors)
    n_arch = max(1, len(ARCHETYPE_CYCLE))
    mapping: dict[str, str] = {}
    for position, row in enumerate(interleaved):
        slug = str(row.get("slug") or "")
        if not slug:
            continue
        author_index = (position + (position // n_arch)) % n_authors
        mapping[slug] = authors[author_index]
    return mapping


def _balanced_author_bag(n_roots: int, authors: Sequence[str]) -> list[str]:
    if n_roots < 1:
        return []
    base, rem = divmod(n_roots, len(authors))
    bag: list[str] = []
    for index, handle in enumerate(authors):
        bag.extend([handle] * (base + (1 if index < rem else 0)))
    return bag[:n_roots]


def _hmac_int(seed: str, index: int) -> int:
    digest = hashlib.sha256(f"{seed}:{index}".encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big")


def seeded_author_shuffle_map(
    roots: Sequence[Mapping[str, Any]],
    *,
    seed: str,
    authors: Sequence[str] = AUTHOR_HANDLES,
) -> dict[str, str]:
    slugs = [str(row.get("slug") or "") for row in roots if row.get("slug")]
    bag = _balanced_author_bag(len(slugs), authors)
    for index in range(len(bag) - 1, 0, -1):
        swap = _hmac_int(seed, index) % (index + 1)
        bag[index], bag[swap] = bag[swap], bag[index]
    return {slug: bag[i] for i, slug in enumerate(slugs)}


def concentration_metrics(
    slugs: Sequence[str],
    author_by_slug: Mapping[str, str],
) -> dict[str, Any]:
    present = [_handle_for_id(author_by_slug.get(slug)) for slug in slugs if author_by_slug.get(slug)]
    counts = Counter(item for item in present if item)
    k = len(present)
    max_from_one = max(counts.values()) if counts else 0
    return {
        "k": k,
        "distinctAuthorCount": len(counts),
        "maxItemsPerAuthor": max_from_one,
        "topAuthorShare": (max_from_one / float(k)) if k else None,
        "authorItemCounts": dict(counts.most_common()),
        "authorIdsExported": False,
    }


def _ranking_fingerprint(candidates: Sequence[Mapping[str, Any]]) -> dict[str, list[str]]:
    rows = [dict(row) for row in candidates]
    pool = pool_candidates(rows)
    final = order_final_shadow_candidates(pool)
    foundation = order_shadow_candidates(pool, strategy="balanced_evidence")
    return {
        "pool": [_slug(row) for row in pool],
        "final": [_slug(row) for row in final],
        "foundation": [_slug(row) for row in foundation],
        "generativity": [
            _slug(row) for row in order_shadow_candidates(pool, strategy="generativity_led")
        ],
    }


def apply_full_author_semantics(
    candidate: Mapping[str, Any],
    *,
    new_parent_author: str,
    child_authors: Sequence[str],
) -> dict[str, Any]:
    out = copy.deepcopy(dict(candidate))
    diversity = derive_child_diversity(
        child_author_ids=list(child_authors),
        parent_author_id=new_parent_author,
    )
    gen = dict(out.get("generativityEvidence") or {})
    continuations = _int(gen.get("rankingEligibleContinuationCount"))
    historical = bool(gen.get("historicalMeasurementGap"))
    children = _int(diversity.get("directChildYansiCount"), _int(gen.get("directChildYansiCount")))
    external = _int(diversity.get("externalDirectChildYansiCount"))
    independent = external >= 1 or continuations >= 1
    if historical and children >= 1:
        status = "HISTORICAL"
    elif independent:
        status = "AVAILABLE"
    elif children >= 1 or continuations >= 1:
        status = "PARTIAL"
    else:
        status = "UNAVAILABLE"
    gen.update(
        {
            "directChildYansiCount": children,
            "selfAuthoredChildCount": _int(diversity.get("selfAuthoredChildCount")),
            "externalDirectChildYansiCount": external,
            "distinctExternalChildAuthorCount": _int(
                diversity.get("distinctExternalChildAuthorCount")
            ),
            "status": status,
            "independentEvidence": independent and not historical,
            "historicalEvidence": historical and children >= 1,
        }
    )
    out["generativityEvidence"] = gen
    return out


def remap_candidates_full_semantics(
    candidates: Sequence[Mapping[str, Any]],
    *,
    new_author_by_slug: Mapping[str, str],
    child_authors_by_slug: Mapping[str, Sequence[str]],
) -> list[dict[str, Any]]:
    remapped: list[dict[str, Any]] = []
    for row in candidates:
        slug = _slug(row)
        parent = new_author_by_slug.get(slug)
        if parent is None or slug not in child_authors_by_slug:
            remapped.append(copy.deepcopy(dict(row)))
            continue
        remapped.append(
            apply_full_author_semantics(
                row,
                new_parent_author=parent,
                child_authors=child_authors_by_slug[slug],
            )
        )
    return remapped


def _slice_metrics(final_slugs: Sequence[str], author_by_slug: Mapping[str, str]) -> dict[str, Any]:
    out = {}
    for k in TOP_K:
        out[str(k)] = concentration_metrics(final_slugs[:k], author_by_slug)
    out["pool"] = concentration_metrics(final_slugs, author_by_slug)
    return out


def evaluate_mapping(
    candidates: Sequence[Mapping[str, Any]],
    *,
    author_by_slug: Mapping[str, str],
    mapping_id: str,
    mode: str,
    evaluated_at: datetime,
    child_authors_by_slug: Mapping[str, Sequence[str]] | None = None,
    baseline_fingerprint: Mapping[str, Sequence[str]] | None = None,
) -> dict[str, Any]:
    started = time.perf_counter()
    working = list(candidates)
    evidence_changed = False
    if mode == FULL_AUTHOR_SEMANTICS:
        working = remap_candidates_full_semantics(
            working,
            new_author_by_slug=author_by_slug,
            child_authors_by_slug=child_authors_by_slug or {},
        )
        evidence_changed = True
    fingerprint = _ranking_fingerprint(working)
    report = evaluate_production_corpus_shadow(
        working,
        evaluated_at=evaluated_at,
        source="author_concentration_diagnosis",
        structural_root_count=len(working),
        evaluated_eligible_count=len(working),
        author_by_slug=author_by_slug,
        real_corpus_run=False,
    )
    invariant = None
    if baseline_fingerprint is not None and mode == OWNER_LABEL_ONLY:
        invariant = {
            "poolUnchanged": list(baseline_fingerprint.get("pool") or []) == fingerprint["pool"],
            "finalUnchanged": list(baseline_fingerprint.get("final") or []) == fingerprint["final"],
            "foundationUnchanged": list(baseline_fingerprint.get("foundation") or [])
            == fingerprint["foundation"],
            "generativityUnchanged": list(baseline_fingerprint.get("generativity") or [])
            == fingerprint["generativity"],
        }
        if not all(invariant.values()):
            raise AuthorConcentrationDiagnosisError("owner_label_ranking_changed")
    leaked = FORBIDDEN_DIAGNOSIS_RANKING_KEYS.intersection(_keys(report))
    if leaked:
        raise AuthorConcentrationDiagnosisError(
            f"forbidden_ranking_key:{','.join(sorted(leaked))}"
        )
    return {
        "mappingId": mapping_id,
        "mode": mode,
        "concentration": _slice_metrics(fingerprint["final"], author_by_slug),
        "ranking": {
            "finalTop10": fingerprint["final"][:10],
            "finalTop20": fingerprint["final"][:20],
            "poolCount": len(fingerprint["pool"]),
        },
        "invariant": invariant,
        "evidenceChanged": evidence_changed,
        "authorConcentrationArea": (report.get("areas") or {}).get("authorConcentration"),
        "areas": {
            key: value
            for key, value in (report.get("areas") or {}).items()
            if key != "authorConcentration"
        },
        "runtimeMs": (time.perf_counter() - started) * 1000.0,
        "policyVersion": POLICY_VERSION,
        "evaluatorVersion": EVALUATOR_VERSION,
    }


def _keys(payload: Any) -> set[str]:
    found: set[str] = set()
    if isinstance(payload, dict):
        for key, value in payload.items():
            found.add(str(key))
            found |= _keys(value)
    elif isinstance(payload, (list, tuple)):
        for item in payload:
            found |= _keys(item)
    return found


def classify_diagnosis(
    *,
    baseline_top10: Mapping[str, Any],
    remap_top10: Sequence[Mapping[str, Any]],
    owner_label_invariant: bool,
    correlation_proven: bool,
) -> str:
    baseline_severe = (
        _int(baseline_top10.get("distinctAuthorCount")) <= 2
        and float(baseline_top10.get("topAuthorShare") or 0) >= 0.50
    )
    remaps_broader = bool(remap_top10) and all(
        _int(row.get("distinctAuthorCount")) >= 4
        and float(row.get("topAuthorShare") or 1) < 0.40
        for row in remap_top10
    )
    remaps_still_severe = bool(remap_top10) and all(
        _int(row.get("distinctAuthorCount")) <= 3
        and float(row.get("topAuthorShare") or 0) >= 0.40
        for row in remap_top10
    )
    if not remap_top10 or not owner_label_invariant:
        return "NOT_PROVEN"
    if baseline_severe and remaps_broader and correlation_proven and owner_label_invariant:
        return "FIXTURE_INDUCED"
    if remaps_still_severe:
        return "POLICY_INDUCED"
    if baseline_severe and correlation_proven:
        return "MIXED"
    return "NOT_PROVEN"


def build_plan_roots(size: str = "medium") -> list[dict[str, Any]]:
    plan = build_staging_seed_plan(size=size)
    roots = []
    for index, row in enumerate(plan["roots"]):
        item = dict(row)
        item["index"] = index
        roots.append(item)
    return roots


def baseline_author_map(roots: Sequence[Mapping[str, Any]]) -> dict[str, str]:
    return {
        str(row["slug"]): str(row.get("author_handle") or baseline_author_handle(index, str(row.get("archetype") or "")))
        for index, row in enumerate(roots)
    }


def child_authors_from_plan(roots: Sequence[Mapping[str, Any]]) -> dict[str, list[str]]:
    return {str(row["slug"]): baseline_child_author_handles(row) for row in roots}


def simulate_743b_top10_slugs(roots: Sequence[Mapping[str, Any]]) -> list[str]:
    small = [str(row["slug"]) for row in roots if row.get("archetype") == "small_generative"]
    external = [str(row["slug"]) for row in roots if row.get("archetype") == "external_diversity"]
    return small[:5] + external[:5]


def run_in_memory_diagnosis(
    candidates: Sequence[Mapping[str, Any]],
    *,
    roots: Sequence[Mapping[str, Any]],
    author_by_slug: Mapping[str, str],
    child_authors_by_slug: Mapping[str, Sequence[str]] | None = None,
    evaluated_at: datetime | None = None,
    include_full_semantics: bool = True,
) -> dict[str, Any]:
    moment = evaluated_at or datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc)
    started = time.perf_counter()
    baseline_fp = _ranking_fingerprint(candidates)
    matrix_baseline = analyze_archetype_author_matrix(roots, author_by_slug)
    maps: dict[str, dict[str, str]] = {MAP_BASELINE: dict(author_by_slug)}
    maps[MAP_BALANCED] = balanced_round_robin_author_map(roots)
    for seed in SEEDED_MAP_IDS:
        maps[seed] = seeded_author_shuffle_map(roots, seed=seed)

    owner_runs = []
    for mapping_id, mapping in maps.items():
        owner_runs.append(
            evaluate_mapping(
                candidates,
                author_by_slug=mapping,
                mapping_id=mapping_id,
                mode=OWNER_LABEL_ONLY,
                evaluated_at=moment,
                baseline_fingerprint=None if mapping_id == MAP_BASELINE else baseline_fp,
            )
        )

    full_runs: list[dict[str, Any]] = []
    if include_full_semantics:
        children = child_authors_by_slug or child_authors_from_plan(roots)
        for mapping_id, mapping in maps.items():
            if mapping_id == MAP_BASELINE:
                continue
            full_runs.append(
                evaluate_mapping(
                    candidates,
                    author_by_slug=mapping,
                    mapping_id=mapping_id,
                    mode=FULL_AUTHOR_SEMANTICS,
                    evaluated_at=moment,
                    child_authors_by_slug=children,
                )
            )

    remap_top10 = [
        row["concentration"]["10"]
        for row in owner_runs
        if row["mappingId"] != MAP_BASELINE
    ]
    owner_ok = all(
        (row.get("invariant") or {}).get("finalUnchanged", True)
        for row in owner_runs
        if row["mappingId"] != MAP_BASELINE
    )
    diagnosis = classify_diagnosis(
        baseline_top10=owner_runs[0]["concentration"]["10"],
        remap_top10=remap_top10,
        owner_label_invariant=owner_ok,
        correlation_proven=bool(matrix_baseline["archetypesPinnedToOneAuthor"]),
    )
    limited_live = (
        "GO"
        if diagnosis == "FIXTURE_INDUCED" and owner_ok
        else "NO-GO"
    )
    return {
        "diagnosisVersion": DIAGNOSIS_VERSION,
        "frozenFinalPolicyVersion": POLICY_VERSION,
        "evaluatorVersion": EVALUATOR_VERSION,
        "namespace": SLUG_PREFIX,
        "candidateCount": len(candidates),
        "poolCount": len(baseline_fp["pool"]),
        "strategiesEvaluated": list(SHADOW_STRATEGIES),
        "seedCount": len(SEEDED_MAP_IDS),
        "archetypeAuthorMatrix": matrix_baseline,
        "ownerLabelOnly": owner_runs,
        "fullAuthorSemantics": full_runs,
        "diagnosis": diagnosis,
        "limitedLiveExperiment": limited_live,
        "authorQuota": "ABSENT",
        "creatorPopularityInput": "ABSENT",
        "ezaInput": "ABSENT",
        "policyMutated": False,
        "public": False,
        "runtimeMs": (time.perf_counter() - started) * 1000.0,
        "liveDiscover": {
            "random": "UNCHANGED",
            "newest": "UNCHANGED",
            "strongCuriosity": "PLACEHOLDER",
        },
    }
