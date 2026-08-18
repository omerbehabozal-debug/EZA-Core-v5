# -*- coding: utf-8 -*-
"""Phase 7.1 — Discover modes foundation + Rastlantısal selection."""

from __future__ import annotations

import inspect
from contextlib import contextmanager
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.routers import mirror_network as mirror_router
from backend.services.mirror_network import discover as discover_mod
from backend.services.mirror_network.discover import (
    DEFAULT_DISCOVER_MODE,
    DiscoverModeError,
    list_discover_mirrors,
    parse_discover_mode,
    parse_random_session,
    random_discover_sort_key,
)

client = TestClient(app)

FORBIDDEN_RANKING_TOKENS = (
    "yansi_signal_semantics",
    "yansi_normalization",
    "compositeScore",
    "curiosityScore",
    "qualityScore",
    "rankScore",
    "follower",
    "collaborative",
    "embedding",
)


def _root(
    slug: str,
    *,
    published_ts: float = 1.0,
    visibility: str = "public",
    safety: str = "open",
    published: bool = True,
    artifact_kind: str = "journey_v1",
    freeze_status: str = "frozen",
    parent_slug: str | None = None,
    scene: str = "https://cdn.example/a.png",
):
    ts = datetime.fromtimestamp(published_ts, tz=timezone.utc) if published else None
    created = datetime.fromtimestamp(published_ts + 1000, tz=timezone.utc)
    return SimpleNamespace(
        slug=slug,
        parent_slug=parent_slug,
        visibility=visibility,
        safety_status=safety,
        scene_image_url=scene,
        public_payload={"publicTitle": slug},
        private_payload={},
        card_title=slug,
        published_at=ts,
        created_at=created,
        journey_version=1,
        artifact_kind=artifact_kind,
        freeze_status=freeze_status,
    )


def _empty():
    return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))


def _db(roots, children=None):
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: list(roots))),
            _empty(),
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: list(children or []))),
        ]
    )
    return db


@contextmanager
def _ready(**metrics):
    async def fake_batch(_db, pairs):
        out = {}
        for slug, version in pairs:
            row = metrics.get(slug, {"experienceStartedCount": 0, "directChildYansiCount": 0})
            out[(slug, version)] = row
        return out

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
        yield


def test_missing_mode_is_rastlantisal():
    assert parse_discover_mode(None) == "random"
    assert parse_discover_mode("") == "random"
    assert parse_discover_mode("   ") == "random"
    assert DEFAULT_DISCOVER_MODE == "random"


def test_invalid_mode_rejected_not_remapped():
    with pytest.raises(DiscoverModeError) as exc:
        parse_discover_mode("popular")
    assert exc.value.reason == "invalid_discover_mode"
    with pytest.raises(DiscoverModeError):
        parse_discover_mode("yansiCount")
    with pytest.raises(DiscoverModeError):
        parse_discover_mode("strong-curiosity")


@pytest.mark.asyncio
async def test_invalid_mode_rejected_before_query():
    db = AsyncMock()
    with pytest.raises(DiscoverModeError):
        await list_discover_mirrors(db, mode="garbage")
    db.execute.assert_not_called()


def test_discover_endpoint_invalid_mode_422():
    with patch(
        "backend.routers.mirror_network.list_discover_mirrors",
        new=AsyncMock(side_effect=DiscoverModeError("invalid_discover_mode")),
    ):
        res = client.get("/api/mirror-network/discover?mode=popular")
    assert res.status_code == 422
    assert res.json()["detail"]["error"] == "invalid_discover_mode"


def test_discover_endpoint_missing_mode_calls_service_with_none():
    captured = {}

    async def fake_list(*_args, **kwargs):
        captured.update(kwargs)
        from backend.core.schemas.mirror_network import DiscoverMirrorListResponse

        return DiscoverMirrorListResponse(items=[], total=0, mode="random")

    with patch(
        "backend.routers.mirror_network.list_discover_mirrors",
        new=fake_list,
    ):
        res = client.get("/api/mirror-network/discover")
    assert res.status_code == 200
    assert captured.get("mode") is None
    assert res.json()["mode"] == "random"


def test_random_sort_key_uses_only_seed_and_slug():
    src = inspect.getsource(random_discover_sort_key)
    assert "yansiCount" not in src
    assert "experienceStartedCount" not in src
    assert "published_at" not in src
    a = random_discover_sort_key("session-aa", "popular-root")
    b = random_discover_sort_key("session-aa", "quiet-root")
    assert a != b
    assert random_discover_sort_key("session-aa", "popular-root") == a


