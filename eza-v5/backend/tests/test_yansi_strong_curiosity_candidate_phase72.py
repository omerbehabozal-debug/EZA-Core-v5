# -*- coding: utf-8 -*-
"""Phase 7.2 — Güçlü Merak internal candidate model (not ranking)."""

from __future__ import annotations

import inspect
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from backend.core.schemas.mirror_network import DiscoverMirrorListResponse
from backend.services.mirror_network import discover as discover_mod
from backend.services.mirror_network.discover import list_discover_mirrors
from backend.services.mirror_network.yansi_normalization import (
    build_yansi_normalization_context,
    build_yansi_normalized_signal_evidence,
)
from backend.services.mirror_network.yansi_signal_semantics import (
    build_yansi_signal_semantics,
)
from backend.services.mirror_network.yansi_strong_curiosity_candidate import (
    FORBIDDEN_CANDIDATE_SCORE_KEYS,
    LOW_SAMPLE_STARTED_THRESHOLD,
    build_strong_curiosity_candidate,
    evaluate_strong_curiosity_candidates_batch,
    summarize_strong_curiosity_pool,
)
from backend.services.mirror_network import yansi_strong_curiosity_candidate as candidate_mod


ALICE = "alice-user"
BOB = "bob-user"
CAROL = "carol-user"
NOW = datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc)

FORBIDDEN_SCORE_TOKENS = (
    "rankScore",
    "qualityScore",
    "curiosityScore",
    "priorityScore",
    "strengthScore",
    "weightedScore",
    "compositeScore",
    "popularityScore",
)


def _semantics(**kwargs):
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


def _evidence(*, ctx=None, **semantic_kw):
    context = ctx if ctx is not None else _ctx(
        canonical_started_count=semantic_kw.get("started", 0),
        canonical_completed_count=semantic_kw.get("completed", 0),
        canonical_skipped_count=semantic_kw.get("skipped", 0),
        canonical_child_count=semantic_kw.get("children", 0),
        canonical_continuation_count=semantic_kw.get("continuations", 0),
        journey_version=semantic_kw.get("version", 1),
        slug=semantic_kw.get("slug", "yansi-a"),
    )
    return build_yansi_normalized_signal_evidence(_semantics(**semantic_kw), context)


def _candidate(evidence=None, *, eligible=True, slug="yansi-a", version=1, **semantic_kw):
    row = evidence if evidence is not None else _evidence(**semantic_kw)
    return build_strong_curiosity_candidate(
        slug=slug,
        journey_version=version,
        discover_eligible=eligible,
        normalized_evidence=row,
    )


def test_zero_data_is_insufficient_not_low_quality():
    row = _candidate(started=0, completed=0, children=0, continuations=0)
    assert row["candidateState"] == "INSUFFICIENT_EVIDENCE"
    assert row["inCandidatePool"] is False
    assert "NO_INDEPENDENT_EVIDENCE" in row["reasonCodes"]
    for token in FORBIDDEN_SCORE_TOKENS:
        assert token not in str(row)


def test_small_perfect_completion_is_candidate_with_low_sample():
    viewers = [BOB, BOB]
    ctx = _ctx(
        canonical_started_count=2,
        canonical_completed_count=2,
        started_viewer_ids=viewers,
        completed_viewer_ids=viewers,
    )
    row = _candidate(_evidence(ctx=ctx, started=2, completed=2))
    assert row["candidateState"] == "CANDIDATE"
    assert row["smallSample"] is True
    assert "LOW_SAMPLE" in row["reasonCodes"]
    assert row["engagementEvidence"]["completionDenominator"] == 2
    assert row["engagementEvidence"]["completionRawRate"] == 1.0
    assert row["ranking"]["implemented"] is False


def test_large_moderate_engagement_has_volume_still_unranked():
    started = [f"user-{i}" for i in range(10000)]
    ctx = _ctx(
        canonical_started_count=10000,
        canonical_completed_count=7000,
        started_viewer_ids=started,
        completed_viewer_ids=started[:7000],
    )
    row = _candidate(_evidence(ctx=ctx, started=10000, completed=7000))
    assert row["candidateState"] == "CANDIDATE"
    assert row["smallSample"] is False
    assert row["engagementEvidence"]["rankingEligibleStartedCount"] == 10000
    assert row["ranking"]["formulaDefined"] is False


