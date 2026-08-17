# -*- coding: utf-8 -*-
"""Phase 7.3 — Güçlü Merak shadow ordering (internal only)."""

from __future__ import annotations

import inspect
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from backend.core.schemas.mirror_network import DiscoverMirrorListResponse
from backend.routers import mirror_network as mirror_router
from backend.services.mirror_network import discover as discover_mod
from backend.services.mirror_network.discover import list_discover_mirrors
from backend.services.mirror_network.yansi_normalization import (
    build_yansi_normalization_context,
    build_yansi_normalized_signal_evidence,
    get_yansi_normalized_signal_evidence_batch,
)
from backend.services.mirror_network.yansi_signal_semantics import (
    build_yansi_signal_semantics,
)
from backend.services.mirror_network.yansi_strong_curiosity_candidate import (
    build_strong_curiosity_candidate,
)
from backend.services.mirror_network import yansi_strong_curiosity_shadow as shadow_mod
from backend.services.mirror_network.yansi_strong_curiosity_shadow import (
    FORBIDDEN_SHADOW_SCORE_KEYS,
    SHADOW_STRATEGIES,
    compare_shadow_strategy_results,
    order_shadow_candidates,
    run_shadow_on_candidates,
    run_strong_curiosity_shadow_ordering,
)


ALICE = "alice-user"
BOB = "bob-user"
CAROL = "carol-user"
DANA = "dana-user"
NOW = datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc)

FORBIDDEN_SCORE_TOKENS = (
    "rankScore",
    "qualityScore",
    "weightedScore",
    "curiosityScore",
    "compositeScore",
    "popularityScore",
)

SUBJECTIVE = ("BEST", "BORING", "VIRAL", "HIGH_QUALITY")


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
    context = (
        ctx
        if ctx is not None
        else _ctx(
            canonical_started_count=semantic_kw.get("started", 0),
            canonical_completed_count=semantic_kw.get("completed", 0),
            canonical_skipped_count=semantic_kw.get("skipped", 0),
            canonical_child_count=semantic_kw.get("children", 0),
            canonical_continuation_count=semantic_kw.get("continuations", 0),
            journey_version=semantic_kw.get("version", 1),
            slug=semantic_kw.get("slug", "yansi-a"),
        )
    )
    return build_yansi_normalized_signal_evidence(_semantics(**semantic_kw), context)


def _candidate(evidence=None, *, eligible=True, slug="yansi-a", version=1, **semantic_kw):
    row = evidence if evidence is not None else _evidence(slug=slug, **semantic_kw)
    return build_strong_curiosity_candidate(
        slug=slug,
        journey_version=version,
        discover_eligible=eligible,
        normalized_evidence=row,
    )


def _started_completed(n_started, n_completed, prefix="user"):
    started = [f"{prefix}-{i}" for i in range(n_started)]
    return started, started[:n_completed]


def _slugs(result, strategy):
    row = next(item for item in result["results"] if item["strategy"] == strategy)
    return [item["slug"] for item in row["orderedCandidates"]]


def _keys(payload):
    found = set()
    if isinstance(payload, dict):
        for key, value in payload.items():
            found.add(str(key))
            found |= _keys(value)
    elif isinstance(payload, (list, tuple)):
        for item in payload:
            found |= _keys(item)
    return found