def test_same_session_same_order_keys():
    slugs = [f"root-{i:03d}" for i in range(12)]
    seed = "stable-session-seed-01"
    first = [random_discover_sort_key(seed, s) for s in slugs]
    second = [random_discover_sort_key(seed, s) for s in slugs]
    assert first == second


def test_different_session_changes_permutation():
    slugs = [f"root-{i:03d}" for i in range(12)]
    order_a = sorted(slugs, key=lambda s: random_discover_sort_key("seed-alpha-01", s))
    order_b = sorted(slugs, key=lambda s: random_discover_sort_key("seed-bravo-02", s))
    assert order_a != order_b


def test_invalid_random_session_rejected():
    with pytest.raises(DiscoverModeError) as exc:
        parse_random_session("bad session")
    assert exc.value.reason == "invalid_random_session"
    with pytest.raises(DiscoverModeError):
        parse_random_session("short")


def test_ordering_functions_ignore_phase6_and_legacy_counts():
    order_src = inspect.getsource(discover_mod._order_eligible)
    newest_src = inspect.getsource(discover_mod._newest_sort_key)
    list_src = inspect.getsource(list_discover_mirrors)
    assert "yansiCount" not in order_src
    assert "experienceStartedCount" not in order_src
    assert "yansiCount" not in newest_src
    assert "MAX_DISCOVER_CANDIDATE_SCAN" not in list_src
    assert "yansi_signal_semantics" not in inspect.getsource(discover_mod)
    assert "yansi_normalization" not in inspect.getsource(discover_mod)
    assert "yansi_strong_curiosity_candidate" not in inspect.getsource(discover_mod)
    assert "yansi_strong_curiosity_shadow" not in inspect.getsource(discover_mod)
    assert "yansi_strong_curiosity_evaluation" not in inspect.getsource(discover_mod)
    assert "yansi_strong_curiosity_policy" not in inspect.getsource(discover_mod)
    assert "yansi_strong_curiosity_final_shadow" not in inspect.getsource(discover_mod)
    assert "yansi_strong_curiosity_production_shadow" not in inspect.getsource(discover_mod)
    assert "yansi_strong_curiosity_staging_seed" not in inspect.getsource(discover_mod)
    assert "seed_strong_curiosity" not in inspect.getsource(discover_mod)
    for token in FORBIDDEN_RANKING_TOKENS:
        assert token not in order_src
        assert token not in newest_src


@pytest.mark.asyncio
async def test_default_list_is_random_not_yansi_count():
    popular = _root("zzzz-popular", published_ts=1.0)
    quiet = _root("aaaa-quiet", published_ts=9.0)
    db = _db([popular, quiet])
    children = [
        SimpleNamespace(slug="c1", parent_slug="zzzz-popular", visibility="public", safety_status="open"),
        SimpleNamespace(slug="c2", parent_slug="zzzz-popular", visibility="public", safety_status="open"),
    ]
    db.execute = AsyncMock(
        side_effect=[
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [popular, quiet])),
            _empty(),
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: children)),
        ]
    )
    with _ready(
        **{
            "zzzz-popular": {"experienceStartedCount": 100000, "directChildYansiCount": 2},
            "aaaa-quiet": {"experienceStartedCount": 3, "directChildYansiCount": 0},
        }
    ):
        response = await list_discover_mirrors(
            db, limit=10, offset=0, random_session="session-fair-01"
        )
    assert response.mode == "random"
    expected = sorted(
        ["zzzz-popular", "aaaa-quiet"],
        key=lambda s: random_discover_sort_key("session-fair-01", s),
    )
    assert [item.slug for item in response.items] == expected
    by_slug = {item.slug: item for item in response.items}
    assert by_slug["zzzz-popular"].yansiCount == 2
    assert by_slug["aaaa-quiet"].yansiCount == 0


@pytest.mark.asyncio
async def test_high_yansi_count_has_no_random_priority():
    high = _root("high-count")
    low = _root("low-count")
    db = _db([high, low])
    with _ready():
        a = await list_discover_mirrors(
            db, mode="random", random_session="sess-one-aa", limit=10
        )
    db2 = _db([high, low])
    with _ready():
        b = await list_discover_mirrors(
            db2, mode="random", random_session="sess-two-bb", limit=10
        )
    assert a.mode == "random"
    assert [item.slug for item in a.items] != ["high-count"] or len(a.items) == 2
    # Same corpus, different seeds — permutation is seed-driven, not count-driven.
    assert {item.slug for item in a.items} == {item.slug for item in b.items} == {
        "high-count",
        "low-count",
    }
    order_fn = lambda seed: sorted(
        ["high-count", "low-count"], key=lambda s: random_discover_sort_key(seed, s)
    )
    assert [item.slug for item in a.items] == order_fn("sess-one-aa")
    assert [item.slug for item in b.items] == order_fn("sess-two-bb")