def test_generativity_heavy_does_not_require_all_three():
    started = [BOB] * 50 + [CAROL] * 50
    ctx = _ctx(
        canonical_started_count=100,
        canonical_completed_count=50,
        canonical_child_count=20,
        started_viewer_ids=started,
        completed_viewer_ids=started[:50],
        child_author_ids=[BOB] * 10 + [CAROL] * 10,
    )
    row = _candidate(_evidence(ctx=ctx, started=100, completed=50, children=20))
    assert row["candidateState"] == "CANDIDATE"
    assert row["generativityEvidence"]["distinctExternalChildAuthorCount"] > 1
    assert row["profileBucket"] == "mixed"
    assert summarize_strong_curiosity_pool([row])["allThreeRequired"] is False


def test_historical_generativity_does_not_divide_by_zero():
    ctx = _ctx(
        canonical_child_count=3,
        canonical_started_count=0,
        canonical_continuation_count=0,
        child_author_ids=[BOB, BOB, CAROL],
    )
    row = _candidate(_evidence(ctx=ctx, children=3, started=0))
    assert row["candidateState"] == "HISTORICAL_ONLY"
    assert row["inCandidatePool"] is True
    assert row["generativityEvidence"]["status"] == "HISTORICAL"
    assert row["generativityEvidence"]["childGenerationRateCandidate"]["rawRate"] is None
    assert row["generativityEvidence"]["childPublicationRateCandidate"]["rawRate"] is None
    assert "HISTORICAL_MEASUREMENT_GAP" in row["reasonCodes"]


def test_self_play_is_observable_and_not_independent_evidence():
    ctx = _ctx(
        canonical_started_count=12,
        canonical_completed_count=12,
        started_viewer_ids=[ALICE] * 12,
        completed_viewer_ids=[ALICE] * 12,
        author_user_id=ALICE,
    )
    row = _candidate(_evidence(ctx=ctx, started=12, completed=12))
    assert row["uniqueViewerEvidence"]["sessionCount"] == 12
    assert row["selfInteraction"]["rankingEligibleStartedCount"] == 0
    assert row["candidateState"] == "INSUFFICIENT_EVIDENCE"
    assert "SELF_INTERACTION_PRESENT" in row["reasonCodes"]


def test_self_play_plus_external_exposes_both():
    ctx = _ctx(
        canonical_started_count=15,
        started_viewer_ids=[ALICE] * 10 + [BOB] * 5,
        author_user_id=ALICE,
    )
    row = _candidate(_evidence(ctx=ctx, started=15))
    assert row["uniqueViewerEvidence"]["sessionCount"] == 15
    assert row["selfInteraction"]["rankingEligibleStartedCount"] == 5
    assert row["candidateState"] == "CANDIDATE"


def test_repeat_auth_user_is_not_five_people():
    ctx = _ctx(canonical_started_count=5, started_viewer_ids=[BOB] * 5)
    row = _candidate(_evidence(ctx=ctx, started=5))
    assert row["uniqueViewerEvidence"]["sessionCount"] == 5
    assert row["uniqueViewerEvidence"]["uniqueAuthenticatedStartedViewerCount"] == 1
    assert row["selfInteraction"]["rankingEligibleStartedCount"] == 5


def test_guest_sessions_are_not_unique_humans():
    ctx = _ctx(canonical_started_count=5, started_viewer_ids=[None] * 5)
    row = _candidate(_evidence(ctx=ctx, started=5))
    assert row["uniqueViewerEvidence"]["guestStartedSessions"] == 5
    assert row["uniqueViewerEvidence"]["guestUniqueHumanAvailability"] == "UNAVAILABLE"
    assert "GUEST_UNIQUE_HUMAN_UNAVAILABLE" in row["reasonCodes"]
    blob = str(row).lower()
    assert "user-agent" not in blob
    assert '"ip"' not in blob


def test_version_does_not_own_slug_children():
    ctx = _ctx(
        journey_version=2,
        canonical_started_count=20,
        canonical_child_count=5,
        started_viewer_ids=[BOB] * 20,
        child_author_ids=[BOB, CAROL, BOB, CAROL, BOB],
    )
    row = _candidate(_evidence(ctx=ctx, version=2, started=20, children=5), version=2)
    assert row["generativityEvidence"]["scopeCompatible"] is False
    assert "SCOPE_INCOMPATIBLE" in row["scopeWarnings"]
    assert row["generativityEvidence"]["childGenerationRateCandidate"]["scopeCompatible"] is False


