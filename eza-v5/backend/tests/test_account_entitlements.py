# -*- coding: utf-8 -*-
"""Tests for SAINA account tier config and GET /api/account/entitlements (PR1)."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from backend.core.account.tiers import (
    AccountTier,
    TIER_ENTITLEMENTS,
    map_mirror_plan_to_tier,
)
from backend.main import app
from backend.services.production_auth import create_access_token

client = TestClient(app)


def _make_user(*, email: str, mirror_plan: str, account_tier: str | None = None):
    return SimpleNamespace(
        id=uuid.uuid4(),
        email=email,
        password_hash="hash",
        role="user",
        is_active=True,
        mirror_plan=mirror_plan,
        account_tier=account_tier,
    )


def _auth_header(user) -> dict[str, str]:
    token = create_access_token(user)
    return {"Authorization": f"Bearer {token}"}


def test_tier_config_has_all_five_tiers():
    assert set(TIER_ENTITLEMENTS.keys()) == {
        AccountTier.GUEST,
        AccountTier.FREE,
        AccountTier.MINI,
        AccountTier.STANDARD,
        AccountTier.PREMIUM,
    }


def test_map_mirror_plan_to_tier():
    assert map_mirror_plan_to_tier(None, is_authenticated=False) == AccountTier.GUEST
    assert map_mirror_plan_to_tier("free", is_authenticated=True) == AccountTier.FREE
    assert map_mirror_plan_to_tier("plus", is_authenticated=True) == AccountTier.PREMIUM


def test_entitlements_guest_anonymous():
    res = client.get("/api/account/entitlements")
    assert res.status_code == 200
    data = res.json()
    assert data["tier"] == "guest"
    assert data["label"] == "SAINA Guest"
    assert data["entitlements"]["dailyMessageLimit"] == 10
    assert data["entitlements"]["relationshipMapAccess"] == "locked"
    assert data["usage"]["dailyMessagesUsed"] == 0
    assert data["usage"]["dailyMessagesLimit"] == 10
    assert data["usage"]["nextVisualAvailableAt"] is None


@patch("backend.routers.account_entitlements.build_account_usage_snapshot", new_callable=AsyncMock)
@patch("backend.routers.account_entitlements.get_production_user_by_id", new_callable=AsyncMock)
def test_entitlements_free_authenticated_user(mock_get_user, mock_usage):
    free_user = _make_user(email="free@test.eza.ai", mirror_plan="free")
    mock_get_user.return_value = free_user
    mock_usage.return_value = {
        "dailyMessagesUsed": 5,
        "dailyMessagesLimit": 20,
        "dailyDiscoverStartsUsed": 0,
        "dailyDiscoverStartsLimit": 1,
        "visualCreationsUsed": 0,
        "visualCreationsLimit": 0,
        "nextVisualAvailableAt": None,
    }

    res = client.get("/api/account/entitlements", headers=_auth_header(free_user))
    assert res.status_code == 200
    data = res.json()
    assert data["tier"] == "free"
    assert data["label"] == "SAINA Free"
    assert data["entitlements"]["dailyMessageLimit"] == 20
    assert data["entitlements"]["dailyMirrorLimit"] == 0
    assert data["usage"]["dailyMessagesUsed"] == 5
    assert data["usage"]["dailyDiscoverStartsLimit"] == 1


@patch("backend.routers.account_entitlements.build_account_usage_snapshot", new_callable=AsyncMock)
@patch("backend.routers.account_entitlements.get_production_user_by_id", new_callable=AsyncMock)
def test_entitlements_plus_maps_to_premium(mock_get_user, mock_usage):
    plus_user = _make_user(email="plus@test.eza.ai", mirror_plan="plus")
    mock_get_user.return_value = plus_user
    mock_usage.return_value = {
        "dailyMessagesUsed": 0,
        "dailyMessagesLimit": 5000,
        "dailyDiscoverStartsUsed": 0,
        "dailyDiscoverStartsLimit": 200,
        "visualCreationsUsed": 0,
        "visualCreationsLimit": 50,
        "nextVisualAvailableAt": None,
    }

    res = client.get("/api/account/entitlements", headers=_auth_header(plus_user))
    assert res.status_code == 200
    data = res.json()
    assert data["tier"] == "premium"
    assert data["label"] == "SAINA Premium"
    assert data["entitlements"]["imageQuality"] == "highest"
    assert data["entitlements"]["priorityGeneration"] is True
    assert data["entitlements"]["dailyMessageLimit"] is None
    assert data["entitlements"]["dailyMirrorLimit"] is None
    assert data["usage"]["dailyMessagesLimit"] is None
    assert data["usage"]["visualCreationsLimit"] is None


def test_mini_and_standard_config_ready():
    mini = TIER_ENTITLEMENTS[AccountTier.MINI]
    standard = TIER_ENTITLEMENTS[AccountTier.STANDARD]
    assert mini["mirrorCooldownHours"] == 48
    assert mini["relationshipMapAccess"] == "last_90_days"
    assert standard["dailyMirrorLimit"] == 1
    assert standard["relationshipMapAccess"] == "all"


@patch("backend.routers.account_entitlements.build_account_usage_snapshot", new_callable=AsyncMock)
def test_entitlements_guest_token_header_rollup(mock_usage):
    mock_usage.return_value = {
        "dailyMessagesUsed": 7,
        "dailyMessagesLimit": 10,
        "dailyDiscoverStartsUsed": 1,
        "dailyDiscoverStartsLimit": 1,
        "visualCreationsUsed": 0,
        "visualCreationsLimit": 1,
        "nextVisualAvailableAt": None,
    }
    guest_token = "guest-token-abcdefghijklmnop"

    res = client.get(
        "/api/account/entitlements",
        headers={"X-Guest-Token": guest_token},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["tier"] == "guest"
    assert data["usage"]["dailyMessagesUsed"] == 7
    mock_usage.assert_awaited_once()
    assert mock_usage.await_args.kwargs["guest_fingerprint"] is not None
    assert mock_usage.await_args.kwargs["user_id"] is None


@patch("backend.routers.account_entitlements.build_account_usage_snapshot", new_callable=AsyncMock)
def test_relationship_map_access_endpoint_guest_locked(mock_usage):
    mock_usage.return_value = {
        "dailyMessagesUsed": 0,
        "dailyMessagesLimit": 10,
        "dailyDiscoverStartsUsed": 0,
        "dailyDiscoverStartsLimit": 1,
        "visualCreationsUsed": 0,
        "visualCreationsLimit": 1,
        "nextVisualAvailableAt": None,
    }
    guest_token = "guest-token-abcdefghijklmnop"
    res = client.get(
        "/api/account/relationship-map-access",
        headers={"X-Guest-Token": guest_token},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["access"] == "locked"
    assert data["relationshipMapCutoffIso"] is None


@patch("backend.routers.account_entitlements.build_account_usage_snapshot", new_callable=AsyncMock)
@patch("backend.routers.account_entitlements.get_production_user_by_id", new_callable=AsyncMock)
def test_entitlements_mini_account_tier(mock_get_user, mock_usage):
    mini_user = _make_user(email="mini@test.eza.ai", mirror_plan="free", account_tier="mini")
    mock_get_user.return_value = mini_user
    mock_usage.return_value = {
        "dailyMessagesUsed": 1,
        "dailyMessagesLimit": 50,
        "dailyDiscoverStartsUsed": 0,
        "dailyDiscoverStartsLimit": 10,
        "visualCreationsUsed": 0,
        "visualCreationsLimit": None,
        "nextVisualAvailableAt": None,
    }

    res = client.get("/api/account/entitlements", headers=_auth_header(mini_user))
    assert res.status_code == 200
    data = res.json()
    assert data["tier"] == "mini"
    assert data["entitlements"]["relationshipMapAccess"] == "last_90_days"
    assert data["entitlements"]["relationshipMapCutoffIso"] is not None
