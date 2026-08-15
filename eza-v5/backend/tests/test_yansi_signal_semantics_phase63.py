# -*- coding: utf-8 -*-
"""Phase 6.3 — internal signal semantics contract (not ranking)."""

from __future__ import annotations

import inspect
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from backend.services.mirror_network import discover as discover_mod
from backend.services.mirror_network.discover import list_discover_mirrors
from backend.services.mirror_network.yansi_metrics import (
    PUBLIC_METRIC_KEYS,
    public_metrics_dict,
    YansiExperienceAggregates,
)
from backend.services.mirror_network.yansi_signal_semantics import (
    ENGAGEMENT_INTERPRETATION,
    FORBIDDEN_COMPOSITE_KEYS,
    FORBIDDEN_PUBLIC_LEAK_KEYS,
    GENERATIVITY_FUNNEL,
    PHASE_7_BOUNDARY,
    PRODUCT_PRINCIPLE,
    SIGNAL_MEANINGS,
    SIGNAL_REGISTRY,
    build_yansi_signal_semantics,
    get_yansi_signal_semantics,
)
from backend.routers import mirror_network as mirror_router


def _metrics(
    *,
    slug="yansi-a",
    version=1,
    started=0,
    completed=0,
    skipped=0,
    completion_rate=None,
    skip_rate=None,
    depth=None,
    children=0,
    extra=None,
):
    row = {
        "slug": slug,
        "journeyVersion": version,
        "experienceStartedCount": started,
        "experienceCompletedCount": completed,
        "experienceSkippedSessionCount": skipped,
        "completionRate": completion_rate,
        "skipRate": skip_rate,
        "observedAverageDepth": depth,
        "directChildYansiCount": children,
    }
    if extra:
        row.update(extra)
    return row


def _flat_keys(payload: dict, prefix="") -> set[str]:
    keys = set()
    for key, value in payload.items():
        path = f"{prefix}{key}"
        keys.add(path)
        if isinstance(value, dict):
            keys |= _flat_keys(value, f"{path}.")
    return keys


def test_registry_marks_availability_and_immutable_meanings():
    by_id = {row["id"]: row for row in SIGNAL_REGISTRY}
    assert by_id["experienceStartedCount"]["availability"] == "AVAILABLE"
    assert by_id["completionRate"]["availability"] == "AVAILABLE"
    assert by_id["directChildYansiCount"]["availability"] == "AVAILABLE"
    assert by_id["childGenerationRateCandidate"]["availability"] == "DERIVED"
    assert by_id["ownContinuationStarted"]["availability"] == "AVAILABLE"
    assert by_id["canonicalExposure"]["availability"] == "AVAILABLE"
    assert by_id["attractionRate"]["availability"] == "UNAVAILABLE"
    assert by_id["lineageDepth"]["availability"] == "FUTURE"
    assert by_id["attractionRate"]["availability"] == "UNAVAILABLE"
    assert "popularity" not in SIGNAL_MEANINGS["directChildYansiCount"].split("Not ")[0]
    assert "not quality" in SIGNAL_MEANINGS["experienceStartedCount"]
    assert "not abandonment" in SIGNAL_MEANINGS["skipRate"]
    assert "Not popularity" in SIGNAL_MEANINGS["directChildYansiCount"]
    funnel = {row["stage"]: row["availability"] for row in GENERATIVITY_FUNNEL}
    assert funnel["yansi_started"] == "AVAILABLE"
    assert funnel["first_live_question"] == "AVAILABLE"
    assert funnel["child_yansi_published"] == "AVAILABLE"
    assert PRODUCT_PRINCIPLE.startswith("EZA Mirror")
    assert "ranking" in PHASE_7_BOUNDARY.lower()


def test_high_start_low_generativity_is_evidence_not_rank():
    sem = build_yansi_signal_semantics(
        _metrics(
            started=10000,
            completed=8000,
            completion_rate=0.8,
            skip_rate=0.0,
            depth=7.2,
            children=0,
        )
    )
    payload = sem.to_dict()
    assert sem.attraction.startedCount == 10000
    assert sem.attraction.rateAvailable is False
    assert sem.attraction.attractionRate is None
    assert sem.engagement.completionRate == 0.8
    assert sem.generativity.directChildYansiCount == 0
    assert sem.generativity.childGenerationRateCandidate == 0.0
    assert payload.keys().isdisjoint(FORBIDDEN_COMPOSITE_KEYS)
    blob = str(payload).lower()
    assert "high quality" not in blob
    assert "low quality" not in blob
    assert "qualityscore" not in blob
    assert "rankscore" not in blob


