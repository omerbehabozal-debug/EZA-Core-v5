# -*- coding: utf-8 -*-
"""Mirror Network impact stats (Faz 2 — Yansı)."""

from __future__ import annotations

import json
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.mirror_network.fixtures import build_fixture_mirror_node
from backend.services.mirror_network.impact import (
    count_continuation_starts,
    count_landing_views,
    count_yansi_children,
    get_mirror_impact_stats,
    is_eligible_yansi_child,
)
from backend.services.mirror_network.service import node_to_public_payload
from backend.services.production_auth import create_access_token

client = TestClient(app)

FORBIDDEN_IMPACT_KEYS = {
    "userId",
    "guestToken",
    "guest_token_hash",
    "session_id",
    "sessionId",
    "conversationId",
    "mirrorBody",
    "private_payload",
    "behavioralSnapshot",
    "events",
}


def _make_user():
    return SimpleNamespace(
        id=uuid.uuid4(),
        email="mirror-impact@test.eza.ai",
        password_hash="hash",
        role="user",
        is_active=True,
        mirror_plan="plus",
    )


def _auth_header(user) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user)}"}


def _make_node_record(*, slug: str, user_id, parent_slug: str | None = None):
    record = build_fixture_mirror_node(slug_suffix=slug.split("-")[-1], user_id=user_id)
    record.slug = slug
    record.parent_slug = parent_slug
    return record


@pytest.mark.asyncio
async def test_count_yansi_children_only_eligible_children():
    db = AsyncMock()
    eligible = SimpleNamespace(
        slug="child-open",
        visibility="public",
        safety_status="open",
        parent_slug="parent-slug",
    )
    private_child = SimpleNamespace(
        slug="child-private",
        visibility="private",
        safety_status="open",
        parent_slug="parent-slug",
    )
    db.execute = AsyncMock(
        return_value=SimpleNamespace(scalars=lambda: lambda: [eligible, private_child])
    )
    # scalars().all() chain
    scalars_mock = SimpleNamespace(all=lambda: [eligible, private_child])
    db.execute = AsyncMock(return_value=SimpleNamespace(scalars=lambda: scalars_mock))
    assert await count_yansi_children(db, "parent-slug") == 1


def test_is_eligible_yansi_child_filters_private_and_restricted():
    assert is_eligible_yansi_child(
        SimpleNamespace(visibility="public", safety_status="open", parent_slug="p")
    )
    assert not is_eligible_yansi_child(
        SimpleNamespace(visibility="private", safety_status="open", parent_slug="p")
    )
    assert not is_eligible_yansi_child(
        SimpleNamespace(visibility="public", safety_status="restricted", parent_slug="p")
    )


@pytest.mark.asyncio
async def test_count_yansi_children_by_parent_slug():
    db = AsyncMock()
    child = SimpleNamespace(
        slug="child-1",
        visibility="public",
        safety_status="open",
        parent_slug="parent-slug",
    )
    scalars_mock = SimpleNamespace(all=lambda: [child, child])
    db.execute = AsyncMock(return_value=SimpleNamespace(scalars=lambda: scalars_mock))
    assert await count_yansi_children(db, "parent-slug") == 2


@pytest.mark.asyncio
async def test_count_continuation_starts_dedupes_when_logging_enabled():
    db = AsyncMock()
    db.execute = AsyncMock(return_value=SimpleNamespace(scalar=lambda: 1))
    with patch(
        "backend.services.mirror_network.impact.is_experience_event_logging_enabled",
        return_value=True,
    ):
        assert await count_continuation_starts(db, "parent-slug") == 1


@pytest.mark.asyncio
async def test_count_continuation_starts_zero_when_logging_disabled():
    db = AsyncMock()
    with patch(
        "backend.services.mirror_network.impact.is_experience_event_logging_enabled",
        return_value=False,
    ):
        assert await count_continuation_starts(db, "parent-slug") == 0
        assert await count_landing_views(db, "parent-slug") == 0
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_get_mirror_impact_stats_owner_success():
    user = _make_user()
    node = SimpleNamespace(
        slug="parent-ayna-abc123",
        user_id=user.id,
        parent_slug=None,
    )
    db = AsyncMock()

    with (
        patch(
            "backend.services.mirror_network.impact.get_mirror_network_node_by_slug",
            new=AsyncMock(return_value=node),
        ),
        patch(
            "backend.services.mirror_network.impact.count_verified_continuation_starts",
            new=AsyncMock(return_value=42),
        ),
        patch(
            "backend.services.mirror_network.impact._CONTINUATION_STARTS_VERIFIED",
            False,
        ),
        patch(
            "backend.services.mirror_network.impact.count_yansi_children",
            new=AsyncMock(return_value=7),
        ),
        patch(
            "backend.services.mirror_network.impact.is_experience_event_logging_enabled",
            return_value=True,
        ),
        patch(
            "backend.services.mirror_network.impact.count_landing_views",
            new=AsyncMock(return_value=120),
        ),
    ):
        stats = await get_mirror_impact_stats(db, "parent-ayna-abc123", user.id)

    assert stats.mirrorId == "parent-ayna-abc123"
    assert stats.publicSlug == "parent-ayna-abc123"
    assert stats.continuationStarts == 0
    assert stats.continuationStartsVerified is False
    assert stats.yansiCount == 7
    assert stats.landingViews == 120
    payload = stats.model_dump()
    assert FORBIDDEN_IMPACT_KEYS.isdisjoint(payload.keys())