def test_small_sample_does_not_beat_large_evidence_on_rate_alone():
    small_viewers = [BOB, CAROL]
    small = _candidate(
        _evidence(
            ctx=_ctx(
                slug="tiny-perfect",
                canonical_started_count=2,
                canonical_completed_count=2,
                started_viewer_ids=small_viewers,
                completed_viewer_ids=small_viewers,
            ),
            slug="tiny-perfect",
            started=2,
            completed=2,
        ),
        slug="tiny-perfect",
    )
    started, completed = _started_completed(10000, 7000)
    large = _candidate(
        _evidence(
            ctx=_ctx(
                slug="large-moderate",
                canonical_started_count=10000,
                canonical_completed_count=7000,
                started_viewer_ids=started,
                completed_viewer_ids=completed,
            ),
            slug="large-moderate",
            started=10000,
            completed=7000,
        ),
        slug="large-moderate",
    )
    payload = run_shadow_on_candidates([small, large])
    engagement = _slugs(payload, "engagement_led")
    balanced = _slugs(payload, "balanced_evidence")
    stability = _slugs(payload, "evidence_stability")
    assert engagement[0] == "large-moderate"
    assert balanced[0] == "large-moderate"
    assert stability[0] == "large-moderate"
    tiny = next(
        item
        for item in payload["results"][0]["orderedCandidates"]
        if item["slug"] == "tiny-perfect"
    )
    # Find tiny inside engagement result.
    tiny_eng = next(
        item
        for item in next(
            row for row in payload["results"] if row["strategy"] == "engagement_led"
        )["orderedCandidates"]
        if item["slug"] == "tiny-perfect"
    )
    assert "LOW_SAMPLE_CAVEAT" in tiny_eng["reasonCodes"]
    assert tiny_eng["evidenceSnapshot"]["completionNumerator"] == 2
    assert tiny_eng["evidenceSnapshot"]["completionDenominator"] == 2
    assert tiny["evidenceSnapshot"]["completionRawRate"] == 1.0


def test_raw_start_volume_does_not_win_every_strategy():
    started_a, completed_a = _started_completed(200, 100, prefix="vol")
    volume = _candidate(
        _evidence(
            ctx=_ctx(
                slug="volume-a",
                canonical_started_count=200,
                canonical_completed_count=100,
                started_viewer_ids=started_a,
                completed_viewer_ids=completed_a,
            ),
            slug="volume-a",
            started=200,
            completed=100,
        ),
        slug="volume-a",
    )
    volume["attractionEvidence"]["rankingEligibleStartedCount"] = 100_000
    volume["selfInteraction"]["rankingEligibleStartedCount"] = 100_000
    volume["uniqueViewerEvidence"]["sessionCount"] = 100_000
    volume["engagementEvidence"]["completionNumerator"] = 40_000
    volume["engagementEvidence"]["completionDenominator"] = 100_000
    volume["engagementEvidence"]["completionRawRate"] = 0.4
    volume["generativityEvidence"]["directChildYansiCount"] = 0
    volume["generativityEvidence"]["externalDirectChildYansiCount"] = 0
    volume["generativityEvidence"]["distinctExternalChildAuthorCount"] = 0
    volume["generativityEvidence"]["status"] = "UNAVAILABLE"
    volume["profileBucket"] = "engagementHeavy"

    started_b, completed_b = _started_completed(40, 20, prefix="div")
    diverse = _candidate(
        _evidence(
            ctx=_ctx(
                slug="diverse-b",
                canonical_started_count=40,
                canonical_completed_count=20,
                canonical_child_count=20,
                started_viewer_ids=started_b,
                completed_viewer_ids=completed_b,
                child_author_ids=[f"ext-{i}" for i in range(20)],
            ),
            slug="diverse-b",
            started=40,
            completed=20,
            children=20,
        ),
        slug="diverse-b",
    )
    payload = run_shadow_on_candidates([volume, diverse])
    firsts = {strategy: _slugs(payload, strategy)[0] for strategy in SHADOW_STRATEGIES}
    assert firsts["generativity_led"] == "diverse-b"
    assert firsts["balanced_evidence"] == "diverse-b"
    assert set(firsts.values()) != {"volume-a"}


