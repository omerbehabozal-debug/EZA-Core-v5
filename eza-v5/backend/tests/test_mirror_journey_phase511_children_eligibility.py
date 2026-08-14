# -*- coding: utf-8 -*-
"""Phase 5.1.1 — /children eligibility, deterministic order, direct-child only."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from backend.models.mirror_network import ARTIFACT_KIND_JOURNEY_V1, ARTIFACT_KIND_LEGACY_LANDING
from backend.services.mirror_network.author_profile import (
    is_candidate_frozen_continuation_child,
    list_published_direct_children,
)
from backend.services.mirror_network.frozen_journey_artifact import FREEZE_STATUS_FROZEN, FREEZE_STATUS_NON_FROZEN


def _ts(iso: str) -> datetime:
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


def _node(
    *,
    slug: str,
    parent_slug: str = "parent-a",
    published_at: datetime | None = _ts("2026-08-01T12:00:00+00:00"),
    created_at: datetime | None = _ts("2026-08-01T11:00:00+00:00"),
    visibility: str = "public",
    safety_status: str = "open",
    artifact_kind: str = ARTIFACT_KIND_JOURNEY_V1,
    freeze_status: str = FREEZE_STATUS_FROZEN,
    card_title: str | None = None,
    public_payload: dict | None = None,
):
    return SimpleNamespace(
        id=uuid.uuid4(),
        slug=slug,
        parent_slug=parent_slug,
        published_at=published_at,
        created_at=created_at,
        visibility=visibility,
        safety_status=safety_status,
        artifact_kind=artifact_kind,
        freeze_status=freeze_status,
        card_title=card_title or f"Title {slug}",
        scene_image_url=f"https://cdn.example/{slug}.jpg",
        public_payload=public_payload if public_payload is not None else {"publicTitle": f"Title {slug}"},
        private_payload={},
        user_id=uuid.uuid4(),
    )


def test_candidate_gates_require_published_journey_frozen_public():
    ok = _node(slug="b")
    assert is_candidate_frozen_continuation_child(ok)

    assert not is_candidate_frozen_continuation_child(
        _node(slug="c", published_at=None)
    )
    assert not is_candidate_frozen_continuation_child(
        _node(slug="d", visibility="private")
    )
    assert not is_candidate_frozen_continuation_child(
        _node(slug="e", safety_status="restricted")
    )
    assert not is_candidate_frozen_continuation_child(
        _node(slug="f", freeze_status=FREEZE_STATUS_NON_FROZEN)
    )
    assert not is_candidate_frozen_continuation_child(
        _node(slug="g", artifact_kind=ARTIFACT_KIND_LEGACY_LANDING)
    )


@pytest.mark.asyncio
async def test_children_returns_only_replay_ready_eligible():
    """
    A has B..I variants; only B (published+public+safe+journey+frozen+replayReady) returns.
    """
    parent = _node(slug="parent-a", parent_slug=None)
    b = _node(slug="child-b")
    c = _node(slug="child-c", published_at=None)  # unpublished
    d = _node(slug="child-d", visibility="private")
    e = _node(slug="child-e", safety_status="restricted")
    f = _node(slug="child-f", freeze_status=FREEZE_STATUS_NON_FROZEN)
    g = _node(slug="child-g", artifact_kind=ARTIFACT_KIND_LEGACY_LANDING)
    h = _node(slug="child-h")  # structural ok but malformed frozen → skipped
    i = _node(slug="child-i", freeze_status=FREEZE_STATUS_NON_FROZEN)  # generating/failed proxy

    # SQL-ish filter already applied in list; candidates that pass WHERE:
    sql_candidates = [b, h]  # others filtered by published_at / kind / freeze in query

    db = AsyncMock()

    async def _get_parent(db_, slug):
        return parent if slug == "parent-a" else None

    execute_result = SimpleNamespace(
        scalars=lambda: SimpleNamespace(all=lambda: sql_candidates)
    )
    db.execute = AsyncMock(return_value=execute_result)

    async def _public_frozen(db_, *, slug, journey_version=None):
        if slug == "child-b":
            return {"slug": "child-b", "replayReady": True, "steps": []}
        return None  # H malformed / missing

    with (
        patch(
            "backend.services.mirror_network.author_profile.get_mirror_network_node_by_slug",
            new=_get_parent,
        ),
        patch(
            "backend.services.mirror_network.author_profile.get_public_frozen_journey_artifact",
            new=_public_frozen,
        ),
        patch(
            "backend.services.mirror_network.author_profile.is_candidate_frozen_continuation_child",
            side_effect=lambda n: is_candidate_frozen_continuation_child(n),
        ),
    ):
        # Also assert structural rejects for C–I outside the SQL result
        assert not is_candidate_frozen_continuation_child(c)
        assert not is_candidate_frozen_continuation_child(d)
        assert not is_candidate_frozen_continuation_child(e)
        assert not is_candidate_frozen_continuation_child(f)
        assert not is_candidate_frozen_continuation_child(g)
        assert not is_candidate_frozen_continuation_child(i)

        payload = await list_published_direct_children(db, parent_slug="parent-a")
        assert payload is not None
        assert [item["slug"] for item in payload["items"]] == ["child-b"]
        assert payload["total"] == 1


@pytest.mark.asyncio
async def test_children_direct_only_excludes_grandchild():
    parent = _node(slug="parent-a", parent_slug=None)
    b = _node(slug="child-b", parent_slug="parent-a")
    # Grandchild D would have parent_slug=child-b — not in children(A) query result.
    db = AsyncMock()
    db.execute = AsyncMock(
        return_value=SimpleNamespace(
            scalars=lambda: SimpleNamespace(all=lambda: [b])
        )
    )

    async def _get_parent(db_, slug):
        return parent if slug == "parent-a" else None

    async def _public_frozen(db_, *, slug, journey_version=None):
        return {"slug": slug, "replayReady": True} if slug == "child-b" else None

    with (
        patch(
            "backend.services.mirror_network.author_profile.get_mirror_network_node_by_slug",
            new=_get_parent,
        ),
        patch(
            "backend.services.mirror_network.author_profile.get_public_frozen_journey_artifact",
            new=_public_frozen,
        ),
    ):
        payload = await list_published_direct_children(db, parent_slug="parent-a")
        assert [i["slug"] for i in payload["items"]] == ["child-b"]
        assert "child-d" not in [i["slug"] for i in payload["items"]]


@pytest.mark.asyncio
async def test_children_deterministic_tie_breaker_slug_asc():
    """
    Identical published_at + created_at → slug ASC wins.

    Expected order: child-aaa, child-zzz when times equal
    (published_at DESC, created_at DESC, slug ASC).
    """
    parent = _node(slug="parent-a", parent_slug=None)
    tie = _ts("2026-08-01T12:00:00+00:00")
    created = _ts("2026-08-01T11:00:00+00:00")
    zzz = _node(slug="child-zzz", published_at=tie, created_at=created)
    aaa = _node(slug="child-aaa", published_at=tie, created_at=created)
    # Simulate DB returning already ordered by CHILDREN_ORDER_BY
    ordered = [aaa, zzz]

    db = AsyncMock()
    db.execute = AsyncMock(
        return_value=SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: ordered))
    )

    async def _get_parent(db_, slug):
        return parent if slug == "parent-a" else None

    async def _public_frozen(db_, *, slug, journey_version=None):
        return {"slug": slug, "replayReady": True}

    with (
        patch(
            "backend.services.mirror_network.author_profile.get_mirror_network_node_by_slug",
            new=_get_parent,
        ),
        patch(
            "backend.services.mirror_network.author_profile.get_public_frozen_journey_artifact",
            new=_public_frozen,
        ),
    ):
        payload = await list_published_direct_children(db, parent_slug="parent-a")
        assert [i["slug"] for i in payload["items"]] == ["child-aaa", "child-zzz"]
        # Primary semantics: first in list
        assert payload["items"][0]["slug"] == "child-aaa"


@pytest.mark.asyncio
async def test_children_primary_is_first_in_deterministic_order():
    parent = _node(slug="parent-a", parent_slug=None)
    newer = _node(
        slug="child-b",
        published_at=_ts("2026-08-03T00:00:00+00:00"),
        created_at=_ts("2026-08-03T00:00:00+00:00"),
    )
    mid = _node(
        slug="child-c",
        published_at=_ts("2026-08-02T00:00:00+00:00"),
        created_at=_ts("2026-08-02T00:00:00+00:00"),
    )
    older = _node(
        slug="child-d",
        published_at=_ts("2026-08-01T00:00:00+00:00"),
        created_at=_ts("2026-08-01T00:00:00+00:00"),
    )
    ordered = [newer, mid, older]
    db = AsyncMock()
    db.execute = AsyncMock(
        return_value=SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: ordered))
    )

    async def _get_parent(db_, slug):
        return parent if slug == "parent-a" else None

    async def _public_frozen(db_, *, slug, journey_version=None):
        return {"slug": slug, "replayReady": True}

    with (
        patch(
            "backend.services.mirror_network.author_profile.get_mirror_network_node_by_slug",
            new=_get_parent,
        ),
        patch(
            "backend.services.mirror_network.author_profile.get_public_frozen_journey_artifact",
            new=_public_frozen,
        ),
    ):
        payload = await list_published_direct_children(db, parent_slug="parent-a")
        assert [i["slug"] for i in payload["items"]] == ["child-b", "child-c", "child-d"]
        assert payload["total"] == 3