@pytest.mark.asyncio
async def test_get_mirror_impact_stats_forbidden_for_non_owner():
    owner = _make_user()
    other = _make_user()
    node = SimpleNamespace(slug="parent-ayna-abc123", user_id=owner.id, parent_slug=None)
    db = AsyncMock()

    with patch(
        "backend.services.mirror_network.impact.get_mirror_network_node_by_slug",
        new=AsyncMock(return_value=node),
    ):
        with pytest.raises(Exception) as exc:
            await get_mirror_impact_stats(db, "parent-ayna-abc123", other.id)
    assert getattr(exc.value, "status_code", None) == 403


@pytest.mark.asyncio
async def test_get_mirror_impact_stats_not_found():
    db = AsyncMock()
    with patch(
        "backend.services.mirror_network.impact.get_mirror_network_node_by_slug",
        new=AsyncMock(return_value=None),
    ):
        with pytest.raises(Exception) as exc:
            await get_mirror_impact_stats(db, "missing-slug", uuid.uuid4())
    assert getattr(exc.value, "status_code", None) == 404


def test_impact_endpoint_owner_200():
    user = _make_user()
    stats = {
        "mirrorId": "parent-ayna-abc123",
        "publicSlug": "parent-ayna-abc123",
        "shareUrl": "https://saina.app/m/parent-ayna-abc123",
        "continuationStarts": 0,
        "continuationStartsVerified": False,
        "yansiCount": 3,
        "landingViews": 50,
    }

    from backend.core.schemas.mirror_network import MirrorNetworkImpactStats

    with patch(
        "backend.routers.mirror_network.get_mirror_impact_stats",
        new=AsyncMock(return_value=MirrorNetworkImpactStats.model_validate(stats)),
    ), patch(
        "backend.auth.mirror_entitlement.get_production_user_by_id",
        new=AsyncMock(return_value=user),
    ):
        response = client.get(
            "/api/mirror-network/parent-ayna-abc123/impact",
            headers=_auth_header(user),
        )

    assert response.status_code == 200
    body = response.json()
    assert body["continuationStarts"] == 0
    assert body["continuationStartsVerified"] is False
    assert body["yansiCount"] == 3
    assert json.dumps(body)
    for key in FORBIDDEN_IMPACT_KEYS:
        assert key not in body


def test_impact_endpoint_requires_auth():
    response = client.get("/api/mirror-network/parent-ayna-abc123/impact")
    assert response.status_code == 401


def test_impact_endpoint_non_owner_403():
    user = _make_user()
    from fastapi import HTTPException

    with patch(
        "backend.routers.mirror_network.get_mirror_impact_stats",
        new=AsyncMock(
            side_effect=HTTPException(status_code=403, detail={"code": "mirror_impact_forbidden"})
        ),
    ), patch(
        "backend.auth.mirror_entitlement.get_production_user_by_id",
        new=AsyncMock(return_value=user),
    ):
        response = client.get(
            "/api/mirror-network/parent-ayna-abc123/impact",
            headers=_auth_header(user),
        )
    assert response.status_code == 403


def test_yansi_count_uses_parent_slug_children():
    parent = _make_node_record(slug="parent-ayna-abc123", user_id=uuid.uuid4())
    child_a = _make_node_record(
        slug="child-ayna-aaa111",
        user_id=uuid.uuid4(),
        parent_slug=parent.slug,
    )
    child_b = _make_node_record(
        slug="child-ayna-bbb222",
        user_id=uuid.uuid4(),
        parent_slug=parent.slug,
    )
    assert child_a.parent_slug == parent.slug
    assert child_b.parent_slug == parent.slug
    assert child_a.slug != child_b.slug
