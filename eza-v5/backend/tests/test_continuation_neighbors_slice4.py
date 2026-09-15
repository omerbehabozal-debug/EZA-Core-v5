# -*- coding: utf-8 -*-
"""Slice 4 — true continuation neighbors (not parent_slug /children)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from backend.models.mirror_network import ARTIFACT_KIND_JOURNEY_V1
from backend.services.mirror_network.continuation_neighbors import (
    ContinuationNeighborsError,
    get_continuation_neighbors,
)
from backend.services.mirror_network.frozen_journey_artifact import FREEZE_STATUS_FROZEN
from backend.services.mirror_network.journey_window_contract import block_range


OWNER = uuid.uuid4()
OWNER2 = uuid.uuid4()
CONV = "conv-c1"
CONV2 = "conv-c2"


def _ts() -> datetime:
    return datetime(2026, 9, 1, tzinfo=timezone.utc)


def _node(
    *,
    slug: str,
    window_index: int,
    user_id=OWNER,
    conversation_id: str = CONV,
    visibility: str = "public",
    safety_status: str = "open",
    freeze_status: str = FREEZE_STATUS_FROZEN,
    published: bool = True,
    parent_slug: str | None = None,
    journey_version: int = 1,
    artifact_kind: str = ARTIFACT_KIND_JOURNEY_V1,
    bad_bounds: bool = False,
):
    start, end = block_range(window_index)
    if bad_bounds:
        start, end = start + 1, end + 1
    return SimpleNamespace(
        id=uuid.uuid4(),
        slug=slug,
        user_id=user_id,
        conversation_id=conversation_id,
        window_index=window_index,
        window_start=start,
        window_end=end,
        visibility=visibility,
        safety_status=safety_status,
        freeze_status=freeze_status,
        published_at=_ts() if published else None,
        artifact_kind=artifact_kind,
        journey_version=journey_version,
        parent_slug=parent_slug,
        scene_image_url=f"https://cdn.example/{slug}.jpg",
        private_payload={},
        public_payload={},
    )


def _public_ok(slug: str, version: int = 1) -> dict:
    return {
        "slug": slug,
        "journeyId": slug,
        "journeyVersion": version,
        "replayReady": True,
        "steps": [{"stepIndex": i, "publicQuestion": "q", "publicAnswer": "a"} for i in range(1, 7)],
        "selectedCount": 6,
        "authorUserId": str(OWNER),
    }


async def _run_neighbors(
    *,
    current: SimpleNamespace,
    by_window: dict[int, list],
    public_slugs: set[str] | None = None,
):
    public_slugs = public_slugs if public_slugs is not None else {current.slug}

    async def get_node(_db, slug):
        if slug == current.slug:
            return current
        for nodes in by_window.values():
            for n in nodes:
                if n.slug == slug:
                    return n
        return None

    async def nodes_at(_db, *, user_id, conversation_id, window_index):
        assert user_id == current.user_id
        assert conversation_id == current.conversation_id
        return list(by_window.get(window_index, []))

    async def public_frozen(_db, *, slug, journey_version=None):
        if slug in public_slugs:
            return _public_ok(slug, int(journey_version or 1))
        return None

    with (
        patch(
            "backend.services.mirror_network.continuation_neighbors.get_mirror_network_node_by_slug",
            new=get_node,
        ),
        patch(
            "backend.services.mirror_network.continuation_neighbors._nodes_at_window",
            new=nodes_at,
        ),
        patch(
            "backend.services.mirror_network.continuation_neighbors.get_public_frozen_journey_artifact",
            new=public_frozen,
        ),
        patch(
            "backend.services.mirror_network.continuation_neighbors.is_canonical_discover_node_structure",
            new=lambda n: (
                n.published_at is not None
                and (n.visibility or "").lower() == "public"
                and (n.safety_status or "").lower() == "open"
                and n.artifact_kind == ARTIFACT_KIND_JOURNEY_V1
                and (n.freeze_status or "").lower() == FREEZE_STATUS_FROZEN
            ),
        ),
    ):
        return await get_continuation_neighbors(AsyncMock(), slug=current.slug)


@pytest.mark.asyncio
async def test_abc_valid_chain():
    a = _node(slug="yansi-a", window_index=0)
    b = _node(slug="yansi-b", window_index=1)
    c = _node(slug="yansi-c", window_index=2)
    public = {"yansi-a", "yansi-b", "yansi-c"}

    res_a = await _run_neighbors(
        current=a, by_window={1: [b]}, public_slugs=public
    )
    assert res_a["previous"] is None
    assert res_a["next"] == {"slug": "yansi-b", "journeyVersion": 1}

    res_b = await _run_neighbors(
        current=b, by_window={0: [a], 2: [c]}, public_slugs=public
    )
    assert res_b["previous"] == {"slug": "yansi-a", "journeyVersion": 1}
    assert res_b["next"] == {"slug": "yansi-c", "journeyVersion": 1}

    res_c = await _run_neighbors(
        current=c, by_window={1: [b]}, public_slugs=public
    )
    assert res_c["previous"] == {"slug": "yansi-b", "journeyVersion": 1}
    assert res_c["next"] is None


@pytest.mark.asyncio
async def test_gap_private_b_no_skip():
    a = _node(slug="yansi-a", window_index=0)
    b = _node(slug="yansi-b", window_index=1, visibility="private")
    c = _node(slug="yansi-c", window_index=2)
    public = {"yansi-a", "yansi-c"}

    res_a = await _run_neighbors(
        current=a, by_window={1: [b]}, public_slugs=public
    )
    assert res_a["next"] is None

    res_c = await _run_neighbors(
        current=c, by_window={1: [b]}, public_slugs=public
    )
    assert res_c["previous"] is None


@pytest.mark.asyncio
async def test_gap_unpublished_b():
    a = _node(slug="yansi-a", window_index=0)
    b = _node(slug="yansi-b", window_index=1, published=False)
    res = await _run_neighbors(
        current=a, by_window={1: [b]}, public_slugs={"yansi-a"}
    )
    assert res["next"] is None


@pytest.mark.asyncio
async def test_gap_withdrawn_invalid_safety():
    a = _node(slug="yansi-a", window_index=0)
    for bad in (
        _node(slug="yansi-b", window_index=1, visibility="private"),  # withdrawn
        _node(slug="yansi-b", window_index=1, freeze_status="non_frozen"),
        _node(slug="yansi-b", window_index=1, safety_status="restricted"),
    ):
        res = await _run_neighbors(
            current=a, by_window={1: [bad]}, public_slugs={"yansi-a"}
        )
        assert res["next"] is None


@pytest.mark.asyncio
async def test_gap_replay_invalid():
    a = _node(slug="yansi-a", window_index=0)
    b = _node(slug="yansi-b", window_index=1)
    # B structurally public but frozen projection missing → not eligible
    res = await _run_neighbors(
        current=a, by_window={1: [b]}, public_slugs={"yansi-a"}
    )
    assert res["next"] is None


@pytest.mark.asyncio
async def test_inspiration_b_to_d_excluded():
    b = _node(slug="yansi-b", window_index=1, user_id=OWNER, conversation_id=CONV)
    # D belongs to another owner/conversation — never appears in B's window queries.
    res = await _run_neighbors(
        current=b, by_window={0: [], 2: []}, public_slugs={"yansi-b", "yansi-d"}
    )
    assert res["next"] is None
    assert res["previous"] is None


@pytest.mark.asyncio
async def test_d_to_e_continuation():
    d = _node(slug="yansi-d", window_index=0, user_id=OWNER2, conversation_id=CONV2)
    e = _node(slug="yansi-e", window_index=1, user_id=OWNER2, conversation_id=CONV2)

    async def get_node(_db, slug):
        return d if slug == "yansi-d" else e if slug == "yansi-e" else None

    async def nodes_at(_db, *, user_id, conversation_id, window_index):
        assert user_id == OWNER2
        assert conversation_id == CONV2
        return [e] if window_index == 1 else []

    async def public_frozen(_db, *, slug, journey_version=None):
        return _public_ok(slug)

    with (
        patch(
            "backend.services.mirror_network.continuation_neighbors.get_mirror_network_node_by_slug",
            new=get_node,
        ),
        patch(
            "backend.services.mirror_network.continuation_neighbors._nodes_at_window",
            new=nodes_at,
        ),
        patch(
            "backend.services.mirror_network.continuation_neighbors.get_public_frozen_journey_artifact",
            new=public_frozen,
        ),
        patch(
            "backend.services.mirror_network.continuation_neighbors.is_canonical_discover_node_structure",
            new=lambda n: True,
        ),
    ):
        out = await get_continuation_neighbors(AsyncMock(), slug="yansi-d")
    assert out["next"] == {"slug": "yansi-e", "journeyVersion": 1}


@pytest.mark.asyncio
async def test_wrong_conversation_excluded():
    a = _node(slug="yansi-a", window_index=0, conversation_id=CONV)
    x = _node(slug="yansi-x", window_index=1, conversation_id=CONV2)
    # Query is scoped to A's conversation — window 1 empty for CONV
    res = await _run_neighbors(
        current=a, by_window={1: []}, public_slugs={"yansi-a", "yansi-x"}
    )
    assert res["next"] is None
    # Even if wrong-conversation node were mistakenly returned, owner+conv filter prevents it
    assert x.conversation_id != a.conversation_id


@pytest.mark.asyncio
async def test_wrong_owner_excluded():
    a = _node(slug="yansi-a", window_index=0, user_id=OWNER)
    # Same conversation string but different owner never queried (user_id scoped)
    res = await _run_neighbors(
        current=a, by_window={1: []}, public_slugs={"yansi-a"}
    )
    assert res["next"] is None


@pytest.mark.asyncio
async def test_ambiguous_window_fail_closed():
    a = _node(slug="yansi-a", window_index=0)
    b1 = _node(slug="yansi-b1", window_index=1)
    b2 = _node(slug="yansi-b2", window_index=1)
    res = await _run_neighbors(
        current=a,
        by_window={1: [b1, b2]},
        public_slugs={"yansi-a", "yansi-b1", "yansi-b2"},
    )
    assert res["next"] is None


@pytest.mark.asyncio
async def test_boundary_mismatch_fail_closed():
    a = _node(slug="yansi-a", window_index=0)
    b = _node(slug="yansi-b", window_index=1, bad_bounds=True)
    res = await _run_neighbors(
        current=a, by_window={1: [b]}, public_slugs={"yansi-a", "yansi-b"}
    )
    assert res["next"] is None


@pytest.mark.asyncio
async def test_version_is_product_field_not_continuation():
    """Same slug product identity — neighbor returns journeyVersion of the product."""
    a = _node(slug="yansi-a", window_index=0, journey_version=3)
    b = _node(slug="yansi-b", window_index=1, journey_version=2)
    res = await _run_neighbors(
        current=a, by_window={1: [b]}, public_slugs={"yansi-a", "yansi-b"}
    )
    assert res["journeyVersion"] == 3
    assert res["next"] == {"slug": "yansi-b", "journeyVersion": 2}


@pytest.mark.asyncio
async def test_private_existence_not_leaked_in_payload():
    a = _node(slug="yansi-a", window_index=0)
    b = _node(slug="yansi-b", window_index=1, visibility="private")
    res = await _run_neighbors(
        current=a, by_window={1: [b]}, public_slugs={"yansi-a"}
    )
    raw = str(res)
    assert "yansi-b" not in raw
    assert res["next"] is None
    assert set(res.keys()) == {"slug", "journeyVersion", "previous", "next"}


@pytest.mark.asyncio
async def test_current_not_public_404():
    a = _node(slug="yansi-a", window_index=0)
    with pytest.raises(ContinuationNeighborsError) as exc:
        await _run_neighbors(
            current=a, by_window={}, public_slugs=set()
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_parent_slug_not_authority():
    """B with parent_slug pointing elsewhere must still resolve via window adjacency."""
    a = _node(slug="yansi-a", window_index=0)
    b = _node(slug="yansi-b", window_index=1, parent_slug="unrelated-root")
    res = await _run_neighbors(
        current=a, by_window={1: [b]}, public_slugs={"yansi-a", "yansi-b"}
    )
    assert res["next"]["slug"] == "yansi-b"


@pytest.mark.asyncio
async def test_direct_c_lookup():
    c = _node(slug="yansi-c", window_index=2)
    b = _node(slug="yansi-b", window_index=1)
    res = await _run_neighbors(
        current=c, by_window={1: [b], 3: []}, public_slugs={"yansi-c", "yansi-b"}
    )
    assert res["slug"] == "yansi-c"
    assert res["previous"]["slug"] == "yansi-b"
    assert res["next"] is None


@pytest.mark.asyncio
async def test_http_endpoint_shape(monkeypatch):
    from fastapi.testclient import TestClient
    from backend.main import app

    async def fake_neighbors(db, *, slug):
        return {
            "slug": slug,
            "journeyVersion": 1,
            "previous": None,
            "next": {"slug": "yansi-b", "journeyVersion": 1},
        }

    monkeypatch.setattr(
        "backend.routers.mirror_network.get_continuation_neighbors",
        fake_neighbors,
    )
    client = TestClient(app)
    resp = client.get("/api/mirror-network/yansi-a/continuation-neighbors")
    assert resp.status_code == 200
    body = resp.json()
    assert body["next"]["slug"] == "yansi-b"
    assert "conversationId" not in body
    assert "userId" not in body
    assert "user_id" not in str(body)
    assert "conversation_id" not in str(body)