def test_low_start_high_generativity_is_not_ranked_above_high_start():
    high_start = build_yansi_signal_semantics(
        _metrics(slug="a", started=10000, completed=8000, completion_rate=0.8, children=0)
    )
    generative = build_yansi_signal_semantics(
        _metrics(
            slug="b",
            started=100,
            completed=50,
            completion_rate=0.5,
            children=20,
        )
    )
    assert generative.generativity.childGenerationRateCandidate == 0.2
    assert high_start.generativity.childGenerationRateCandidate == 0.0
    assert "rankScore" not in high_start.to_dict()
    assert "rankScore" not in generative.to_dict()
    assert generative.confidence.sampleSize == 100
    assert high_start.confidence.sampleSize == 10000
    assert generative.confidence.categoryAvailable is False
    assert generative.confidence.category is None


def test_skip_then_child_is_not_negative_engagement():
    sem = build_yansi_signal_semantics(
        _metrics(started=40, skipped=12, skip_rate=0.3, children=5)
    )
    assert sem.engagement.skipKind == "navigational_branching"
    flags = sem.engagement.interpretation
    assert "skip_is_navigational_branching_not_abandonment" in flags
    assert "do_not_label_skip_as_drop_off_failure_or_bounce" in flags
    assert "skip_is_drop_off" not in flags
    assert "skip_is_failure" not in flags
    assert "skip_is_bounce" not in flags
    assert sem.generativity.directChildYansiCount == 5
    assert "do_not_label_skip_as_drop_off_failure_or_bounce" in ENGAGEMENT_INTERPRETATION


def test_skip_and_complete_are_preserved_without_contradiction():
    sem = build_yansi_signal_semantics(
        _metrics(
            started=10,
            completed=7,
            skipped=4,
            completion_rate=0.7,
            skip_rate=0.4,
            children=1,
        )
    )
    assert sem.engagement.completionRate == 0.7
    assert sem.engagement.skipRate == 0.4
    assert "skip_and_complete_are_non_exclusive" in sem.engagement.interpretation
    blob = str(sem.to_dict()).lower()
    assert "contradiction" not in blob


def test_zero_data_is_no_evidence_not_zero_quality():
    sem = build_yansi_signal_semantics(_metrics())
    assert sem.hasEvidence is False
    assert sem.attraction.startedCount == 0
    assert sem.generativity.directChildYansiCount == 0
    assert sem.generativity.childGenerationRateCandidate is None
    assert sem.confidence.sampleSize == 0
    assert "qualityScore" not in sem.to_dict()
    assert sem.confidence.category is None


def test_children_without_starts_do_not_divide_by_zero():
    sem = build_yansi_signal_semantics(_metrics(children=3))
    assert sem.hasEvidence is True
    assert sem.generativity.directChildYansiCount == 3
    assert sem.generativity.childGenerationRateCandidate is None
    assert sem.attraction.startedCount == 0


def test_mixed_scope_is_explicit_version_vs_slug():
    sem = build_yansi_signal_semantics(
        _metrics(slug="yansi-a", version=2, started=12, children=7)
    )
    assert sem.journeyVersion == 2
    assert sem.scopes["experienceSignals"] == "slug+journeyVersion"
    assert sem.scopes["directChildYansiCount"] == "slug"
    assert sem.generativity.childScope == "slug"
    note = " ".join(sem.generativity.interpretation)
    assert "slug_level_not_version_scoped" in note
    assert "experience_signals_are_version_scoped" in note


def test_eza_and_author_fields_are_ignored():
    sem = build_yansi_signal_semantics(
        _metrics(
            extra={
                "ezaSnapshot": {"ezaFinal": 91},
                "relationshipMap": {"secret": True},
                "userId": "author-1",
                "viewerId": "viewer-9",
            }
        )
    )
    payload = sem.to_dict()
    blob = str(payload)
    assert "ezaSnapshot" not in payload
    assert "relationshipMap" not in payload
    assert "userId" not in _flat_keys(payload)
    assert "91" not in blob
    assert "author-1" not in blob
    assert "author_and_eza_are_not_inputs" in sem.generativity.interpretation


def test_no_composite_score_keys():
    payload = build_yansi_signal_semantics(
        _metrics(started=50, completed=20, children=4)
    ).to_dict()
    assert FORBIDDEN_COMPOSITE_KEYS.isdisjoint(payload.keys())
    assert FORBIDDEN_COMPOSITE_KEYS.isdisjoint(_flat_keys(payload))


