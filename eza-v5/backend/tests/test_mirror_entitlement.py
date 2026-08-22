# -*- coding: utf-8
"""Tests for Mirror entitlement (Sprint 2) and GET /api/auth/me."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.core.account.tiers import AccountTier, get_entitlements_for_tier
from backend.services.production_auth import create_access_token

client = TestClient(app)

VALID_BODY = {
    "prompt": "premium soft 3D illustration, wellness garden, no text",
    "negativePrompt": "text, letters, logo",
    "seedHint": "mirror-visual-abc123",
    "stylePreset": "eza_mirror_professional_v1",
    "qualityHints": ["9:16 vertical safe composition"],
    "cardDate": "2026-05-21",
    "generationRequestId": "req-entitle12",
    "generationPipeline": "LEGACY_V3",
}


def _make_user(*, email: str, mirror_plan: str):
    return SimpleNamespace(
        id=uuid.uuid4(),
        email=email,
        password_hash="hash",
        role="user",
        is_active=True,
        mirror_plan=mirror_plan,
    )


def _auth_header(user) -> dict[str, str]:
    token = create_access_token(user)
    return {"Authorization": f"Bearer {token}"}


def test_generate_scene_anonymous_returns_401():
    res = client.post("/api/standalone/mirror/generate-scene", json=VALID_BODY)
    assert res.status_code == 401
    detail = res.json()["detail"]
    assert detail["code"] == "auth_required"


def test_free_tier_daily_mirror_limit_at_least_guest_phase82():
    """Phase 8.2 — registered Free user is not worse than guest for first Ayna."""
    guest = get_entitlements_for_tier(AccountTier.GUEST)
    free = get_entitlements_for_tier(AccountTier.FREE)
    assert guest["dailyMirrorLimit"] == 1
    assert free["dailyMirrorLimit"] == 1
    assert free["dailyMirrorLimit"] >= guest["dailyMirrorLimit"]


@patch("backend.routers.production_auth.load_user_session_row", new_callable=AsyncMock)
@patch("backend.auth.deps.get_user_from_token")
def test_auth_me_returns_mirror_plan(mock_get_token, mock_get_row):
    from backend.auth.deps import get_current_user

    plus_user = _make_user(email="plus@test.eza.ai", mirror_plan="plus")
    mock_get_token.return_value = {
        "user_id": str(plus_user.id),
        "sub": str(plus_user.id),
        "role": plus_user.role,
        "email": plus_user.email,
    }
    mock_get_row.return_value = {
        "id": plus_user.id,
        "email": plus_user.email,
        "role": plus_user.role,
        "is_active": True,
        "mirror_plan": plus_user.mirror_plan,
        "account_tier": None,
        "public_display_name": None,
    }

    app.dependency_overrides[get_current_user] = lambda: {
        "user_id": str(plus_user.id),
        "sub": str(plus_user.id),
        "role": plus_user.role,
        "email": plus_user.email,
    }
    try:
        res = client.get("/api/auth/me", headers=_auth_header(plus_user))
        assert res.status_code == 200
        data = res.json()
        assert data["user_id"] == str(plus_user.id)
        assert data["email"] == plus_user.email
        assert data["role"] == plus_user.role
        assert data["mirror_plan"] == "plus"
    finally:
        app.dependency_overrides.pop(get_current_user, None)
