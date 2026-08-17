# -*- coding: utf-8 -*-
"""Phase 6.2.1 — batch canonical metrics projection for Discover/Profile."""

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

from backend.models.yansi_experience_event import (
    YANSI_EXPERIENCE_STARTED,
    YansiExperienceEvent,
)
from backend.services.mirror_network.discover import list_discover_mirrors
from backend.services.mirror_network.yansi_metrics import (
    count_started_sessions_batch,
    get_yansi_public_metrics,
    get_yansi_public_metrics_batch,
)


async def _insert_started(db: AsyncSession, slug: str, version: int, n: int) -> None:
    for i in range(n):
        db.add(
            YansiExperienceEvent(
                event_id=str(uuid.uuid4()),
                experience_session_id=str(uuid.uuid4()),
                event_type=YANSI_EXPERIENCE_STARTED,
                mirror_slug=slug,
                journey_version=version,
            )
        )
    await db.commit()


@pytest.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(YansiExperienceEvent.__table__.create)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_started_batch_is_grouped_distinct_and_version_scoped(db: AsyncSession):
    await _insert_started(db, "yansi-a", 1, 140)
    await _insert_started(db, "yansi-a", 2, 20)
    await _insert_started(db, "yansi-b", 1, 18)

    counts = await count_started_sessions_batch(
        db, [("yansi-a", 1), ("yansi-a", 2), ("yansi-b", 1), ("yansi-c", 1)]
    )
    assert counts[("yansi-a", 1)] == 140
    assert counts[("yansi-a", 2)] == 20
    assert counts[("yansi-b", 1)] == 18
    assert counts[("yansi-c", 1)] == 0


@pytest.mark.asyncio
async def test_batch_does_not_loop_single_metrics_service(db: AsyncSession):
    await _insert_started(db, "yansi-a", 1, 3)
    await _insert_started(db, "yansi-b", 1, 2)
    with (
        patch(
            "backend.services.mirror_network.yansi_metrics.count_eligible_direct_children_batch",
            new=AsyncMock(return_value={"yansi-a": 7, "yansi-b": 2}),
        ),
        patch(
            "backend.services.mirror_network.yansi_metrics.get_yansi_public_metrics",
            new=AsyncMock(side_effect=AssertionError("must not N+1 single metrics")),
        ),
    ):
        out = await get_yansi_public_metrics_batch(
            db, [("yansi-a", 1), ("yansi-b", 1)]
        )
    assert out[("yansi-a", 1)]["experienceStartedCount"] == 3
    assert out[("yansi-a", 1)]["directChildYansiCount"] == 7
    assert out[("yansi-b", 1)]["experienceStartedCount"] == 2
    assert "completionRate" not in out[("yansi-a", 1)]
    assert get_yansi_public_metrics  # frozen 6.1 still imported, unused here


@pytest.mark.asyncio
async def test_batch_only_aggregates_requested_page_pairs(db: AsyncSession):
    await _insert_started(db, "page-1", 1, 5)
    await _insert_started(db, "page-2", 1, 99)
    counts = await count_started_sessions_batch(db, [("page-1", 1)])
    assert ("page-2", 1) not in counts
    assert counts[("page-1", 1)] == 5


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
        artifact_kind="journey_v1",
        freeze_status="frozen",
    )


def _empty_result():
    return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))


@pytest.mark.asyncio
async def test_discover_order_unchanged_and_not_sorted_by_started():
    """En Yeni is published_at DESC; STARTED counts must not rerank."""
    high_started = _root("popular", 1.0)
    recent_more_children = _root("children-rich", 2.0)
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
    roots = SimpleNamespace(
        scalars=lambda: SimpleNamespace(all=lambda: [high_started, recent_more_children])
    )
    children = SimpleNamespace(
        scalars=lambda: SimpleNamespace(all=lambda: [child_a, child_b, child_c])
    )
    db.execute = AsyncMock(side_effect=[roots, _empty_result(), children])

    captured: list[list[tuple[str, int]]] = []

    async def fake_batch(_db, pairs):
        captured.append(list(pairs))
        return {
            ("popular", 1): {"experienceStartedCount": 10000, "directChildYansiCount": 1},
            ("children-rich", 1): {
                "experienceStartedCount": 1,
                "directChildYansiCount": 2,
            },
        }

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
            "backend.services.mirror_network.discover.is_replay_ready_from_loaded_child",
            return_value=True,
        ),
        patch(
            "backend.services.mirror_network.yansi_metrics.get_yansi_public_metrics_batch",
            new=fake_batch,
        ),
    ):
        response = await list_discover_mirrors(db, limit=10, offset=0, mode="newest")

    assert [item.slug for item in response.items] == ["children-rich", "popular"]
    assert response.items[0].experienceStartedCount == 1
    assert response.items[1].experienceStartedCount == 10000
    assert captured and captured[0] == [("children-rich", 1), ("popular", 1)]


@pytest.mark.asyncio
async def test_discover_pagination_batches_page_only():
    roots = [_root(f"r{i}", float(i)) for i in range(3)]
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: roots)),
            _empty_result(),
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [])),
        ]
    )
    captured: list[list[tuple[str, int]]] = []

    async def fake_batch(_db, pairs):
        captured.append(list(pairs))
        return {pair: {"experienceStartedCount": 0, "directChildYansiCount": 0} for pair in pairs}

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
            "backend.services.mirror_network.discover.is_replay_ready_from_loaded_child",
            return_value=True,
        ),
        patch(
            "backend.services.mirror_network.yansi_metrics.get_yansi_public_metrics_batch",
            new=fake_batch,
        ),
    ):
        await list_discover_mirrors(db, limit=1, offset=0, mode="newest")

    assert len(captured[0]) == 1
    assert captured[0][0][0] == "r2"  # published_at DESC, page-only metrics batch


@pytest.mark.asyncio
async def test_discover_metrics_failure_keeps_feed():
    root = _root("root-open", 1.0)
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [root])),
            _empty_result(),
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [])),
        ]
    )

    async def boom(*_args, **_kwargs):
        raise RuntimeError("metrics down")

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
            "backend.services.mirror_network.discover.is_replay_ready_from_loaded_child",
            return_value=True,
        ),
        patch(
            "backend.services.mirror_network.yansi_metrics.get_yansi_public_metrics_batch",
            new=boom,
        ),
    ):
        response = await list_discover_mirrors(db, limit=10, offset=0)

    assert response.total == 1
    assert response.items[0].slug == "root-open"
    assert response.items[0].experienceStartedCount is None
    assert response.items[0].directChildYansiCount is None


@pytest.mark.asyncio
async def test_discover_payload_has_no_session_identity():
    root = _root("root-open", 1.0)
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [root])),
            _empty_result(),
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [])),
        ]
    )

    async def fake_batch(_db, pairs):
        return {
            ("root-open", 1): {"experienceStartedCount": 140, "directChildYansiCount": 7}
        }

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
            "backend.services.mirror_network.discover.is_replay_ready_from_loaded_child",
            return_value=True,
        ),
        patch(
            "backend.services.mirror_network.yansi_metrics.get_yansi_public_metrics_batch",
            new=fake_batch,
        ),
    ):
        response = await list_discover_mirrors(db, limit=10, offset=0)

    dumped = response.model_dump()
    raw = str(dumped)
    assert "experienceSessionId" not in raw
    assert "eventId" not in raw
    assert "viewerUserId" not in raw
    assert dumped["items"][0]["experienceStartedCount"] == 140
    assert dumped["items"][0]["directChildYansiCount"] == 7
    assert "completionRate" not in dumped["items"][0]