@pytest.mark.asyncio
async def test_same_random_session_stable_across_pages_without_duplicates():
    roots = [_root(f"item-{i:02d}", published_ts=float(i)) for i in range(8)]
    seed = "page-stable-session-xx"
    expected = sorted(roots, key=lambda n: random_discover_sort_key(seed, n.slug))
    db1 = _db(roots)
    db2 = _db(roots)
    with _ready():
        page1 = await list_discover_mirrors(
            db1, mode="random", random_session=seed, limit=3, offset=0
        )
        page2 = await list_discover_mirrors(
            db2, mode="random", random_session=seed, limit=3, offset=3
        )
    slugs1 = [item.slug for item in page1.items]
    slugs2 = [item.slug for item in page2.items]
    assert slugs1 == [n.slug for n in expected[:3]]
    assert slugs2 == [n.slug for n in expected[3:6]]
    assert set(slugs1).isdisjoint(slugs2)
    assert page1.randomSession == seed
    assert page2.randomSession == seed


@pytest.mark.asyncio
async def test_random_is_not_limited_to_newest_250():
    newest = [_root(f"new-{i:03d}", published_ts=1000.0 + i) for i in range(250)]
    old = [_root(f"old-{i:03d}", published_ts=float(i)) for i in range(10)]
    roots = newest + old
    db = _db(roots)
    seed = "fair-corpus-session-01"
    with _ready():
        response = await list_discover_mirrors(
            db, mode="random", random_session=seed, limit=48, offset=0
        )
    assert response.total == 260
    expected = sorted(roots, key=lambda n: random_discover_sort_key(seed, n.slug))
    assert {n.slug for n in expected} == {n.slug for n in roots}
    assert any(slug.startswith("old-") for slug in [n.slug for n in expected])
    assert [item.slug for item in response.items] == [n.slug for n in expected[:48]]


@pytest.mark.asyncio
async def test_eligibility_excludes_private_unsafe_unpublished_unfrozen_child():
    public = _root("keep-me")
    private = _root("no-private", visibility="private")
    unsafe = _root("no-unsafe", safety="restricted")
    unpublished = _root("no-pub", published=False)
    unfrozen = _root("no-freeze", freeze_status="non_frozen")
    legacy = _root("no-legacy", artifact_kind="legacy_landing")
    child = _root("no-child", parent_slug="keep-me")
    db = _db([public, private, unsafe, unpublished, unfrozen, legacy, child])
    with _ready():
        response = await list_discover_mirrors(db, mode="newest", limit=20)
    assert [item.slug for item in response.items] == ["keep-me"]
    assert response.total == 1


@pytest.mark.asyncio
async def test_non_replay_ready_excluded():
    node = _root("not-ready")
    db = _db([node])
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
            return_value=False,
        ),
        patch(
            "backend.services.mirror_network.yansi_metrics.get_yansi_public_metrics_batch",
            new=AsyncMock(return_value={}),
        ),
    ):
        response = await list_discover_mirrors(db, mode="newest", limit=10)
    assert response.total == 0
    assert response.items == []


@pytest.mark.asyncio
async def test_en_yeni_uses_published_at_desc_and_slug_tiebreak():
    older = _root("zeta", published_ts=1.0)
    newer_b = _root("beta", published_ts=5.0)
    newer_a = _root("alpha", published_ts=5.0)
    db = _db([older, newer_b, newer_a])
    with _ready():
        response = await list_discover_mirrors(db, mode="newest", limit=10)
    assert [item.slug for item in response.items] == ["alpha", "beta", "zeta"]
    assert response.mode == "newest"
    assert response.randomSession is None
    assert all(item.createdAt is not None for item in response.items)


