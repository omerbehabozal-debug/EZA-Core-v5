# -*- coding: utf-8 -*-
"""Phase 6.4 — confidence, historical gap, no ranking/public leak."""

from __future__ import annotations

import inspect

from backend.services.mirror_network import discover as discover_mod
from backend.services.mirror_network.yansi_metrics import PUBLIC_METRIC_KEYS
from backend.services.mirror_network.yansi_signal_semantics import (
    FORBIDDEN_COMPOSITE_KEYS,
    FORBIDDEN_PUBLIC_LEAK_KEYS,
    build_yansi_signal_semantics,
)
from backend.core.schemas.mirror_network import YansiPublicMetrics


def _m(**kwargs):
    row = {
        "slug": kwargs.get("slug", "yansi-a"),
        "journeyVersion": kwargs.get("version", 1),
        "experienceStartedCount": kwargs.get("started", 0),
        "experienceCompletedCount": kwargs.get("completed", 0),
        "experienceSkippedSessionCount": kwargs.get("skipped", 0),
        "completionRate": kwargs.get("completion_rate"),
        "skipRate": kwargs.get("skip_rate"),
        "observedAverageDepth": kwargs.get("depth"),
        "directChildYansiCount": kwargs.get("children", 0),
    }
    return row


def test_confidence_preserves_volume_not_just_rate():
    tiny = build_yansi_signal_semantics(
        _m(started=2, completed=2, completion_rate=1.0)
    )
    large = build_yansi_signal_semantics(
        _m(started=10000, completed=7000, completion_rate=0.7)
    )
    assert tiny.engagement.completionRate == 1.0
    assert large.engagement.completionRate == 0.7
    assert tiny.confidence.startedSampleSize == 2
    assert large.confidence.startedSampleSize == 10000
    assert tiny.engagement.completionNumerator == 2
    assert large.engagement.completionNumerator == 7000
    assert tiny.confidence.category is None
    assert "rankScore" not in tiny.to_dict()


def test_zero_evidence_is_not_bad_quality():
    sem = build_yansi_signal_semantics(_m())
    assert sem.hasEvidence is False
    assert sem.attraction.attractionRate is None
    blob = str(sem.to_dict()).lower()
    assert "bad quality" not in blob
    assert "qualityscore" not in blob


def test_historical_children_without_starts_or_continuations():
    sem = build_yansi_signal_semantics(
        _m(children=3),
        own_continuation_started_count=0,
        exposure_by_context={"discover": 0, "public_profile": 0, "landing": 0, "chain": 0},
    )
    assert sem.hasEvidence is True
    assert sem.generativity.directChildYansiCount == 3
    assert sem.generativity.childGenerationRateCandidate is None
    assert sem.generativity.childPublicationRateCandidate is None
    assert sem.attraction.attractionRate is None


def test_child_publication_rate_uses_compatible_slug_scope():
    sem = build_yansi_signal_semantics(
        _m(started=100, children=7),
        own_continuation_started_count=100,
    )
    assert sem.generativity.continuationScope == "slug"
    assert sem.generativity.childScope == "slug"
    assert sem.generativity.childPublicationRateCandidate == 0.07


def test_attraction_rate_stays_deferred_with_exposures():
    sem = build_yansi_signal_semantics(
        _m(started=40),
        exposure_by_context={"discover": 200, "landing": 80, "public_profile": 10, "chain": 5},
    )
    assert sem.attraction.rateAvailable is False
    assert sem.attraction.attractionRate is None
    assert sem.attraction.exposureEvidenceAvailable is True
    assert sem.confidence.exposureSampleSize == 295
    assert "session_units_not_reconciled" in sem.attraction.attractionRateDeferredReason


def test_public_metrics_allowlist_unchanged():
    fields = set(YansiPublicMetrics.model_fields.keys())
    assert fields == set(PUBLIC_METRIC_KEYS)
    assert FORBIDDEN_PUBLIC_LEAK_KEYS.isdisjoint(fields)
    assert FORBIDDEN_COMPOSITE_KEYS.isdisjoint(fields)


def test_discover_still_does_not_import_semantics_or_exposure_counts():
    src = inspect.getsource(discover_mod)
    assert "yansi_signal_semantics" not in src
    assert "count_exposures_by_context" not in src
    assert "own_continuation" not in src
    assert "yansiCount" not in inspect.getsource(discover_mod.random_discover_sort_key)
    assert "experienceStartedCount" not in inspect.getsource(discover_mod._order_eligible)