def test_generativity_led_prefers_external_diversity_over_self_children():
    self_heavy = _candidate(
        _evidence(
            ctx=_ctx(
                slug="self-children",
                canonical_started_count=8,
                canonical_completed_count=4,
                canonical_child_count=20,
                started_viewer_ids=[BOB] * 8,
                completed_viewer_ids=[BOB] * 4,
                child_author_ids=[ALICE] * 19 + [BOB],
            ),
            slug="self-children",
            started=8,
            completed=4,
            children=20,
        ),
        slug="self-children",
    )
    external = _candidate(
        _evidence(
            ctx=_ctx(
                slug="external-children",
                canonical_started_count=8,
                canonical_completed_count=4,
                canonical_child_count=8,
                started_viewer_ids=[CAROL] * 8,
                completed_viewer_ids=[CAROL] * 4,
                child_author_ids=[
                    BOB,
                    CAROL,
                    DANA,
                    "ext-1",
                    "ext-2",
                    "ext-3",
                    "ext-4",
                    ALICE,
                ],
            ),
            slug="external-children",
            started=8,
            completed=4,
            children=8,
        ),
        slug="external-children",
    )
    assert self_heavy["generativityEvidence"]["directChildYansiCount"] == 20
    assert external["generativityEvidence"]["distinctExternalChildAuthorCount"] > (
        self_heavy["generativityEvidence"]["distinctExternalChildAuthorCount"]
    )
    ordered = order_shadow_candidates(
        [self_heavy, external], strategy="generativity_led"
    )
    assert [row["slug"] for row in ordered] == ["external-children", "self-children"]


def test_balanced_keeps_multi_family_profiles_explainable():
    eng_started, eng_completed = _started_completed(80, 70, prefix="eng")
    engagement_heavy = _candidate(
        _evidence(
            ctx=_ctx(
                slug="eng-heavy",
                canonical_started_count=80,
                canonical_completed_count=70,
                started_viewer_ids=eng_started,
                completed_viewer_ids=eng_completed,
            ),
            slug="eng-heavy",
            started=80,
            completed=70,
        ),
        slug="eng-heavy",
    )
    gen_started, gen_completed = _started_completed(20, 8, prefix="gen")
    generativity_heavy = _candidate(
        _evidence(
            ctx=_ctx(
                slug="gen-heavy",
                canonical_started_count=20,
                canonical_completed_count=8,
                canonical_child_count=12,
                started_viewer_ids=gen_started,
                completed_viewer_ids=gen_completed,
                child_author_ids=[f"auth-{i}" for i in range(12)],
            ),
            slug="gen-heavy",
            started=20,
            completed=8,
            children=12,
        ),
        slug="gen-heavy",
    )
    mix_started, mix_completed = _started_completed(30, 15, prefix="mix")
    mixed = _candidate(
        _evidence(
            ctx=_ctx(
                slug="mixed-c",
                canonical_started_count=30,
                canonical_completed_count=15,
                canonical_child_count=6,
                started_viewer_ids=mix_started,
                completed_viewer_ids=mix_completed,
                child_author_ids=[f"mix-{i}" for i in range(6)],
            ),
            slug="mixed-c",
            started=30,
            completed=15,
            children=6,
        ),
        slug="mixed-c",
    )
    payload = run_shadow_on_candidates(
        [engagement_heavy, generativity_heavy, mixed]
    )
    balanced = _slugs(payload, "balanced_evidence")
    assert set(balanced) == {"eng-heavy", "gen-heavy", "mixed-c"}
    assert balanced[0] != "eng-heavy"
    codes = {
        item["slug"]: item["reasonCodes"]
        for item in next(
            row for row in payload["results"] if row["strategy"] == "balanced_evidence"
        )["orderedCandidates"]
    }
    assert "MULTI_FAMILY_EVIDENCE" in codes["mixed-c"]
    assert "EXTERNAL_GENERATIVITY" in codes["gen-heavy"]


def test_historical_does_not_invent_a_rate_or_crash():
    row = _candidate(
        _evidence(
            ctx=_ctx(
                slug="hist-only",
                canonical_child_count=5,
                canonical_started_count=0,
                child_author_ids=[BOB, CAROL, DANA, "ext-a", "ext-b"],
            ),
            slug="hist-only",
            children=5,
            started=0,
        ),
        slug="hist-only",
    )
    assert row["candidateState"] == "HISTORICAL_ONLY"
    assert row["generativityEvidence"]["childGenerationRateCandidate"]["rawRate"] is None
    payload = run_shadow_on_candidates([row])
    hist = payload["results"][0]["orderedCandidates"][0]
    assert hist["slug"] == "hist-only"
    assert hist["candidateState"] == "HISTORICAL_ONLY"
    assert hist["evidenceSnapshot"]["childGenerationRate"]["rawRate"] is None
    assert "HISTORICAL_GAP" in hist["reasonCodes"]


