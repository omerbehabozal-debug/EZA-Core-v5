# -*- coding: utf-8 -*-
"""GET /api/mirror-network/discover — public root Ayna list."""

from __future__ import annotations

import json
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.core.schemas.mirror_network import DiscoverMirrorItem, DiscoverMirrorListResponse
from backend.services.mirror_network.discover import list_discover_mirrors
from backend.services.mirror_network.fixtures import build_fixture_mirror_node

client = TestClient(app)

FORBIDDEN_DISCOVER_KEYS = {
    "userId",
    "guestToken",
    "conversationId",
    "mirrorBody",
    "private_payload",
}


def _root_node(*, slug: str, scene: str = "https://cdn.example/mirror.png"):
    record = build_fixture_mirror_node(slug_suffix=slug.split("-")[-1])
    record.slug = slug
    record.parent_slug = None
    record.visibility = "public"
    record.safety_status = "open"
    record.scene_image_url = scene
    return record


def _child_node(*, slug: str, parent: str):
    record = build_fixture_mirror_node(slug_suffix=slug.split("-")[-1])
    record.slug = slug
    record.parent_slug = parent
    record.visibility = "public"
    record.safety_status = "open"
    return record


@pytest.mark.asyncio
async def test_list_discover_mirrors_root_only_sorted_by_yansi():
    db = AsyncMock()
    root_a = _root_node(slug="root-a")
    root_b = _root_node(slug="root-b")
    child_a1 = _child_node(slug="child-a1", parent="root-a")
    child_a2 = _child_node(slug="child-a2", parent="root-a")
    child_b1 = _child_node(slug="child-b1", parent="root-b")

    roots_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [root_a, root_b]))
    children_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [child_a1, child_a2, child_b1]))

    db.execute = AsyncMock(side_effect=[roots_result, children_result])

    response = await list_discover_mirrors(db, limit=10, offset=0)
    assert response.total == 2
    assert [item.slug for item in response.items] == ["root-a", "root-b"]
    assert response.items[0].yansiCount == 2
    assert response.items[1].yansiCount == 1
    assert response.items[0].sceneImageUrl.startswith("https://")


@pytest.mark.asyncio
async def test_list_discover_excludes_restricted_and_child_nodes():
    db = AsyncMock()
    root = _root_node(slug="root-open")
    restricted = _root_node(slug="root-restricted")
    restricted.safety_status = "restricted"
    child_as_root = _child_node(slug="child-only", parent="root-open")

    roots_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [root, restricted, child_as_root]))
    children_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))

    db.execute = AsyncMock(side_effect=[roots_result, children_result])

    response = await list_discover_mirrors(db, limit=10, offset=0)
    assert response.total == 1
    assert response.items[0].slug == "root-open"


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
