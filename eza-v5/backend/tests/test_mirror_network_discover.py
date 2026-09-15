# -*- coding: utf-8 -*-
"""GET /api/mirror-network/discover — eligible public Yansı (independent products)."""

from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.core.schemas.mirror_network import DiscoverMirrorItem, DiscoverMirrorListResponse
from backend.services.mirror_network.discover import (
    is_canonical_discover_node_structure,
    is_public_discover_scene_url,
    is_public_discover_yansi_child,
    list_discover_mirrors,
)
from backend.services.mirror_network.fixtures import build_fixture_mirror_node

client = TestClient(app)

FORBIDDEN_DISCOVER_KEYS = {
    "userId",
    "guestToken",
    "conversationId",
    "mirrorBody",
    "private_payload",
    "email",
    "accountTier",
    "role",
    "ezaScore",
    "rankingEvidence",
}


def _eligible_node(
    *,
    slug: str,
    scene: str = "https://cdn.example/mirror.png",
    parent_slug: str | None = None,
    visibility: str = "public",
    safety: str = "open",
    published: bool = True,
    artifact_kind: str = "journey_v1",
    freeze_status: str = "frozen",
    user_id=None,
):
    record = build_fixture_mirror_node(slug_suffix=slug.split("-")[-1])
    record.slug = slug
    record.parent_slug = parent_slug
    record.visibility = visibility
    record.safety_status = safety
    record.scene_image_url = scene
    record.artifact_kind = artifact_kind
    record.freeze_status = freeze_status
    if not published:
        record.published_at = None
    if user_id is not None:
        record.user_id = user_id
    return record


def _root_node(*, slug: str, scene: str = "https://cdn.example/mirror.png"):
    return _eligible_node(slug=slug, scene=scene, parent_slug=None)


def _empty_result():
    return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))


def _child_node(*, slug: str, parent: str, visibility: str = "public", safety: str = "open"):
    record = build_fixture_mirror_node(slug_suffix=slug.split("-")[-1])
    record.slug = slug
    record.parent_slug = parent
    record.visibility = visibility
    record.safety_status = safety
    return record


def test_is_public_discover_scene_url_rejects_side_effect_schemes():
    assert is_public_discover_scene_url("https://cdn.example/a.png") is True
    assert is_public_discover_scene_url("http://cdn.example/a.png") is False
    assert is_public_discover_scene_url("data:image/png;base64,abc") is False
    assert is_public_discover_scene_url("blob:https://example.com/uuid") is False
    assert is_public_discover_scene_url("") is False


def test_is_public_discover_yansi_child_excludes_review_and_private():
    public_child = _child_node(slug="child-public", parent="root-a")
    review_child = _child_node(slug="child-review", parent="root-a", visibility="review")
    private_child = _child_node(slug="child-private", parent="root-a", visibility="private")
    restricted_child = _child_node(slug="child-restricted", parent="root-a", safety="restricted")

    assert is_public_discover_yansi_child(public_child) is True
    assert is_public_discover_yansi_child(review_child) is False
    assert is_public_discover_yansi_child(private_child) is False
    assert is_public_discover_yansi_child(restricted_child) is False


def test_canonical_structure_allows_linked_nodes():
    linked = _eligible_node(slug="yansi-b", parent_slug="yansi-a")
    assert is_canonical_discover_node_structure(linked) is True
    private = _eligible_node(slug="yansi-priv", parent_slug="yansi-a", visibility="private")
    assert is_canonical_discover_node_structure(private) is False


@pytest.mark.asyncio
async def test_list_discover_mirrors_preserves_yansi_count_dto():
    db = AsyncMock()
    root_a = _root_node(slug="root-a")
    root_b = _root_node(slug="root-b")
    child_a1 = _child_node(slug="child-a1", parent="root-a")
    child_a2 = _child_node(slug="child-a2", parent="root-a")
    child_b1 = _child_node(slug="child-b1", parent="root-b")

    roots_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [root_a, root_b]))
    children_result = SimpleNamespace(
        scalars=lambda: SimpleNamespace(all=lambda: [child_a1, child_a2, child_b1])
    )

    db.execute = AsyncMock(side_effect=[roots_result, _empty_result(), children_result])

    with patch(
        "backend.services.mirror_network.discover.is_replay_ready_from_loaded_child",
        return_value=True,
    ):
        response = await list_discover_mirrors(db, limit=10, offset=0, mode="newest")

    assert response.total == 2
    assert response.mode == "newest"
    by_slug = {item.slug: item for item in response.items}
    assert by_slug["root-a"].yansiCount == 2
    assert by_slug["root-b"].yansiCount == 1
    assert response.items[0].sceneImageUrl.startswith("https://")


