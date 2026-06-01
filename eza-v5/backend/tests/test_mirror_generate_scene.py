# -*- coding: utf-8 -*-
"""Tests for POST /api/standalone/mirror/generate-scene."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.production_auth import create_access_token
from backend.services.mirror.mirror_image_provider import (
    MockMirrorImageProvider,
    get_mirror_image_provider,
    resolve_mirror_image_provider_name,
)
from backend.services.mirror.mirror_image_service import (
    STANDARD_NEGATIVE_FALLBACK,
    validate_and_build_request,
)

client = TestClient(app)


def _make_plus_user():
    return SimpleNamespace(
        id=uuid.uuid4(),
        email="plus@test.eza.ai",
        password_hash="hash",
        role="user",
        is_active=True,
        mirror_plan="plus",
    )


def _auth_header(user) -> dict[str, str]:
    token = create_access_token(user)
    return {"Authorization": f"Bearer {token}"}

VALID_BODY = {
    "prompt": "premium soft 3D illustration, wellness garden, no text",
    "negativePrompt": "text, letters, logo",
    "seedHint": "mirror-visual-abc123",
    "stylePreset": "eza_mirror_professional_v1",
    "qualityHints": ["9:16 vertical safe composition"],
    "cardDate": "2026-05-21",
}


@pytest.mark.asyncio
async def test_mock_provider_returns_url():
    provider = MockMirrorImageProvider()
    req = validate_and_build_request(
        prompt=VALID_BODY["prompt"],
        negative_prompt=VALID_BODY["negativePrompt"],
        seed_hint=VALID_BODY["seedHint"],
        style_preset=VALID_BODY["stylePreset"],
        card_date=VALID_BODY["cardDate"],
        quality_hints=VALID_BODY["qualityHints"],
    )
    result = await provider.generate_scene(req)
    assert result.provider == "mock"
    assert result.scene_image_url.startswith("http")
    assert result.cached is False
    assert result.generated_at


def test_unknown_provider_resolves_to_mock():
    import os

    prev = os.environ.get("EZA_MIRROR_IMAGE_PROVIDER")
    try:
        os.environ["EZA_MIRROR_IMAGE_PROVIDER"] = "not-a-real-provider"
        assert resolve_mirror_image_provider_name() == "mock"
        provider = get_mirror_image_provider("unknown_xyz")
        assert isinstance(provider, MockMirrorImageProvider)
    finally:
        if prev is None:
            os.environ.pop("EZA_MIRROR_IMAGE_PROVIDER", None)
        else:
            os.environ["EZA_MIRROR_IMAGE_PROVIDER"] = prev


def test_validate_rejects_empty_prompt():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        validate_and_build_request(
            prompt="   ",
            negative_prompt="",
            seed_hint="seed",
            style_preset="eza_mirror_professional_v1",
            card_date="2026-05-21",
        )
    assert exc.value.status_code == 400
    assert exc.value.detail["error"] == "prompt_required"


def test_validate_uses_negative_fallback():
    req = validate_and_build_request(
        prompt="calm scene, no text",
        negative_prompt="",
        seed_hint="seed-1",
        style_preset="eza_mirror_professional_v1",
        card_date="2026-05-21",
    )
    assert req.negative_prompt == STANDARD_NEGATIVE_FALLBACK


def test_generate_scene_endpoint_success():
    """Authenticated user (free or plus) can generate scene."""
    plus_user = _make_plus_user()
    with patch(
        "backend.auth.mirror_entitlement.get_production_user_by_id",
        new_callable=AsyncMock,
        return_value=plus_user,
    ), patch(
        "backend.services.mirror.mirror_image_service.get_mirror_image_provider",
        return_value=MockMirrorImageProvider(),
    ):
        res = client.post(
            "/api/standalone/mirror/generate-scene",
            json=VALID_BODY,
            headers=_auth_header(plus_user),
        )
    assert res.status_code == 200
    data = res.json()
    assert "sceneImageUrl" in data
    assert data["sceneImageUrl"].startswith("http")
    assert data["provider"] == "mock"
    assert data["cached"] is False
    assert "generatedAt" in data
    assert "T" in data["generatedAt"]


def test_generate_scene_rejects_empty_prompt():
    body = {**VALID_BODY, "prompt": ""}
    plus_user = _make_plus_user()
    with patch(
        "backend.auth.mirror_entitlement.get_production_user_by_id",
        new_callable=AsyncMock,
        return_value=plus_user,
    ):
        res = client.post(
            "/api/standalone/mirror/generate-scene",
            json=body,
            headers=_auth_header(plus_user),
        )
    assert res.status_code == 422 or res.status_code == 400


def test_generate_scene_rejects_invalid_style_preset():
    body = {**VALID_BODY, "stylePreset": "invalid_preset"}
    plus_user = _make_plus_user()
    with patch(
        "backend.auth.mirror_entitlement.get_production_user_by_id",
        new_callable=AsyncMock,
        return_value=plus_user,
    ):
        res = client.post(
            "/api/standalone/mirror/generate-scene",
            json=body,
            headers=_auth_header(plus_user),
        )
    assert res.status_code == 400
    detail = res.json()["detail"]
    assert detail["error"] == "invalid_style_preset"
