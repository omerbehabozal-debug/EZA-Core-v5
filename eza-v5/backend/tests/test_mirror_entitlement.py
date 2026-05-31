# -*- coding: utf-8
"""Tests for Mirror entitlement (Sprint 2) and GET /api/auth/me."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.mirror.mirror_image_provider import MockMirrorImageProvider
from backend.services.production_auth import create_access_token

client = TestClient(app)

VALID_BODY = {
    "prompt": "premium soft 3D illustration, wellness garden, no text",
    "negativePrompt": "text, letters, logo",
    "seedHint": "mirror-visual-abc123",
    "stylePreset": "eza_mirror_professional_v1",
    "qualityHints": ["9:16 vertical safe composition"],
    "cardDate": "2026-05-21",
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


@patch("backend.auth.mirror_entitlement.get_production_user_by_id", new_callable=AsyncMock)
def test_generate_scene_free_user_returns_403(mock_get_user):
    free_user = _make_user(email="free@test.eza.ai", mirror_plan="free")
    mock_get_user.return_value = free_user
    res = client.post(
        "/api/standalone/mirror/generate-scene",
        json=VALID_BODY,
        headers=_auth_header(free_user),
    )
    assert res.status_code == 403
    detail = res.json()["detail"]
    assert detail["code"] == "upgrade_required"
    assert detail["plan"] == "free"
    assert detail["required"] == "plus"


@patch("backend.services.mirror.mirror_image_service.get_mirror_image_provider")
@patch("backend.auth.mirror_entitlement.get_production_user_by_id", new_callable=AsyncMock)
def test_generate_scene_plus_user_returns_200(mock_get_user, mock_get_provider):
    plus_user = _make_user(email="plus@test.eza.ai", mirror_plan="plus")
    mock_get_user.return_value = plus_user
    mock_get_provider.return_value = MockMirrorImageProvider()
    res = client.post(
        "/api/standalone/mirror/generate-scene",
        json=VALID_BODY,
        headers=_auth_header(plus_user),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["sceneImageUrl"].startswith("http")
    assert data["provider"] == "mock"


@patch("backend.routers.production_auth.get_production_user_by_id", new_callable=AsyncMock)
@patch("backend.auth.deps.get_user_from_token")
def test_auth_me_returns_mirror_plan(mock_get_token, mock_get_user):
    from backend.auth.deps import get_current_user

    plus_user = _make_user(email="plus@test.eza.ai", mirror_plan="plus")
    mock_get_token.return_value = {
        "user_id": str(plus_user.id),
        "sub": str(plus_user.id),
        "role": plus_user.role,
        "email": plus_user.email,
    }
    mock_get_user.return_value = plus_user

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