def test_unavailable_is_not_treated_as_zero_quality():
    missing = _candidate(
        _evidence(
            ctx=_ctx(
                slug="missing-eng",
                canonical_child_count=4,
                child_author_ids=[BOB, CAROL, DANA, "ext-z"],
            ),
            slug="missing-eng",
            children=4,
            started=0,
        ),
        slug="missing-eng",
    )
    zero_rate = _candidate(
        _evidence(
            ctx=_ctx(
                slug="zero-complete",
                canonical_started_count=10,
                canonical_completed_count=0,
                started_viewer_ids=[f"z-{i}" for i in range(10)],
            ),
            slug="zero-complete",
            started=10,
            completed=0,
        ),
        slug="zero-complete",
    )
    payload = run_shadow_on_candidates([missing, zero_rate])
    statuses = {
        item["slug"]: item["familyStatuses"]
        for item in payload["results"][0]["orderedCandidates"]
    }
    assert statuses["missing-eng"]["engagement"] in ("UNAVAILABLE", "HISTORICAL")
    assert statuses["zero-complete"]["engagement"] == "AVAILABLE"
    assert statuses["missing-eng"]["engagement"] != statuses["zero-complete"]["engagement"]


def test_scope_incompatible_rate_is_not_used_by_generativity_led():
    left = _candidate(
        _evidence(
            ctx=_ctx(
                slug="scope-a",
                canonical_started_count=80,
                canonical_completed_count=40,
                canonical_child_count=4,
                started_viewer_ids=[BOB] * 80,
                completed_viewer_ids=[BOB] * 40,
                child_author_ids=[CAROL, DANA, "x-1", "x-2"],
            ),
            slug="scope-a",
            started=80,
            completed=40,
            children=4,
        ),
        slug="scope-a",
    )
    right = _candidate(
        _evidence(
            ctx=_ctx(
                slug="scope-b",
                canonical_started_count=5,
                canonical_completed_count=2,
                canonical_child_count=4,
                started_viewer_ids=[BOB] * 5,
                completed_viewer_ids=[BOB] * 2,
                child_author_ids=[CAROL, DANA, "x-1", "x-2"],
            ),
            slug="scope-b",
            started=5,
            completed=2,
            children=4,
        ),
        slug="scope-b",
    )
    assert left["generativityEvidence"]["scopeCompatible"] is False
    left["generativityEvidence"]["childGenerationRateCandidate"]["rawRate"] = 99.0
    left["generativityEvidence"]["childGenerationRateCandidate"]["denominator"] = 80
    right["generativityEvidence"]["childGenerationRateCandidate"]["rawRate"] = 0.0001
    right["generativityEvidence"]["childGenerationRateCandidate"]["denominator"] = 5
    ordered = [
        row["slug"]
        for row in order_shadow_candidates([left, right], strategy="generativity_led")
    ]
    # Same external diversity → immutable slug tie-break, not the fake versioned rate.
    assert ordered == ["scope-a", "scope-b"]