def test_public_metrics_dto_does_not_gain_semantics_keys():
    dto = public_metrics_dict(
        slug="yansi-a",
        journey_version=1,
        aggregates=YansiExperienceAggregates(),
        direct_child_yansi_count=0,
    )
    assert set(dto.keys()) == set(PUBLIC_METRIC_KEYS)
    assert FORBIDDEN_PUBLIC_LEAK_KEYS.isdisjoint(dto.keys())


def test_discover_module_does_not_import_signal_semantics():
    source = inspect.getsource(discover_mod)
    assert "yansi_signal_semantics" not in source
    assert "get_yansi_signal_semantics" not in source
    router_src = inspect.getsource(mirror_router)
    assert "get_yansi_signal_semantics" not in router_src
    assert "/signal" not in router_src


@pytest.mark.asyncio
async def test_semantics_do_not_reorder_discover():
    from datetime import datetime, timezone

    def _root(slug: str, published_ts: float):
        ts = datetime.fromtimestamp(published_ts, tz=timezone.utc)
        return SimpleNamespace(
            slug=slug,
            parent_slug=None,
            visibility="public",
            safety_status="open",
            scene_image_url="https://cdn.example/a.png",
            public_payload={"publicTitle": slug},
            private_payload={},
            card_title=slug,
            published_at=ts,
            created_at=ts,
            journey_version=1,
        )

    popular = _root("popular", 1.0)
    children_rich = _root("children-rich", 2.0)
    child_a = SimpleNamespace(
        slug="c1",
        parent_slug="children-rich",
        visibility="public",
        safety_status="open",
    )
    child_b = SimpleNamespace(
        slug="c2",
        parent_slug="children-rich",
        visibility="public",
        safety_status="open",
    )
    child_c = SimpleNamespace(
        slug="c3",
        parent_slug="popular",
        visibility="public",
        safety_status="open",
    )
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [popular, children_rich])),
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [child_a, child_b, child_c])),
        ]
    )
    _ = build_yansi_signal_semantics(
        _metrics(slug="popular", started=10000, children=1)
    )
    _ = build_yansi_signal_semantics(
        _metrics(slug="children-rich", started=1, children=2)
    )
    with (
        patch(
            "backend.services.mirror_network.discover.is_public_discover_scene_url",
            return_value=True,
        ),
        patch(
            "backend.services.mirror_network.discover.evaluate_mirror_network_safety",
            return_value=SimpleNamespace(passed=True),
        ),
        patch(
            "backend.services.mirror_network.yansi_metrics.get_yansi_public_metrics_batch",
            new=AsyncMock(
                return_value={
                    ("popular", 1): {
                        "experienceStartedCount": 10000,
                        "directChildYansiCount": 1,
                    },
                    ("children-rich", 1): {
                        "experienceStartedCount": 1,
                        "directChildYansiCount": 2,
                    },
                }
            ),
        ),
    ):
        response = await list_discover_mirrors(db, limit=10, offset=0)
    assert [item.slug for item in response.items] == ["children-rich", "popular"]
    dumped = response.model_dump()
    leaked = FORBIDDEN_PUBLIC_LEAK_KEYS.intersection(_flat_keys(dumped))
    assert not leaked


@pytest.mark.asyncio
async def test_service_consumes_phase61_metrics_not_raw_events():
    metrics = _metrics(started=8, completed=5, completion_rate=0.625, children=2)
    db = AsyncMock()
    with (
        patch(
            "backend.services.mirror_network.yansi_signal_semantics.get_yansi_public_metrics",
            new=AsyncMock(return_value=metrics),
        ) as mocked,
        patch(
            "backend.services.mirror_network.yansi_signal_semantics.count_exposures_by_context",
            new=AsyncMock(return_value={"discover": 0, "public_profile": 0, "landing": 0, "chain": 0}),
        ),
        patch(
            "backend.services.mirror_network.yansi_signal_semantics.count_own_continuation_started",
            new=AsyncMock(return_value=0),
        ),
    ):
        out = await get_yansi_signal_semantics(db, slug="yansi-a", journey_version=1)
    mocked.assert_awaited_once()
    assert out == build_yansi_signal_semantics(metrics).to_dict()
    assert out["generativity"]["childGenerationRateCandidate"] == 0.25
    assert out["generativity"]["ownContinuationAvailable"] is True
    assert out["generativity"]["lineageDepthAvailable"] is False
    db.execute.assert_not_called()