@pytest.mark.asyncio
async def test_list_discover_excludes_data_scene_and_review_yansi():
    db = AsyncMock()
    root_https = _root_node(slug="root-open", scene="https://cdn.example/open.png")
    root_data = _root_node(slug="root-data", scene="data:image/png;base64,abc")
    review_child = _child_node(slug="child-review", parent="root-open", visibility="review")

    roots_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [root_https, root_data]))
    children_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [review_child]))

    db.execute = AsyncMock(side_effect=[roots_result, _empty_result(), children_result])

    with patch(
        "backend.services.mirror_network.discover.is_replay_ready_from_loaded_child",
        return_value=True,
    ):
        response = await list_discover_mirrors(db, limit=10, offset=0, mode="newest")
    assert response.total == 1
    assert response.items[0].slug == "root-open"
    assert response.items[0].yansiCount == 0


@pytest.mark.asyncio
async def test_list_discover_excludes_restricted_includes_valid_linked():
    db = AsyncMock()
    root = _root_node(slug="root-open")
    restricted = _root_node(slug="root-restricted")
    restricted.safety_status = "restricted"
    linked = _eligible_node(slug="child-ok", parent_slug="root-open")

    pool_result = SimpleNamespace(
        scalars=lambda: SimpleNamespace(all=lambda: [root, restricted, linked])
    )
    children_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))

    db.execute = AsyncMock(side_effect=[pool_result, _empty_result(), children_result])

    with patch(
        "backend.services.mirror_network.discover.is_replay_ready_from_loaded_child",
        return_value=True,
    ):
        response = await list_discover_mirrors(db, limit=10, offset=0, mode="newest")
    slugs = {item.slug for item in response.items}
    assert slugs == {"root-open", "child-ok"}
    assert response.total == 2


@pytest.mark.asyncio
async def test_discover_includes_a_b_c_and_cross_owner_d():
    owner_a = uuid4()
    owner_m = uuid4()
    a = _eligible_node(slug="yansi-a", parent_slug=None, user_id=owner_a)
    b = _eligible_node(slug="yansi-b", parent_slug="yansi-a", user_id=owner_a)
    c = _eligible_node(slug="yansi-c", parent_slug="yansi-b", user_id=owner_a)
    d = _eligible_node(slug="yansi-d", parent_slug="yansi-b", user_id=owner_m)

    db = AsyncMock()
    pool_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [a, b, c, d]))
    children_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))
    db.execute = AsyncMock(side_effect=[pool_result, _empty_result(), children_result])

    with patch(
        "backend.services.mirror_network.discover.is_replay_ready_from_loaded_child",
        return_value=True,
    ):
        response = await list_discover_mirrors(db, limit=20, offset=0, mode="newest")

    slugs = {item.slug for item in response.items}
    assert slugs == {"yansi-a", "yansi-b", "yansi-c", "yansi-d"}
    assert response.total == 4