def test_self_play_does_not_improve_shadow_position():
    base_viewers = [BOB] * 10
    clean = _candidate(
        _evidence(
            ctx=_ctx(
                slug="canonical",
                canonical_started_count=10,
                canonical_completed_count=6,
                started_viewer_ids=base_viewers,
                completed_viewer_ids=base_viewers[:6],
            ),
            slug="canonical",
            started=10,
            completed=6,
        ),
        slug="canonical",
    )
    with_self = _candidate(
        _evidence(
            ctx=_ctx(
                slug="canonical",
                canonical_started_count=60,
                canonical_completed_count=56,
                started_viewer_ids=[ALICE] * 50 + base_viewers,
                completed_viewer_ids=[ALICE] * 50 + base_viewers[:6],
            ),
            slug="canonical",
            started=60,
            completed=56,
        ),
        slug="canonical",
    )
    rival = _candidate(
        _evidence(
            ctx=_ctx(
                slug="rival",
                canonical_started_count=12,
                canonical_completed_count=9,
                started_viewer_ids=[CAROL] * 12,
                completed_viewer_ids=[CAROL] * 9,
            ),
            slug="rival",
            started=12,
            completed=9,
        ),
        slug="rival",
    )
    assert (
        clean["selfInteraction"]["rankingEligibleStartedCount"]
        == with_self["selfInteraction"]["rankingEligibleStartedCount"]
    )
    for strategy in SHADOW_STRATEGIES:
        if strategy == "control_input_order":
            continue
        clean_pos = [
            row["slug"] for row in order_shadow_candidates([clean, rival], strategy=strategy)
        ]
        dirty_pos = [
            row["slug"]
            for row in order_shadow_candidates([with_self, rival], strategy=strategy)
        ]
        assert clean_pos == dirty_pos


def test_auth_concentration_is_confidence_not_popularity():
    concentrated = _candidate(
        _evidence(
            ctx=_ctx(
                slug="one-account",
                canonical_started_count=100,
                canonical_completed_count=80,
                started_viewer_ids=[BOB] * 100,
                completed_viewer_ids=[BOB] * 80,
            ),
            slug="one-account",
            started=100,
            completed=80,
        ),
        slug="one-account",
    )
    diverse = _candidate(
        _evidence(
            ctx=_ctx(
                slug="many-accounts",
                canonical_started_count=100,
                canonical_completed_count=80,
                started_viewer_ids=[f"acct-{i}" for i in range(80)] + [BOB] * 20,
                completed_viewer_ids=[f"acct-{i}" for i in range(80)],
            ),
            slug="many-accounts",
            started=100,
            completed=80,
        ),
        slug="many-accounts",
    )
    ordered = [
        row["slug"]
        for row in order_shadow_candidates(
            [concentrated, diverse], strategy="evidence_stability"
        )
    ]
    assert ordered[0] == "many-accounts"
    assert concentrated["uniqueViewerEvidence"]["uniqueAuthenticatedStartedViewerCount"] == 1


def test_language_and_eza_and_followers_do_not_change_order():
    a = _candidate(
        _evidence(
            ctx=_ctx(
                slug="alpha",
                language="tr",
                topic_category="travel",
                canonical_started_count=8,
                canonical_completed_count=4,
                started_viewer_ids=[BOB] * 8,
                completed_viewer_ids=[BOB] * 4,
            ),
            slug="alpha",
            started=8,
            completed=4,
        ),
        slug="alpha",
    )
    b = _candidate(
        _evidence(
            ctx=_ctx(
                slug="beta",
                language="en",
                topic_category="food",
                canonical_started_count=9,
                canonical_completed_count=5,
                started_viewer_ids=[CAROL] * 9,
                completed_viewer_ids=[CAROL] * 5,
            ),
            slug="beta",
            started=9,
            completed=5,
        ),
        slug="beta",
    )
    before = {
        strategy: [row["slug"] for row in order_shadow_candidates([a, b], strategy=strategy)]
        for strategy in SHADOW_STRATEGIES
    }
    for row in (a, b):
        row["assistantScore"] = 99
        row["userScore"] = 12
        row["relationshipMap"] = {"strength": 8}
        row["followers"] = 50000
        row["profileViews"] = 9000
        row["creatorTotalYansilar"] = 400
        row["normalizationContext"]["language"] = "xx"
        row["normalizationContext"]["topicCategory"] = "injected"
    after = {
        strategy: [row["slug"] for row in order_shadow_candidates([a, b], strategy=strategy)]
        for strategy in SHADOW_STRATEGIES
    }
    assert before == after
    snapshot = run_shadow_on_candidates([a, b])["results"][0]["orderedCandidates"][0]
    assert snapshot["evidenceSnapshot"]["language"] in ("xx", "tr", "en")


