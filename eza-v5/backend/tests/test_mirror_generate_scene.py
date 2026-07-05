# -*- coding: utf-8 -*-
"""Tests for POST /api/standalone/mirror/generate-scene."""

import uuid
from contextlib import contextmanager
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


@pytest.fixture(autouse=True)
def _mock_visual_quota_consume():
    with patch(
        "backend.routers.standalone_mirror.consume_usage_event_atomic",
        new_callable=AsyncMock,
    ) as mock_consume:
        from backend.core.account.usage_service import UsageConsumeResult

        mock_consume.return_value = UsageConsumeResult(event=SimpleNamespace(), created=True)
        yield


VALID_BODY = {
    "prompt": "premium soft 3D illustration, wellness garden, no text",
    "negativePrompt": "text, letters, logo",
    "seedHint": "mirror-visual-abc123",
    "stylePreset": "eza_mirror_professional_v1",
    "qualityHints": ["9:16 vertical safe composition"],
    "cardDate": "2026-05-21",
    "conversationId": "conv-scene-test",
    "generationRequestId": "req-abcdef12",
}


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


@contextmanager
def _patch_production_user(user):
    with (
        patch(
            "backend.auth.mirror_entitlement.get_production_user_by_id",
            new_callable=AsyncMock,
            return_value=user,
        ),
        patch(
            "backend.core.account.subject.get_production_user_by_id",
            new_callable=AsyncMock,
            return_value=user,
        ),
    ):
        yield


def test_generate_scene_requires_visual_source_id():
    body = {**VALID_BODY}
    del body["generationRequestId"]
    del body["conversationId"]
    plus_user = _make_plus_user()
    with _patch_production_user(plus_user):
        res = client.post(
            "/api/standalone/mirror/generate-scene",
            json=body,
            headers=_auth_header(plus_user),
        )
    assert res.status_code == 422
    assert res.json()["detail"]["reason"] == "visual_source_id_required"


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


GUEST_VALID_BODY = {
    "prompt": VALID_BODY["prompt"],
    "negativePrompt": VALID_BODY["negativePrompt"],
    "seedHint": VALID_BODY["seedHint"],
    "stylePreset": VALID_BODY["stylePreset"],
    "qualityHints": VALID_BODY["qualityHints"],
    "cardDate": VALID_BODY["cardDate"],
    "generationRequestId": "req-guestabcd",
}


def test_generate_scene_endpoint_guest_with_token():
    guest_token = "guest-token-abcdefghijklmnop"
    with patch(
        "backend.services.mirror.mirror_image_service.get_mirror_image_provider",
        return_value=MockMirrorImageProvider(),
    ):
        res = client.post(
            "/api/standalone/mirror/generate-scene",
            json=GUEST_VALID_BODY,
            headers={"X-Guest-Token": guest_token},
        )
    assert res.status_code == 200
    data = res.json()
    assert data["sceneImageUrl"].startswith("http")


def test_generate_scene_endpoint_requires_auth_or_guest():
    res = client.post("/api/standalone/mirror/generate-scene", json=VALID_BODY)
    assert res.status_code == 401


def test_generate_scene_endpoint_success():
    """Authenticated user (free or plus) can generate scene."""
    plus_user = _make_plus_user()
    with _patch_production_user(plus_user), patch(
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


def test_generate_scene_endpoint_persists_data_url_to_durable_https(tmp_path, monkeypatch):
    """OpenAI-style data URLs from provider are normalized to durable HTTPS asset URLs."""
    from backend.services.mirror.types import MirrorImageResult

    monkeypatch.setenv("EZA_MIRROR_SCENE_ASSET_DIR", str(tmp_path))
    monkeypatch.setenv("EZA_MIRROR_SCENE_ASSET_BASE_URL", "https://api.test.eza.ai")
    from backend.config import get_settings

    get_settings.cache_clear()

    tiny_png_data_url = (
        "data:image/png;base64,"
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    )
    fake = MirrorImageResult(
        scene_image_url=tiny_png_data_url,
        provider="openai",
        cached=False,
    )
    plus_user = _make_plus_user()
    with _patch_production_user(plus_user), patch(
        "backend.services.mirror.mirror_image_service.get_mirror_image_provider"
    ) as get_prov:
        mock_provider = MockMirrorImageProvider()
        mock_provider.generate_scene = AsyncMock(return_value=fake)
        get_prov.return_value = mock_provider

        res = client.post(
            "/api/standalone/mirror/generate-scene",
            json=VALID_BODY,
            headers=_auth_header(plus_user),
        )

    get_settings.cache_clear()
    assert res.status_code == 200
    data = res.json()
    assert data["provider"] == "openai"
    assert data["sceneImageUrl"].startswith("https://api.test.eza.ai/api/public/mirror-scene-assets/")
    assert not data["sceneImageUrl"].startswith("data:")


def test_generate_scene_rejects_empty_prompt():
    body = {**VALID_BODY, "prompt": ""}
    plus_user = _make_plus_user()
    with _patch_production_user(plus_user):
        res = client.post(
            "/api/standalone/mirror/generate-scene",
            json=body,
            headers=_auth_header(plus_user),
        )
    assert res.status_code == 422 or res.status_code == 400


def test_generate_scene_rejects_invalid_style_preset():
    body = {**VALID_BODY, "stylePreset": "invalid_preset"}
    plus_user = _make_plus_user()
    with _patch_production_user(plus_user):
        res = client.post(
            "/api/standalone/mirror/generate-scene",
            json=body,
            headers=_auth_header(plus_user),
        )
    assert res.status_code == 400
    detail = res.json()["detail"]
    assert detail["error"] == "invalid_style_preset"