@pytest.mark.asyncio
async def test_en_yeni_ignores_yansi_count_and_started():
    old_hot = _root("old-hot", published_ts=1.0)
    new_quiet = _root("new-quiet", published_ts=9.0)
    db = AsyncMock()
    children = [
        SimpleNamespace(slug="c1", parent_slug="old-hot", visibility="public", safety_status="open"),
        SimpleNamespace(slug="c2", parent_slug="old-hot", visibility="public", safety_status="open"),
        SimpleNamespace(slug="c3", parent_slug="old-hot", visibility="public", safety_status="open"),
    ]
    db.execute = AsyncMock(
        side_effect=[
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [old_hot, new_quiet])),
            _empty(),
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: children)),
        ]
    )
    with _ready(
        **{
            "old-hot": {"experienceStartedCount": 99999, "directChildYansiCount": 3},
            "new-quiet": {"experienceStartedCount": 1, "directChildYansiCount": 0},
        }
    ):
        response = await list_discover_mirrors(db, mode="newest", limit=10)
    assert [item.slug for item in response.items] == ["new-quiet", "old-hot"]
    assert response.items[0].experienceStartedCount == 1
    assert response.items[1].experienceStartedCount == 99999
    assert response.items[1].yansiCount == 3


@pytest.mark.asyncio
async def test_started_does_not_change_random_order():
    a = _root("root-a")
    b = _root("root-b")
    seed = "started-neutral-seed01"
    expected = sorted(
        ["root-a", "root-b"], key=lambda s: random_discover_sort_key(seed, s)
    )
    db = _db([a, b])
    with _ready(
        **{
            "root-a": {"experienceStartedCount": 1, "directChildYansiCount": 0},
            "root-b": {"experienceStartedCount": 50000, "directChildYansiCount": 0},
        }
    ):
        response = await list_discover_mirrors(
            db, mode="random", random_session=seed, limit=10
        )
    assert [item.slug for item in response.items] == expected


@pytest.mark.asyncio
async def test_public_metrics_still_projected_on_page():
    node = _root("metrics-root")
    db = _db([node])
    with _ready(
        **{"metrics-root": {"experienceStartedCount": 140, "directChildYansiCount": 7}}
    ):
        response = await list_discover_mirrors(db, mode="newest", limit=10)
    assert response.items[0].experienceStartedCount == 140
    assert response.items[0].directChildYansiCount == 7
    src = inspect.getsource(discover_mod._project_discover_page)
    assert "get_yansi_public_metrics_batch" in src
    assert "get_yansi_public_metrics(" not in src.replace("get_yansi_public_metrics_batch", "")


@pytest.mark.asyncio
async def test_strong_curiosity_disabled_fail_closes_not_legacy_ranking():
    popular = _root("hot")
    quiet = _root("quiet")
    db = _db([popular, quiet])
    with patch(
        "backend.services.mirror_network.yansi_strong_curiosity_live.is_strong_curiosity_discover_enabled",
        return_value=False,
    ), _ready():
        response = await list_discover_mirrors(db, mode="strong_curiosity", limit=10)
    assert response.mode == "strong_curiosity"
    assert response.strongCuriosityReady is False
    assert response.items == []
    assert response.total == 0
    db.execute.assert_not_called()
    src = inspect.getsource(list_discover_mirrors)
    assert "evaluate_discover_strong_curiosity_pool" not in src
    assert "run_strong_curiosity_shadow_ordering" not in src
    assert "yansi_strong_curiosity_shadow" not in inspect.getsource(discover_mod)
    assert "yansi_strong_curiosity_evaluation" not in inspect.getsource(discover_mod)
    assert "yansi_strong_curiosity_policy" not in inspect.getsource(discover_mod)
    assert "yansi_strong_curiosity_final_shadow" not in inspect.getsource(discover_mod)
    assert "yansi_strong_curiosity_production_shadow" not in inspect.getsource(discover_mod)
    assert "yansi_strong_curiosity_staging_seed" not in inspect.getsource(discover_mod)
    assert "seed_strong_curiosity" not in inspect.getsource(discover_mod)


def test_root_only_sql_gate_present():
    src = inspect.getsource(discover_mod.load_discover_eligible_roots)
    assert "parent_slug.is_(None)" in src
    assert "published_at.isnot(None)" in src
    assert "ARTIFACT_KIND_JOURNEY_V1" in src
    assert "FREEZE_STATUS_FROZEN" in src
    assert "is_replay_ready_from_loaded_child" in src


def test_discover_router_has_no_per_card_metrics_or_signal_imports():
    src = inspect.getsource(mirror_router.get_mirror_network_discover)
    assert "/metrics" not in src
    assert "yansi_signal_semantics" not in src
    assert "yansi_normalization" not in src
    router_src = inspect.getsource(mirror_router)
    assert "get_yansi_normalized_signal_evidence" not in inspect.getsource(
        mirror_router.get_mirror_network_discover
    )
    del router_src
