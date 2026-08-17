# -*- coding: utf-8 -*-
"""Phase 6.5 — normalization / anti-gaming context (not ranking)."""

from __future__ import annotations

import inspect
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.models.institution import Institution  # noqa: F401
from backend.models.role import Role  # noqa: F401
from backend.models.user import LegacyUser  # noqa: F401

from backend.core.observation.experience_event_rate_limit import (
    YANSI_EXPERIENCE_ACTOR_RATE_PER_MIN,
    YANSI_EXPOSURE_ACTOR_RATE_PER_MIN,
)
from backend.core.schemas.mirror_network import YansiPublicMetrics
from backend.models.yansi_experience_event import (
    YANSI_EXPERIENCE_STARTED,
    YansiExperienceEvent,
)
from backend.models.yansi_exposure_event import YansiExposureEvent
from backend.models.yansi_own_continuation_event import YansiOwnContinuationEvent
from backend.routers import mirror_network as mirror_router
from backend.services.mirror_network import discover as discover_mod
from backend.services.mirror_network.yansi_metrics import PUBLIC_METRIC_KEYS
from backend.services.mirror_network.yansi_signal_semantics import (
    FORBIDDEN_COMPOSITE_KEYS,
    build_yansi_signal_semantics,
)
from backend.services.mirror_network.yansi_normalization import (
    FORBIDDEN_PUBLIC_NORMALIZATION_KEYS,
    GUEST_UNIQUE_HUMAN_POLICY,
    PHASE_7_ALLOWED_INPUTS,
    PHASE_7_FORBIDDEN_INPUTS,
    RANKING_MUST_NOT_SORT_BY,
    SIGNAL_UNIT_AUDIT,
    TIME_AUTHORITY,
    assert_no_identity_leak,
    build_yansi_normalization_context,
    build_yansi_normalized_signal_evidence,
    compute_age_context,
    derive_child_diversity,
    get_yansi_normalized_signal_evidence,
    signal_rate_evidence,
)


ALICE = "alice-user"
BOB = "bob-user"
CAROL = "carol-user"
NOW = datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc)