def test_control_preserves_input_order_and_others_are_deterministic():
    low = _candidate(
        _evidence(
            ctx=_ctx(
                slug="zeta",
                canonical_started_count=4,
                started_viewer_ids=[BOB] * 4,
            ),
            slug="zeta",
            started=4,
        ),
        slug="zeta",
    )
    high = _candidate(
        _evidence(
            ctx=_ctx(
                slug="aaa",
                canonical_started_count=40,
                canonical_completed_count=20,
                canonical_child_count=5,
                started_viewer_ids=[CAROL] * 40,
                completed_viewer_ids=[CAROL] * 20,
                child_author_ids=[f"c-{i}" for i in range(5)],
            ),
            slug="aaa",
            started=40,
            completed=20,
            children=5,
        ),
        slug="aaa",
    )
    control = [row["slug"] for row in order_shadow_candidates([low, high], strategy="control_input_order")]
    assert control == ["zeta", "aaa"]
    first = run_shadow_on_candidates([low, high])
    second = run_shadow_on_candidates([low, high])
    assert first["results"] == second["results"]
    assert not first["comparison"]["allStrategiesIdentical"]


def test_no_score_fields_and_no_composite_formula():
    row = _candidate(
        _evidence(
            ctx=_ctx(
                slug="plain",
                canonical_started_count=6,
                started_viewer_ids=[BOB] * 6,
            ),
            slug="plain",
            started=6,
        ),
        slug="plain",
    )
    payload = run_shadow_on_candidates([row])
    keys = _keys(payload)
    for token in FORBIDDEN_SCORE_TOKENS:
        assert token not in keys
        assert token in FORBIDDEN_SHADOW_SCORE_KEYS or token == "popularityScore"
    blob = str(payload)
    for label in SUBJECTIVE:
        assert label not in blob
    src = inspect.getsource(shadow_mod)
    assert "0.3" not in src or "Attraction" not in src
    assert "compositeScore" in src
    assert "wilson" not in src.lower()
    assert "bayes" not in src.lower()


def test_selected_count_and_skip_are_not_sort_keys():
    src = inspect.getsource(shadow_mod._engagement_key)
    assert "skipRawRate" not in src
    assert "skip_rate" not in src
    assert "selectedCount" not in src
    result_src = inspect.getsource(shadow_mod.build_shadow_result)
    assert "freshnessBoost" in result_src
    assert "agePenalty" in result_src


@pytest.mark.asyncio
async def test_normalized_batch_does_not_call_per_item_public_frozen():
    async def boom(*_a, **_k):
        raise AssertionError("per-item public frozen lookup must not run in 6.5 batch")

    with (
        patch(
            "backend.services.mirror_network.yansi_normalization.get_public_frozen_journey_artifact",
            new=boom,
        ),
        patch(
            "backend.services.mirror_network.yansi_normalization.get_public_frozen_journey_artifact_batch",
            new=AsyncMock(return_value={}),
        ),
        patch(
            "backend.services.mirror_network.yansi_normalization._load_nodes_by_slug",
            new=AsyncMock(return_value={}),
        ),
        patch(
            "backend.services.mirror_network.yansi_normalization._load_experience_bundle",
            new=AsyncMock(return_value={}),
        ),
        patch(
            "backend.services.mirror_network.yansi_normalization._load_continuation_viewers",
            new=AsyncMock(return_value={}),
        ),
        patch(
            "backend.services.mirror_network.yansi_normalization._load_exposure_viewers",
            new=AsyncMock(return_value=({}, {})),
        ),
        patch(
            "backend.services.mirror_network.yansi_normalization.list_eligible_direct_child_author_ids_batch",
            new=AsyncMock(return_value={}),
        ),
    ):
        out = await get_yansi_normalized_signal_evidence_batch(
            AsyncMock(), [("a", 1), ("b", 1)]
        )
    assert out == {}