def test_new_yansi_gets_no_freshness_boost():
    row = _candidate(started=0, completed=0, children=0)
    assert row["candidateState"] == "INSUFFICIENT_EVIDENCE"
    assert row["inCandidatePool"] is False


def test_volume_does_not_exclude_smaller_evaluable_yansi():
    big = _candidate(
        _evidence(
            ctx=_ctx(slug="big", canonical_started_count=100000, started_viewer_ids=[BOB] * 100000),
            slug="big",
            started=100000,
        ),
        slug="big",
    )
    small = _candidate(
        _evidence(
            ctx=_ctx(slug="small", canonical_started_count=1000, started_viewer_ids=[CAROL] * 1000),
            slug="small",
            started=1000,
        ),
        slug="small",
    )
    assert big["candidateState"] == small["candidateState"] == "CANDIDATE"
    assert summarize_strong_curiosity_pool([small, big])["candidateCount"] == 2
    assert summarize_strong_curiosity_pool([small, big])["ordered"] is False


def test_high_skip_rate_does_not_disqualify():
    ctx = _ctx(
        canonical_started_count=20,
        canonical_skipped_count=19,
        started_viewer_ids=[BOB] * 20,
    )
    row = _candidate(_evidence(ctx=ctx, started=20, skipped=19))
    assert row["candidateState"] == "CANDIDATE"
    assert row["engagementEvidence"]["skipIsDisqualifier"] is False
    assert row["engagementEvidence"]["skipRawRate"] == pytest.approx(0.95)


def test_eza_and_relationship_keys_are_not_consumed():
    src = inspect.getsource(candidate_mod)
    assert "ezaScore" not in src
    assert "relationship_map" not in src
    assert "assistantScore" not in src
    ctx = _ctx(canonical_started_count=8, started_viewer_ids=[BOB] * 8)
    row = _candidate(_evidence(ctx=ctx, started=8))
    extra = dict(_evidence(ctx=ctx, started=8))
    extra["normalization"] = dict(extra["normalization"])
    extra["normalization"]["ezaScore"] = 97
    ignored = _candidate(extra)
    assert ignored["candidateState"] == row["candidateState"]


def test_creator_popularity_is_not_an_input():
    src = inspect.getsource(build_strong_curiosity_candidate)
    assert "followerCount" not in src
    assert "creatorScore" not in src
    ctx = _ctx(canonical_started_count=8, started_viewer_ids=[BOB] * 8)
    extra = dict(_evidence(ctx=ctx, started=8))
    extra["normalization"] = dict(extra["normalization"])
    extra["normalization"]["followerCount"] = 88000
    row = _candidate(extra)
    assert row["candidateState"] == "CANDIDATE"


def test_not_eligible_even_with_large_metrics():
    ctx = _ctx(canonical_started_count=1000, started_viewer_ids=[BOB] * 1000)
    row = _candidate(_evidence(ctx=ctx, started=1000), eligible=False)
    assert row["candidateState"] == "NOT_ELIGIBLE"
    assert row["reasonCodes"] == ["NOT_DISCOVER_ELIGIBLE"]


def test_language_topic_preserved_region_unavailable():
    ctx = _ctx(
        canonical_started_count=4,
        started_viewer_ids=[BOB] * 4,
        language="tr",
        topic_category="travel",
    )
    row = _candidate(_evidence(ctx=ctx, started=4))
    assert row["normalizationContext"]["language"] == "tr"
    assert row["normalizationContext"]["topicCategory"] == "travel"
    assert row["normalizationContext"]["regionAvailability"] == "UNAVAILABLE"


def test_pool_stats_and_profile_diversity():
    engagement = _candidate(
        _evidence(
            ctx=_ctx(canonical_started_count=40, started_viewer_ids=[BOB] * 40),
            started=40,
        ),
        slug="eng",
    )
    historical = _candidate(
        _evidence(
            ctx=_ctx(slug="hist", canonical_child_count=3, child_author_ids=[BOB, CAROL, BOB]),
            slug="hist",
            children=3,
        ),
        slug="hist",
    )
    none = _candidate(slug="none")
    summary = summarize_strong_curiosity_pool([engagement, historical, none])
    assert summary["totalEligible"] == 3
    assert summary["candidateCount"] == 1
    assert summary["historicalOnlyCount"] == 1
    assert summary["noEvidence"] == 1
    assert summary["familyCoverage"]["engagementHeavy"] >= 1
    assert summary["familyCoverage"]["generativityHeavy"] >= 1