@pytest.mark.asyncio
async def test_linked_invalid_nodes_excluded_while_valid_linked_kept():
    valid = _eligible_node(slug="linked-ok", parent_slug="parent-a")
    private = _eligible_node(slug="linked-private", parent_slug="parent-a", visibility="private")
    unpublished = _eligible_node(slug="linked-unpub", parent_slug="parent-a", published=False)
    unfrozen = _eligible_node(
        slug="linked-unfrozen", parent_slug="parent-a", freeze_status="non_frozen"
    )
    no_scene = _eligible_node(
        slug="linked-noscene",
        parent_slug="parent-a",
        scene="data:image/png;base64,abc",
    )
    restricted = _eligible_node(slug="linked-restricted", parent_slug="parent-a")
    restricted.safety_status = "restricted"

    db = AsyncMock()
    pool_result = SimpleNamespace(
        scalars=lambda: SimpleNamespace(
            all=lambda: [valid, private, unpublished, unfrozen, no_scene, restricted]
        )
    )
    children_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))
    db.execute = AsyncMock(side_effect=[pool_result, _empty_result(), children_result])

    with patch(
        "backend.services.mirror_network.discover.is_replay_ready_from_loaded_child",
        side_effect=lambda node, _steps: node.slug != "linked-not-ready",
    ):
        response = await list_discover_mirrors(db, limit=20, offset=0, mode="newest")

    assert {item.slug for item in response.items} == {"linked-ok"}
    assert response.total == 1


@pytest.mark.asyncio
async def test_linked_replay_not_ready_excluded():
    linked = _eligible_node(slug="linked-not-ready", parent_slug="parent-a")
    db = AsyncMock()
    pool_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [linked]))
    children_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))
    db.execute = AsyncMock(side_effect=[pool_result, _empty_result(), children_result])

    with patch(
        "backend.services.mirror_network.discover.is_replay_ready_from_loaded_child",
        return_value=False,
    ):
        response = await list_discover_mirrors(db, limit=10, offset=0, mode="newest")
    assert response.total == 0
    assert response.items == []


@pytest.mark.asyncio
async def test_child_remains_eligible_when_parent_private():
    """Child Discover eligibility is independent of parent availability."""
    child = _eligible_node(slug="yansi-b", parent_slug="yansi-a-private")
    db = AsyncMock()
    pool_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [child]))
    children_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))
    db.execute = AsyncMock(side_effect=[pool_result, _empty_result(), children_result])

    with patch(
        "backend.services.mirror_network.discover.is_replay_ready_from_loaded_child",
        return_value=True,
    ):
        response = await list_discover_mirrors(db, limit=10, offset=0, mode="newest")
    assert response.total == 1
    assert response.items[0].slug == "yansi-b"


@pytest.mark.asyncio
async def test_discover_pagination_unchanged_with_linked_pool():
    nodes = [
        _eligible_node(slug=f"yansi-{i:02d}", parent_slug=None if i == 0 else "yansi-00")
        for i in range(5)
    ]
    db = AsyncMock()
    pool_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: nodes))
    children_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))
    db.execute = AsyncMock(side_effect=[pool_result, _empty_result(), children_result])

    with patch(
        "backend.services.mirror_network.discover.is_replay_ready_from_loaded_child",
        return_value=True,
    ):
        page0 = await list_discover_mirrors(db, limit=2, offset=0, mode="newest")
        db.execute = AsyncMock(side_effect=[pool_result, _empty_result(), children_result])
        page1 = await list_discover_mirrors(db, limit=2, offset=2, mode="newest")

    assert page0.total == 5
    assert page1.total == 5
    assert len(page0.items) == 2
    assert len(page1.items) == 2
    assert {i.slug for i in page0.items}.isdisjoint({i.slug for i in page1.items})


def test_discover_endpoint_returns_items():
    fake = DiscoverMirrorListResponse(
        items=[
            DiscoverMirrorItem(
                slug="root-a",
                title="BMW Sport",
                description="Merak",
                sceneImageUrl="https://cdn.example/a.png",
                yansiCount=3,
                createdAt="2026-01-01T00:00:00+00:00",
            )
        ],
        total=1,
    )

    with patch(
        "backend.routers.mirror_network.list_discover_mirrors",
        new=AsyncMock(return_value=fake),
    ):
        res = client.get("/api/mirror-network/discover")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["slug"] == "root-a"
    assert body["items"][0]["yansiCount"] == 3
    raw = json.dumps(body)
    for key in FORBIDDEN_DISCOVER_KEYS:
        assert key not in raw


def test_discover_route_not_shadowed_by_slug():
    fake = DiscoverMirrorListResponse(items=[], total=0)
    with patch(
        "backend.routers.mirror_network.list_discover_mirrors",
        new=AsyncMock(return_value=fake),
    ):
        res = client.get("/api/mirror-network/discover")
    assert res.status_code == 200