@pytest.mark.asyncio
async def test_shadow_runner_is_not_used_by_live_discover():
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
        raise AssertionError("shadow ordering must not run during Discover list")

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
            "backend.services.mirror_network.yansi_strong_curiosity_shadow.run_strong_curiosity_shadow_ordering",
            new=boom,
        ),
        patch(
            "backend.services.mirror_network.yansi_strong_curiosity_candidate.evaluate_discover_strong_curiosity_pool",
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
        random_a = await list_discover_mirrors(
            db, mode="random", limit=10, random_session="seed-stable-01"
        )
        db.execute = AsyncMock(
            side_effect=[
                SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [root])),
                empty,
                empty,
            ]
        )
        random_b = await list_discover_mirrors(
            db, mode="random", limit=10, random_session="seed-stable-01"
        )
        gm = await list_discover_mirrors(db, mode="strong_curiosity", limit=10)

    assert [item.slug for item in newest.items] == ["keep-me"]
    assert newest.items[0].experienceStartedCount == 140
    assert newest.items[0].directChildYansiCount == 7
    assert [item.slug for item in random_a.items] == [item.slug for item in random_b.items]
    assert gm.items == []
    assert gm.strongCuriosityReady is False
    dumped = newest.model_dump()
    assert "reasonCodes" not in dumped
    assert "orderedCandidates" not in dumped


def test_public_contracts_do_not_expose_shadow():
    payload = DiscoverMirrorListResponse(items=[], total=0, mode="strong_curiosity")
    dumped = payload.model_dump()
    assert dumped.get("items") == []
    keys = _keys(dumped)
    assert "orderedCandidates" not in keys
    assert "reasonCodes" not in keys
    router_src = inspect.getsource(mirror_router)
    discover_src = inspect.getsource(discover_mod)
    list_src = inspect.getsource(list_discover_mirrors)
    assert "yansi_strong_curiosity_shadow" not in router_src
    assert "yansi_strong_curiosity_shadow" not in discover_src
    assert "run_strong_curiosity_shadow_ordering" not in list_src
    assert "control_input_order" not in router_src
    assert "balanced_evidence" not in inspect.getsource(mirror_router.get_mirror_network_discover)


@pytest.mark.asyncio
async def test_shadow_db_runner_uses_candidate_pool_not_live_list():
    pool = {
        "items": [
            _candidate(
                _evidence(
                    ctx=_ctx(
                        slug="pool-a",
                        canonical_started_count=4,
                        started_viewer_ids=[BOB] * 4,
                    ),
                    slug="pool-a",
                    started=4,
                ),
                slug="pool-a",
            )
        ],
        "liveRanking": False,
    }
    with patch(
        "backend.services.mirror_network.yansi_strong_curiosity_shadow.evaluate_discover_strong_curiosity_pool",
        new=AsyncMock(return_value=pool),
    ):
        payload = await run_strong_curiosity_shadow_ordering(AsyncMock(), evaluated_at=NOW)
    assert payload["liveRanking"] is False
    assert payload["public"] is False
    assert payload["corpusCap"] == 10_000
    assert payload["results"][0]["orderedCandidates"][0]["slug"] == "pool-a"


def test_top_k_comparison_is_diagnostic_only():
    rows = []
    for i in range(6):
        started = [f"u{i}-{n}" for n in range(4 + i)]
        rows.append(
            _candidate(
                _evidence(
                    ctx=_ctx(
                        slug=f"item-{i}",
                        canonical_started_count=4 + i,
                        started_viewer_ids=started,
                    ),
                    slug=f"item-{i}",
                    started=4 + i,
                ),
                slug=f"item-{i}",
            )
        )
    payload = run_shadow_on_candidates(rows, top_k=(2, 3))
    comparison = compare_shadow_strategy_results(payload["results"], top_k=(2, 3))
    assert comparison["liveTopK"] is False
    assert comparison["topKInspected"] == [2, 3]
    assert "popularityCorrelation" in comparison
    assert "score" not in _keys(comparison)