def _ctx(**overrides):
    base = dict(
        slug="yansi-a",
        journey_version=1,
        author_user_id=ALICE,
        published_at=NOW - timedelta(days=1),
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


def _semantics(**kwargs):
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
    return build_yansi_signal_semantics(
        row,
        exposure_by_context=kwargs.get("exposure"),
        own_continuation_started_count=kwargs.get("continuations", 0),
    ).to_dict()


def test_signal_unit_audit_covers_canonical_families():
    by_id = {row["id"]: row for row in SIGNAL_UNIT_AUDIT}
    assert by_id["experienceStartedCount"]["scope"] == "slug+journeyVersion"
    assert by_id["directChildYansiCount"]["scope"] == "slug"
    assert by_id["ownContinuationStartedCount"]["scope"] == "slug"
    assert "slug+journeyVersion+context" in by_id["contextSpecificExposureCounts"]["scope"]
    assert "deferred" in by_id["attractionRate"]["normalizationReadiness"]
    assert by_id["skipRate"]["knownBias"].startswith("navigational")


def test_ranking_must_not_sort_by_raw_counts():
    assert "experienceStartedCount" in RANKING_MUST_NOT_SORT_BY
    assert "directChildYansiCount" in RANKING_MUST_NOT_SORT_BY
    assert "ownContinuationStartedCount" in RANKING_MUST_NOT_SORT_BY
    assert "exposureCount" in RANKING_MUST_NOT_SORT_BY


def test_self_interaction_alice_bob_starts():
    started = [ALICE] * 10 + [BOB] * 5
    ctx = _ctx(canonical_started_count=15, started_viewer_ids=started)
    self_row = ctx["selfInteraction"]
    assert self_row["authorSelfStartedSessions"] == 10
    assert self_row["externalStartedSessions"] == 5
    assert self_row["rankingEligibleStartedCount"] == 5
    assert ctx["sampleSizes"]["started"] == 15
    blob = str(ctx)
    assert ALICE not in blob
    assert BOB not in blob


def test_auth_repeat_sessions_vs_unique_viewers():
    ctx = _ctx(
        canonical_started_count=5,
        started_viewer_ids=[BOB] * 5,
        author_user_id=ALICE,
    )
    assert ctx["sampleSizes"]["started"] == 5
    assert ctx["uniqueViewerEvidence"]["uniqueAuthenticatedStartedViewerCount"] == 1
    assert ctx["selfInteraction"]["rankingEligibleStartedCount"] == 5
    assert ctx["selfInteraction"]["repeatAuthenticatedUsersNotAutoDeduped"] is True


def test_guest_sessions_are_not_unique_humans():
    ctx = _ctx(canonical_started_count=5, started_viewer_ids=[None] * 5)
    unique = ctx["uniqueViewerEvidence"]
    assert ctx["sampleSizes"]["started"] == 5
    assert unique["guestStartedSessions"] == 5
    assert unique["uniqueAuthenticatedStartedViewerCount"] == 0
    assert unique["guestUniqueHumanAvailability"] == "UNAVAILABLE"
    assert "fingerprint" in unique["guestPolicy"].lower()
    assert unique["sessionSignalMeaning"] != unique["authenticatedUniqueViewerMeaning"]


def test_child_diversity_alice_bob_carol():
    diversity = derive_child_diversity(
        child_author_ids=[ALICE, BOB, BOB, CAROL],
        parent_author_id=ALICE,
    )
    assert diversity["directChildYansiCount"] == 4
    assert diversity["selfAuthoredChildCount"] == 1
    assert diversity["externalDirectChildYansiCount"] == 3
    assert diversity["distinctExternalChildAuthorCount"] == 2
    assert diversity["distinctChildAuthorCount"] == 3
    assert diversity["versionAttribution"] == "not_attributed"


def test_historical_gap_children_without_phase6_starts():
    ctx = _ctx(
        canonical_child_count=3,
        canonical_started_count=0,
        canonical_continuation_count=0,
        child_author_ids=[BOB, BOB, CAROL],
    )
    rates = build_yansi_normalized_signal_evidence(
        _semantics(children=3), ctx
    )["rateEvidence"]
    assert ctx["historicalGaps"]["historicalMeasurementGap"] is True
    assert rates["childPublicationRateCandidate"]["rawRate"] is None
    assert rates["childGenerationRateCandidate"]["rawRate"] is None
    assert rates["childPublicationRateCandidate"]["availability"] == "HISTORICAL_GAP"


def test_age_context_preserves_difference_without_ranking():
    young = compute_age_context(NOW - timedelta(days=1), evaluated_at=NOW)
    old = compute_age_context(NOW - timedelta(days=300), evaluated_at=NOW)
    assert young["ageDays"] == pytest.approx(1.0, abs=0.02)
    assert old["ageDays"] == pytest.approx(300.0, abs=0.02)
    evidence = build_yansi_normalized_signal_evidence(
        _semantics(children=5, started=5),
        _ctx(canonical_child_count=5, canonical_started_count=5),
    )
    assert evidence["ranking"]["implemented"] is False
    assert "penalty" in young["interpretation"]


def test_selected_count_context_no_adjustment():
    six = _ctx(selected_count=6)
    eight = _ctx(selected_count=8)
    assert six["replayLength"]["selectedCount"] == 6
    assert eight["replayLength"]["selectedCount"] == 8
    assert six["replayLength"]["noAdjustmentFormula"] is True
    assert six["replayLength"]["completionNotAgeNormalized"] is True


def test_version_does_not_own_slug_children():
    v2 = _ctx(journey_version=2, canonical_started_count=20, canonical_child_count=5)
    assert v2["scope"]["directChildYansiCount"] == "slug"
    assert v2["scope"]["experienceSignals"] == "slug+journeyVersion"
    assert "do_not_attribute_slug_children_to_one_version" in v2["historicalGaps"]["versionVsSlug"]
    assert v2["generativityDiversity"]["versionAttribution"] == "not_attributed"


def test_exposure_contexts_not_merged_into_attraction_denominator():
    ctx = _ctx(
        exposure_by_context={
            "discover": 100,
            "public_profile": 50,
            "landing": 0,
            "chain": 20,
        }
    )
    exposure = ctx["exposureByContext"]
    assert exposure["counts"]["discover"] == 100
    assert exposure["counts"]["public_profile"] == 50
    assert exposure["counts"]["chain"] == 20
    assert exposure["globalMergedDenominatorUsed"] is False
    assert exposure["globalExposureTotalForAttractionRate"] is None
    assert exposure["discoverToStartedAttribution"] == "UNAVAILABLE"
    assert exposure["attractionRate"] is None
    assert 170 not in exposure["counts"].values()


def test_repeated_self_gaming_is_identifiable():
    ctx = _ctx(canonical_started_count=40, started_viewer_ids=[ALICE] * 40)
    assert ctx["sampleSizes"]["started"] == 40
    assert ctx["selfInteraction"]["authorSelfStartedSessions"] == 40
    assert ctx["selfInteraction"]["rankingEligibleStartedCount"] == 0
    assert ctx["uniqueViewerEvidence"]["uniqueAuthenticatedStartedViewerCount"] == 1


def test_rate_evidence_keeps_volume_and_rate():
    tiny = signal_rate_evidence(
        numerator=2, denominator=2, scope="slug+journeyVersion", availability="AVAILABLE"
    )
    large = signal_rate_evidence(
        numerator=7000,
        denominator=10000,
        scope="slug+journeyVersion",
        availability="AVAILABLE",
    )
    assert tiny["rawRate"] == 1.0
    assert large["rawRate"] == 0.7
    assert tiny["sampleSize"] == 2
    assert large["sampleSize"] == 10000
    ctx = _ctx()
    assert ctx["smallSample"] is None
    assert "invented_threshold" in ctx["smallSampleDecision"]


def test_skip_is_not_a_penalty():
    evidence = build_yansi_normalized_signal_evidence(
        _semantics(started=10, skipped=3, skip_rate=0.3),
        _ctx(canonical_started_count=10, canonical_skipped_count=3),
    )
    assert "not_a_penalty" in evidence["rateEvidence"]["skipInterpretation"]
    assert evidence["ranking"]["weightsDefined"] is False
    assert evidence["ranking"]["formulaDefined"] is False


def test_language_topic_region_and_eza_exclusions():
    available = _ctx(language="tr", topic_category="travel")
    missing = _ctx(language=None, topic_category=None)
    assert available["contentContext"]["languageAvailability"] == "AVAILABLE"
    assert available["contentContext"]["topicAvailability"] == "AVAILABLE"
    assert available["contentContext"]["regionAvailability"] == "UNAVAILABLE"
    assert missing["contentContext"]["languageAvailability"] == "UNAVAILABLE"
    assert available["ezaExcluded"] is True
    assert available["authorPopularityExcluded"] is True
    assert "followers" in PHASE_7_FORBIDDEN_INPUTS
    assert "assistantScore" in PHASE_7_FORBIDDEN_INPUTS
    assert "content_age" in PHASE_7_ALLOWED_INPUTS
    assert "selectedCount" in PHASE_7_ALLOWED_INPUTS


def test_anti_gaming_flags_deferred():
    ctx = _ctx()
    diag = ctx["antiGamingDiagnostics"]
    assert diag["deferred"] is True
    assert diag["highSessionBurst"] is None
    assert diag["noPublicFraudFlag"] is True
    assert ctx["timeAuthority"] == TIME_AUTHORITY
    assert ctx["windowsImplemented"] == []
    assert "24h" in ctx["futureTimeWindows"]


def _keys_of(payload, prefix=""):
    keys = set()
    if isinstance(payload, dict):
        for key, value in payload.items():
            keys.add(f"{prefix}{key}")
            keys |= _keys_of(value, f"{prefix}{key}.")
    return keys


def test_normalized_evidence_has_no_rank_or_identity():
    ctx = _ctx(
        canonical_started_count=15,
        started_viewer_ids=[ALICE] * 10 + [BOB] * 5,
        child_author_ids=[ALICE, BOB, BOB, CAROL],
        canonical_child_count=4,
    )
    evidence = build_yansi_normalized_signal_evidence(
        _semantics(started=15, children=4), ctx
    )
    assert_no_identity_leak(evidence)
    blob = str(evidence).lower()
    assert "rankscore" not in blob
    assert "qualityscore" not in blob
    assert evidence["phase7"]["rankingStatus"] == "NO-GO"
    assert FORBIDDEN_COMPOSITE_KEYS.isdisjoint(_keys_of(evidence))


def test_public_metrics_and_ui_contract_unchanged():
    fields = set(YansiPublicMetrics.model_fields.keys())
    assert fields == set(PUBLIC_METRIC_KEYS)
    assert FORBIDDEN_PUBLIC_NORMALIZATION_KEYS.isdisjoint(fields)
    src = inspect.getsource(mirror_router.get_yansi_metrics)
    assert "get_yansi_normalized_signal_evidence" not in src
    assert "rankingEligible" not in src


def test_discover_does_not_import_normalization():
    src = inspect.getsource(discover_mod)
    assert "yansi_normalization" not in src
    assert "yansi_strong_curiosity_candidate" not in src
    assert "yansi_strong_curiosity_shadow" not in src
    assert "yansi_strong_curiosity_evaluation" not in src
    assert "yansi_strong_curiosity_policy" not in src
    assert "yansi_strong_curiosity_final_shadow" not in src
    assert "yansi_strong_curiosity_production_shadow" not in src
    assert "yansi_strong_curiosity_staging_seed" not in src
    assert "seed_strong_curiosity" not in src
    assert "get_yansi_normalized_signal_evidence" not in src
    assert "yansiCount" not in inspect.getsource(discover_mod.random_discover_sort_key)
    assert "experienceStartedCount" not in inspect.getsource(discover_mod._order_eligible)
    assert "rankingEligible" not in inspect.getsource(discover_mod._order_eligible)


def test_rate_limit_hardening_is_wired():
    src = inspect.getsource(mirror_router)
    assert "rate_limit_yansi_actor_ingest" in src
    assert 'kind="experience"' in src
    assert 'kind="exposure"' in src
    assert YANSI_EXPERIENCE_ACTOR_RATE_PER_MIN == 60
    assert YANSI_EXPOSURE_ACTOR_RATE_PER_MIN == 180
    assert "fingerprint" in GUEST_UNIQUE_HUMAN_POLICY.lower()


def _artifact(slug="yansi-a", version=1, selected=8, author=ALICE):
    return {
        "slug": slug,
        "journeyVersion": version,
        "selectedCount": selected,
        "replayReady": True,
        "artifactKind": "journey_v1",
        "authorUserId": author,
        "publishedAt": (NOW - timedelta(days=1)).isoformat(),
    }


@pytest.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(YansiExperienceEvent.__table__.create)
        await conn.run_sync(YansiExposureEvent.__table__.create)
        await conn.run_sync(YansiOwnContinuationEvent.__table__.create)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session
    await engine.dispose()


async def _insert_started(db, *, viewer, slug="yansi-a", version=1):
    db.add(
        YansiExperienceEvent(
            event_id=str(uuid.uuid4()),
            experience_session_id=str(uuid.uuid4()),
            event_type=YANSI_EXPERIENCE_STARTED,
            mirror_slug=slug,
            journey_version=version,
            viewer_user_id=viewer,
        )
    )
    await db.commit()


@pytest.mark.asyncio
async def test_query_time_self_and_unique_from_events(db):
    for _ in range(10):
        await _insert_started(db, viewer=ALICE)
    for _ in range(5):
        await _insert_started(db, viewer=BOB)
    for _ in range(3):
        await _insert_started(db, viewer=None)

    async def _lookup(_db, *, slug, journey_version=None):
        return _artifact()

    with (
        patch(
            "backend.services.mirror_network.yansi_normalization.get_public_frozen_journey_artifact",
            new=_lookup,
        ),
        patch(
            "backend.services.mirror_network.yansi_normalization.get_public_frozen_journey_artifact_batch",
            new=AsyncMock(return_value={("yansi-a", 1): _artifact()}),
        ),
        patch(
            "backend.services.mirror_network.yansi_normalization._load_nodes_by_slug",
            new=AsyncMock(return_value={}),
        ),
        patch(
            "backend.services.mirror_network.yansi_normalization.list_eligible_direct_child_author_ids_batch",
            new=AsyncMock(return_value={"yansi-a": [ALICE, BOB, BOB, CAROL]}),
        ),
    ):
        evidence = await get_yansi_normalized_signal_evidence(
            db, slug="yansi-a", journey_version=1, evaluated_at=NOW
        )
    self_row = evidence["normalization"]["selfInteraction"]
    unique = evidence["normalization"]["uniqueViewerEvidence"]
    assert evidence["normalization"]["sampleSizes"]["started"] == 18
    assert self_row["authorSelfStartedSessions"] == 10
    assert self_row["externalStartedSessions"] == 8
    assert unique["uniqueAuthenticatedStartedViewerCount"] == 2
    assert unique["guestStartedSessions"] == 3
    assert evidence["normalization"]["generativityDiversity"][
        "distinctExternalChildAuthorCount"
    ] == 2
    assert evidence["ranking"]["implemented"] is False
    assert_no_identity_leak(evidence)


def test_child_generation_rate_marked_scope_incompatible():
    ctx = _ctx(canonical_started_count=100, canonical_child_count=5)
    evidence = build_yansi_normalized_signal_evidence(
        _semantics(started=100, children=5), ctx
    )
    gen = evidence["rateEvidence"]["childGenerationRateCandidate"]
    assert gen["scopeCompatible"] is False
    assert gen["numerator"] == 5
    assert gen["denominator"] == 100