@pytest.mark.asyncio
async def test_batch_reuses_phase65_normalization_once():
    evidence = {
        ("a", 1): _evidence(
            ctx=_ctx(slug="a", canonical_started_count=6, started_viewer_ids=[BOB] * 6),
            slug="a",
            started=6,
        ),
        ("b", 1): _evidence(slug="b"),
    }
    captured = []

    async def fake_batch(_db, items, **_kwargs):
        captured.append(list(items))
        return evidence

    db = AsyncMock()
    with patch(
        "backend.services.mirror_network.yansi_strong_curiosity_candidate.get_yansi_normalized_signal_evidence_batch",
        new=fake_batch,
    ):
        rows = await evaluate_strong_curiosity_candidates_batch(db, [("a", 1), ("b", 1), ("a", 1)])
    assert len(captured) == 1
    assert captured[0] == [("a", 1), ("b", 1)]
    assert rows[0]["candidateState"] == "CANDIDATE"
    assert rows[1]["candidateState"] == "INSUFFICIENT_EVIDENCE"


@pytest.mark.asyncio
async def test_discover_modes_remain_unranked_and_placeholder():
    root = SimpleNamespace(
        slug="keep-me",
        parent_slug=None,
        visibility="public",
        safety_status="open",
        scene_image_url="https://cdn.example/a.png",
        public_payload={"publicTitle": "keep"},
        private_payload={},
        card_title="keep",
        published_at=NOW,
        created_at=NOW,
        journey_version=1,
        artifact_kind="journey_v1",
        freeze_status="frozen",
    )
    empty = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [root])),
            empty,
            empty,
        ]
    )

    async def boom(*_a, **_k):
        raise AssertionError("candidate evaluation must not run during Discover list")

    with (
        patch(
            "backend.services.mirror_network.discover.is_replay_ready_from_loaded_child",
            return_value=True,
        ),
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
                    ("keep-me", 1): {
                        "experienceStartedCount": 140,
                        "directChildYansiCount": 7,
                    }
                }
            ),
        ),
        patch(
            "backend.services.mirror_network.yansi_strong_curiosity_candidate.get_yansi_normalized_signal_evidence_batch",
            new=boom,
        ),
    ):
        newest = await list_discover_mirrors(db, mode="newest", limit=10)
        db.execute = AsyncMock(
            side_effect=[
                SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [root])),
                empty,
                empty,
            ]
        )
        random = await list_discover_mirrors(
            db, mode="random", limit=10, random_session="seed-stable-01"
        )
        gm = await list_discover_mirrors(db, mode="strong_curiosity", limit=10)

    assert [item.slug for item in newest.items] == ["keep-me"]
    assert newest.items[0].experienceStartedCount == 140
    assert newest.items[0].directChildYansiCount == 7
    assert [item.slug for item in random.items] == ["keep-me"]
    assert gm.items == []
    assert gm.strongCuriosityReady is False
    dumped = newest.model_dump()
    assert "candidateState" not in dumped
    assert "engagement" not in dumped["items"][0]


def test_public_discover_dto_cannot_carry_candidate_fields():
    payload = DiscoverMirrorListResponse(items=[], total=0, mode="random")
    keys = set(payload.model_dump().keys())
    assert "candidateState" not in keys
    assert "evidenceReadiness" not in keys


def test_candidate_module_excludes_score_tokens_except_forbid_set():
    src = inspect.getsource(candidate_mod)
    for token in FORBIDDEN_SCORE_TOKENS:
        if token in src:
            assert token in str(FORBIDDEN_CANDIDATE_SCORE_KEYS)
    assert LOW_SAMPLE_STARTED_THRESHOLD == 3


def test_low_sample_threshold_is_reason_not_exclusion():
    ctx = _ctx(canonical_started_count=1, started_viewer_ids=[BOB])
    row = _candidate(_evidence(ctx=ctx, started=1))
    assert row["candidateState"] == "CANDIDATE"
    assert row["smallSample"] is True

