# -*- coding: utf-8 -*-
"""Phase 6.1 — query-time Yansı public metrics (read-only over 6.0 events)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.models.institution import Institution  # noqa: F401
from backend.models.role import Role  # noqa: F401
from backend.models.user import LegacyUser  # noqa: F401

from backend.models.mirror_network import ARTIFACT_KIND_JOURNEY_V1
from backend.models.yansi_experience_event import (
    YANSI_EXPERIENCE_COMPLETED,
    YANSI_EXPERIENCE_SKIPPED,
    YANSI_EXPERIENCE_STARTED,
    YansiExperienceEvent,
)
from backend.services.mirror_network.author_profile import count_eligible_direct_children
from backend.services.mirror_network.frozen_journey_artifact import (
    FREEZE_STATUS_FROZEN,
    FREEZE_STATUS_NON_FROZEN,
)
from backend.services.mirror_network.yansi_experience_events import (
    ingest_yansi_experience_event,
)
from backend.services.mirror_network.yansi_metrics import (
    PUBLIC_METRIC_KEYS,
    YansiMetricsError,
    compute_experience_aggregates,
    get_yansi_public_metrics,
    observed_session_depth,
    public_metrics_dict,
)


def _artifact(slug: str, version: int = 1, selected: int = 8):
    return {
        "slug": slug,
        "journeyVersion": version,
        "selectedCount": selected,
        "replayReady": True,
        "artifactKind": "journey_v1",
    }


ARTIFACTS = {
    ("yansi-a", 1): _artifact("yansi-a", 1, 8),
    ("yansi-a", 2): _artifact("yansi-a", 2, 8),
    ("yansi-b", 1): _artifact("yansi-b", 1, 6),
}


async def _frozen(_db, *, slug: str, journey_version: int | None = None):
    key = (slug or "").strip().lower()
    if journey_version is None:
        versions = [v for (s, v) in ARTIFACTS if s == key]
        if not versions:
            return None
        return ARTIFACTS[(key, max(versions))]
    return ARTIFACTS.get((key, int(journey_version)))


@pytest.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(YansiExperienceEvent.__table__.create)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session
    await engine.dispose()


async def _ingest(db, **payload):
    slug = payload.pop("slug", "yansi-a")
    with patch(
        "backend.services.mirror_network.yansi_experience_events.get_public_frozen_journey_artifact",
        new=_frozen,
    ):
        return await ingest_yansi_experience_event(db, slug=slug, payload=payload)


async def _metrics(db, *, slug="yansi-a", journey_version=None, child_count=0):
    with (
        patch(
            "backend.services.mirror_network.yansi_metrics.get_public_frozen_journey_artifact",
            new=_frozen,
        ),
        patch(
            "backend.services.mirror_network.yansi_metrics.count_eligible_direct_children",
            new=AsyncMock(return_value=child_count),
        ),
    ):
        return await get_yansi_public_metrics(
            db, slug=slug, journey_version=journey_version
        )


def test_a_no_events_zeros_and_null_rates():
    agg = compute_experience_aggregates([], selected_count=8)
    assert agg.experience_started_count == 0
    assert agg.experience_completed_count == 0
    assert agg.experience_skipped_session_count == 0
    assert agg.completion_rate is None
    assert agg.skip_rate is None
    assert agg.observed_average_depth is None
    assert agg.started_only_count == 0


def test_b_one_started_only():
    sid = "s-start"
    agg = compute_experience_aggregates(
        [(sid, YANSI_EXPERIENCE_STARTED, 0)], selected_count=8
    )
    assert (agg.experience_started_count, agg.experience_completed_count, agg.experience_skipped_session_count) == (
        1,
        0,
        0,
    )
    assert agg.completion_rate == 0.0
    assert agg.skip_rate == 0.0
    assert agg.observed_average_depth == 0.0
    assert agg.started_only_count == 1


def test_c_started_completed_rate_one():
    sid = "s-done"
    agg = compute_experience_aggregates(
        [
            (sid, YANSI_EXPERIENCE_STARTED, 0),
            (sid, YANSI_EXPERIENCE_COMPLETED, 8),
        ],
        selected_count=8,
    )
    assert (agg.experience_started_count, agg.experience_completed_count, agg.experience_skipped_session_count) == (
        1,
        1,
        0,
    )
    assert agg.completion_rate == 1.0
    assert agg.observed_average_depth == 8.0


def test_d_started_skip_skip_rate_one():
    sid = "s-skip"
    agg = compute_experience_aggregates(
        [
            (sid, YANSI_EXPERIENCE_STARTED, 0),
            (sid, YANSI_EXPERIENCE_SKIPPED, 3),
        ],
        selected_count=8,
    )
    assert (agg.experience_started_count, agg.experience_completed_count, agg.experience_skipped_session_count) == (
        1,
        0,
        1,
    )
    assert agg.skip_rate == 1.0
    assert agg.completion_rate == 0.0
    assert agg.observed_average_depth == 3.0


def test_e_skip_then_complete_counts_both():
    sid = "s-return"
    agg = compute_experience_aggregates(
        [
            (sid, YANSI_EXPERIENCE_STARTED, 0),
            (sid, YANSI_EXPERIENCE_SKIPPED, 3),
            (sid, YANSI_EXPERIENCE_COMPLETED, 8),
        ],
        selected_count=8,
    )
    assert (agg.experience_started_count, agg.experience_completed_count, agg.experience_skipped_session_count) == (
        1,
        1,
        1,
    )
    assert agg.completion_rate == 1.0
    assert agg.skip_rate == 1.0
    assert agg.sessions_skipped_then_completed == 1
    assert agg.observed_average_depth == 8.0


def test_f_two_sessions_one_complete_one_skip():
    agg = compute_experience_aggregates(
        [
            ("s1", YANSI_EXPERIENCE_STARTED, 0),
            ("s1", YANSI_EXPERIENCE_COMPLETED, 8),
            ("s2", YANSI_EXPERIENCE_STARTED, 0),
            ("s2", YANSI_EXPERIENCE_SKIPPED, 3),
        ],
        selected_count=8,
    )
    assert (agg.experience_started_count, agg.experience_completed_count, agg.experience_skipped_session_count) == (
        2,
        1,
        1,
    )
    assert agg.completion_rate == 0.5
    assert agg.skip_rate == 0.5


def test_multiple_skips_same_session_count_once():
    sid = "s-multi"
    agg = compute_experience_aggregates(
        [
            (sid, YANSI_EXPERIENCE_STARTED, 0),
            (sid, YANSI_EXPERIENCE_SKIPPED, 3),
            (sid, YANSI_EXPERIENCE_SKIPPED, 4),
        ],
        selected_count=8,
    )
    assert agg.experience_skipped_session_count == 1
    assert agg.raw_skip_transition_count == 2
    assert agg.observed_average_depth == 4.0


def test_duplicate_rows_do_not_inflate_session_counts():
    sid = "s-dup"
    agg = compute_experience_aggregates(
        [
            (sid, YANSI_EXPERIENCE_STARTED, 0),
            (sid, YANSI_EXPERIENCE_STARTED, 0),
            (sid, YANSI_EXPERIENCE_COMPLETED, 8),
            (sid, YANSI_EXPERIENCE_COMPLETED, 8),
        ],
        selected_count=8,
    )
    assert agg.experience_started_count == 1
    assert agg.experience_completed_count == 1


def test_started_only_depth_is_zero():
    assert observed_session_depth(completed=False, max_skip_depth=0, selected_count=8) == 0


def test_same_user_two_sessions_count_twice():
    agg = compute_experience_aggregates(
        [
            ("s-bob-1", YANSI_EXPERIENCE_STARTED, 0),
            ("s-bob-2", YANSI_EXPERIENCE_STARTED, 0),
        ],
        selected_count=8,
    )
    assert agg.experience_started_count == 2


def test_public_dto_has_only_aggregate_keys():
    agg = compute_experience_aggregates(
        [("s1", YANSI_EXPERIENCE_STARTED, 0)], selected_count=8
    )
    dto = public_metrics_dict(
        slug="yansi-a",
        journey_version=1,
        aggregates=agg,
        direct_child_yansi_count=7,
    )
    assert set(dto.keys()) == set(PUBLIC_METRIC_KEYS)
    blob = str(dto).lower()
    for needle in (
        "experiencesessionid",
        "eventid",
        "vieweruserid",
        "destinationslug",
        "occurredat",
        "guest",
        "rawskip",
    ):
        assert needle not in blob.replace("_", "")
    assert "ownContinuationStartedCount" not in dto


@pytest.mark.asyncio
async def test_ingest_then_metrics_skip_complete_and_default_version(db):
    s1 = str(uuid.uuid4())
    await _ingest(
        db,
        eventId=str(uuid.uuid4()),
        experienceSessionId=s1,
        eventType=YANSI_EXPERIENCE_STARTED,
        journeyVersion=1,
    )
    await _ingest(
        db,
        eventId=str(uuid.uuid4()),
        experienceSessionId=s1,
        eventType=YANSI_EXPERIENCE_SKIPPED,
        journeyVersion=1,
        completedStepCount=3,
        destinationSlug="yansi-b",
    )
    await _ingest(
        db,
        eventId=str(uuid.uuid4()),
        experienceSessionId=s1,
        eventType=YANSI_EXPERIENCE_COMPLETED,
        journeyVersion=1,
        completedStepCount=8,
    )
    v1 = await _metrics(db, journey_version=1, child_count=7)
    assert v1["experienceStartedCount"] == 1
    assert v1["experienceCompletedCount"] == 1
    assert v1["experienceSkippedSessionCount"] == 1
    assert v1["completionRate"] == 1.0
    assert v1["skipRate"] == 1.0
    assert v1["observedAverageDepth"] == 8.0
    assert v1["directChildYansiCount"] == 7
    assert v1["journeyVersion"] == 1

    # Default version is current published (v2) — v1 history stays on v1.
    current = await _metrics(db, journey_version=None, child_count=7)
    assert current["journeyVersion"] == 2
    assert current["experienceStartedCount"] == 0


@pytest.mark.asyncio
async def test_version_metrics_remain_separate(db):
    for _ in range(2):
        sid = str(uuid.uuid4())
        await _ingest(
            db,
            eventId=str(uuid.uuid4()),
            experienceSessionId=sid,
            eventType=YANSI_EXPERIENCE_STARTED,
            journeyVersion=1,
        )
    sid_v2 = str(uuid.uuid4())
    await _ingest(
        db,
        eventId=str(uuid.uuid4()),
        experienceSessionId=sid_v2,
        eventType=YANSI_EXPERIENCE_STARTED,
        journeyVersion=2,
    )
    await _ingest(
        db,
        eventId=str(uuid.uuid4()),
        experienceSessionId=sid_v2,
        eventType=YANSI_EXPERIENCE_COMPLETED,
        journeyVersion=2,
        completedStepCount=8,
    )
    v1 = await _metrics(db, journey_version=1)
    v2 = await _metrics(db, journey_version=2)
    assert v1["experienceStartedCount"] == 2
    assert v1["experienceCompletedCount"] == 0
    assert v2["experienceStartedCount"] == 1
    assert v2["experienceCompletedCount"] == 1


@pytest.mark.asyncio
async def test_authenticated_user_two_sessions_are_two_experiences(db):
    for _ in range(2):
        await _ingest(
            db,
            eventId=str(uuid.uuid4()),
            experienceSessionId=str(uuid.uuid4()),
            eventType=YANSI_EXPERIENCE_STARTED,
            journeyVersion=1,
            viewer_user_id="bob",
        )
    metrics = await _metrics(db, journey_version=1)
    assert metrics["experienceStartedCount"] == 2


@pytest.mark.asyncio
async def test_semantic_started_dedupe_does_not_inflate(db):
    sid = str(uuid.uuid4())
    await _ingest(
        db,
        eventId=str(uuid.uuid4()),
        experienceSessionId=sid,
        eventType=YANSI_EXPERIENCE_STARTED,
        journeyVersion=1,
    )
    dup = await _ingest(
        db,
        eventId=str(uuid.uuid4()),
        experienceSessionId=sid,
        eventType=YANSI_EXPERIENCE_STARTED,
        journeyVersion=1,
    )
    assert dup["duplicate"] is True
    metrics = await _metrics(db, journey_version=1)
    assert metrics["experienceStartedCount"] == 1


@pytest.mark.asyncio
async def test_invalid_target_rejected(db):
    with pytest.raises(YansiMetricsError) as exc:
        await _metrics(db, slug="private-only", journey_version=1)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_child_count_eligible_direct_only_authors_irrelevant():
    parent = SimpleNamespace(
        slug="yansi-a",
        parent_slug=None,
        published_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
        created_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
        visibility="public",
        safety_status="open",
        artifact_kind=ARTIFACT_KIND_JOURNEY_V1,
        freeze_status=FREEZE_STATUS_FROZEN,
        card_title="A",
        scene_image_url=None,
        public_payload={},
        private_payload={},
        user_id=uuid.uuid4(),
    )

    def _child(slug, **kw):
        return SimpleNamespace(
            slug=slug,
            parent_slug=kw.get("parent_slug", "yansi-a"),
            published_at=kw.get("published_at", datetime(2026, 8, 2, tzinfo=timezone.utc)),
            created_at=datetime(2026, 8, 2, tzinfo=timezone.utc),
            visibility=kw.get("visibility", "public"),
            safety_status=kw.get("safety_status", "open"),
            artifact_kind=kw.get("artifact_kind", ARTIFACT_KIND_JOURNEY_V1),
            freeze_status=kw.get("freeze_status", FREEZE_STATUS_FROZEN),
            card_title=slug,
            scene_image_url=None,
            public_payload={},
            private_payload={},
            user_id=kw.get("user_id", uuid.uuid4()),
        )

    bob = _child("child-b", user_id=uuid.uuid4())
    carol = _child("child-c", user_id=uuid.uuid4())
    private = _child("child-d", visibility="private")
    unfrozen = _child("child-e", freeze_status=FREEZE_STATUS_NON_FROZEN)
    # Grandchild F would not appear in SQL for parent=A.
    sql_direct = [bob, carol, private, unfrozen]

    db = AsyncMock()
    db.execute = AsyncMock(
        return_value=SimpleNamespace(
            scalars=lambda: SimpleNamespace(all=lambda: sql_direct)
        )
    )

    async def _get_parent(_db, slug):
        return parent if slug == "yansi-a" else None

    async def _public(_db, *, slug, journey_version=None):
        if slug in {"child-b", "child-c"}:
            return {"slug": slug, "replayReady": True}
        return None

    with (
        patch(
            "backend.services.mirror_network.author_profile.get_mirror_network_node_by_slug",
            new=_get_parent,
        ),
        patch(
            "backend.services.mirror_network.author_profile.get_public_frozen_journey_artifact",
            new=_public,
        ),
    ):
        count = await count_eligible_direct_children(db, parent_slug="yansi-a")
    assert count == 2


@pytest.mark.asyncio
async def test_http_metrics_privacy_and_404():
    from fastapi.testclient import TestClient

    from backend.core.utils.dependencies import get_db
    from backend.main import app

    async def _fake_db():
        yield AsyncMock()

    app.dependency_overrides[get_db] = _fake_db
    payload = public_metrics_dict(
        slug="yansi-a",
        journey_version=1,
        aggregates=compute_experience_aggregates(
            [("s1", YANSI_EXPERIENCE_STARTED, 0)], selected_count=8
        ),
        direct_child_yansi_count=7,
    )
    try:
        with (
            patch(
                "backend.routers.mirror_network.rate_limit_standalone",
                new=AsyncMock(return_value=None),
            ),
            patch(
                "backend.routers.mirror_network.get_yansi_public_metrics",
                new=AsyncMock(return_value=payload),
            ),
        ):
            client = TestClient(app)
            ok = client.get("/api/mirror-network/yansi-a/metrics")
            assert ok.status_code == 200
            body = ok.json()
            assert set(body.keys()) == set(PUBLIC_METRIC_KEYS)
            assert body["experienceStartedCount"] == 1
            assert body["directChildYansiCount"] == 7
            assert "experienceSessionId" not in body
            assert "viewerUserId" not in body
            assert "eventId" not in body
            assert "ownContinuationStartedCount" not in body

        with (
            patch(
                "backend.routers.mirror_network.rate_limit_standalone",
                new=AsyncMock(return_value=None),
            ),
            patch(
                "backend.routers.mirror_network.get_yansi_public_metrics",
                new=AsyncMock(
                    side_effect=YansiMetricsError("frozen_journey_not_found", status_code=404)
                ),
            ),
        ):
            client = TestClient(app)
            missing = client.get("/api/mirror-network/nope/metrics")
            assert missing.status_code == 404
    finally:
        app.dependency_overrides.pop(get_db, None)
