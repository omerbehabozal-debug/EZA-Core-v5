# -*- coding: utf-8 -*-
"""
Phase 7.4.3d — bounded pairwise volume-agreement diagnostics.

Diagnostic only. Must not influence ranking, comparators, or live Discover.
Must not be imported by public Discover listing.
"""

from __future__ import annotations

import hashlib
from itertools import combinations
from typing import Any, Mapping, Sequence

PAIRWISE_DIAGNOSTIC_VERSION = "pairwise_diag_v743d"
DIAGNOSTIC_MODE_EXACT = "EXACT"
DIAGNOSTIC_MODE_BOUNDED_SAMPLE = "BOUNDED_SAMPLE"
DEPENDENCE_PRECISION_EXACT = "EXACT"
DEPENDENCE_PRECISION_SAMPLED = "SAMPLED"

# C(400, 2) = 79_800. 100-candidate corpora stay exact.
# 1_000 and 10_000 use the bounded sample (not C(N, 2)).
EXACT_PAIRWISE_MAX_SLUGS = 400
BOUNDED_PAIR_BUDGET = 12_000
_ADJACENT_WINDOW = 3
_PARTNERS_PER_SLUG = 2


def pair_population_size(n: int) -> int:
    if n < 2:
        return 0
    return n * (n - 1) // 2


def _stable_digest(*parts: str) -> bytes:
    hasher = hashlib.sha256()
    hasher.update(PAIRWISE_DIAGNOSTIC_VERSION.encode("utf-8"))
    for part in parts:
        hasher.update(b"\x1f")
        hasher.update(str(part).encode("utf-8"))
    return hasher.digest()


def _canonical_slugs(slugs: Sequence[str]) -> tuple[str, ...]:
    return tuple(sorted({str(slug) for slug in slugs if slug}))


def _add_pair(
    ordered: Sequence[str],
    seen: set[tuple[str, str]],
    out: list[tuple[str, str]],
    left: int,
    right: int,
    budget: int,
) -> bool:
    n = len(ordered)
    if left == right or left < 0 or right < 0 or left >= n or right >= n:
        return len(out) >= budget
    a = ordered[left]
    b = ordered[right]
    pair = (a, b) if a < b else (b, a)
    if pair in seen:
        return len(out) >= budget
    seen.add(pair)
    out.append(pair)
    return len(out) >= budget


def _bounded_pairs(ordered: Sequence[str], series_key: str) -> tuple[tuple[str, str], ...]:
    n = len(ordered)
    budget = min(BOUNDED_PAIR_BUDGET, pair_population_size(n))
    if budget <= 0:
        return ()
    seen: set[tuple[str, str]] = set()
    out: list[tuple[str, str]] = []

    for index in range(n):
        for delta in range(1, _ADJACENT_WINDOW + 1):
            if _add_pair(ordered, seen, out, index, index + delta, budget):
                return tuple(out)

    for salt in range(_PARTNERS_PER_SLUG * 4):
        for index, slug in enumerate(ordered):
            digest = _stable_digest(series_key, slug, str(salt))
            partner = int.from_bytes(digest[:8], "big") % n
            if _add_pair(ordered, seen, out, index, partner, budget):
                return tuple(out)

    for divisor in (2, 3, 5, 8, 16, 32):
        step = n // divisor
        if step <= _ADJACENT_WINDOW:
            continue
        for index in range(n):
            if _add_pair(ordered, seen, out, index, (index + step) % n, budget):
                return tuple(out)

    fill = 0
    guard = budget * 16
    while len(out) < budget and fill < guard:
        digest = _stable_digest(series_key, "fill", str(fill))
        left = int.from_bytes(digest[:8], "big") % n
        right = int.from_bytes(digest[8:16], "big") % n
        _add_pair(ordered, seen, out, left, right, budget)
        fill += 1
    return tuple(out)


def select_diagnostic_pairs(
    slugs: Sequence[str],
    *,
    series_key: str,
) -> tuple[str, tuple[tuple[str, str], ...]]:
    """Return (mode, unordered pairs). Ranking order is not an input."""
    ordered = _canonical_slugs(slugs)
    n = len(ordered)
    if n <= EXACT_PAIRWISE_MAX_SLUGS:
        return DIAGNOSTIC_MODE_EXACT, tuple(combinations(ordered, 2))
    return DIAGNOSTIC_MODE_BOUNDED_SAMPLE, _bounded_pairs(ordered, series_key)


def pairwise_volume_agreement_diagnostic(
    positions: Mapping[str, int],
    volumes: Mapping[str, float],
    *,
    series_key: str,
    warning_ratio: float,
) -> dict[str, Any]:
    """
    Concordance of higher volume with better (lower) ordinal.

    Threshold is an engineering warning, not a quality score.
    Bounded mode uses the same threshold over the deterministic sample.
    """
    slugs = [slug for slug in positions if slug in volumes]
    corpus_size = len(_canonical_slugs(slugs))
    population = pair_population_size(corpus_size)
    mode, pairs = select_diagnostic_pairs(slugs, series_key=series_key)
    concordant = 0
    comparable = 0
    for left, right in pairs:
        delta_volume = float(volumes[left]) - float(volumes[right])
        if delta_volume == 0:
            continue
        comparable += 1
        delta_pos = int(positions[left]) - int(positions[right])
        if (delta_volume > 0 and delta_pos < 0) or (delta_volume < 0 and delta_pos > 0):
            concordant += 1
    ratio = (concordant / comparable) if comparable else None
    dependence = (
        "HIGH_MONOTONIC_DEPENDENCE"
        if ratio is not None and ratio >= warning_ratio
        else "NOT_PROVEN"
    )
    sampled = mode == DIAGNOSTIC_MODE_BOUNDED_SAMPLE
    return {
        "comparablePairs": comparable,
        "concordantWithHigherVolumeFirst": concordant,
        "agreementRatio": ratio,
        "dependence": dependence,
        "warningThreshold": warning_ratio,
        "thresholdKind": "engineering_warning_not_quality",
        "diagnosticMode": mode,
        "dependencePrecision": (
            DEPENDENCE_PRECISION_SAMPLED if sampled else DEPENDENCE_PRECISION_EXACT
        ),
        "corpusSize": corpus_size,
        "pairPopulationSize": population,
        "evaluatedPairCount": len(pairs),
        "selectedPairCount": len(pairs),
        "deterministicSampleVersion": PAIRWISE_DIAGNOSTIC_VERSION,
        "seriesKey": series_key,
    }
