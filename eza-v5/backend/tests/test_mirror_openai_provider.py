# -*- coding: utf-8 -*-
"""Tests for OpenAI Mirror image provider (mocked HTTP — no real API calls)."""

import logging
import os
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient
from backend.services.production_auth import create_access_token
from backend.config import get_settings
from backend.services.mirror.mirror_image_provider import get_mirror_image_provider
from backend.services.mirror.openai_prompt_builder import (
    V5_PROMPT_CONTRACT,
    build_openai_mirror_prompt,
)
from backend.services.mirror.providers.openai_provider import OpenAIMirrorImageProvider
from backend.services.mirror.types import MirrorImageRequest
from backend.services.mirror.mirror_image_service import validate_and_build_request

TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


@pytest.fixture
def asset_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("EZA_MIRROR_SCENE_ASSET_DIR", str(tmp_path))
    monkeypatch.setenv("EZA_MIRROR_SCENE_ASSET_BASE_URL", "https://api.test.eza.ai")
    get_settings.cache_clear()
    yield tmp_path
    get_settings.cache_clear()

VALID_BODY = {
    "prompt": "premium soft 3D illustration, wellness garden, no text",
    "negativePrompt": "text, letters, logo",
    "seedHint": "mirror-visual-abc123",
    "stylePreset": "eza_mirror_professional_v1",
    "qualityHints": ["9:16 vertical safe composition"],
    "cardDate": "2026-05-21",
}

V5_MINIMAL_PROMPT = """Create a natural cinematic scene with no text, typography, captions, title, logo, watermark, labels, UI, poster layout, or readable signage. Use abstract or illegible signage only when architecturally necessary.

CATEGORY:
health

TOPIC HINT:
Thyroid health

RENDER BRIEF:
Clean natural light. Calm premium health editorial."""


def _mirror_request() -> MirrorImageRequest:
    return validate_and_build_request(
        prompt=VALID_BODY["prompt"],
        negative_prompt=VALID_BODY["negativePrompt"],
        seed_hint=VALID_BODY["seedHint"],
        style_preset=VALID_BODY["stylePreset"],
        card_date=VALID_BODY["cardDate"],
        quality_hints=VALID_BODY["qualityHints"],
    )


def _v5_mirror_request() -> MirrorImageRequest:
    return validate_and_build_request(
        prompt=V5_MINIMAL_PROMPT,
        negative_prompt="collage, dashboard, infographic",
        seed_hint="mirror-v5-provider",
        style_preset="eza_mirror_professional_v1",
        card_date="2026-05-21",
        quality_hints=["premium magazine cover"],
        prompt_contract=V5_PROMPT_CONTRACT,
    )


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


def test_build_openai_mirror_prompt_includes_core_negative_and_hints():
    req = _mirror_request()
    combined = build_openai_mirror_prompt(req)
    assert VALID_BODY["prompt"] in combined
    assert "Avoid:" in combined
    assert "text, letters" in combined
    assert "Quality:" in combined
    assert "eza_mirror_professional_v1" in combined
    assert len(combined) <= 8000


@pytest.mark.asyncio
async def test_openai_no_api_key_falls_back_to_mock():
    provider = OpenAIMirrorImageProvider(api_key="")
    result = await provider.generate_scene(_mirror_request())
    assert result.provider == "mock"
    assert result.scene_image_url.startswith("http")


@pytest.mark.asyncio
async def test_openai_mocked_b64_returns_durable_https_url(asset_dir):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "data": [{"b64_json": TINY_PNG_B64}],
    }

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.aclose = AsyncMock()

    provider = OpenAIMirrorImageProvider(
        api_key="sk-test-key-not-real",
        model="dall-e-3",
        size="1024x1536",
        http_client=mock_client,
    )
    result = await provider.generate_scene(_mirror_request())
    assert result.provider == "openai"
    assert result.scene_image_url.startswith("https://")
    assert "/api/public/mirror-scene-assets/" in result.scene_image_url
    assert not result.scene_image_url.startswith("data:")


@pytest.mark.asyncio
async def test_openai_mocked_url_response():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "data": [{"url": "https://cdn.example.com/scene.png"}],
    }

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.aclose = AsyncMock()

    provider = OpenAIMirrorImageProvider(
        api_key="sk-test",
        model="gpt-image-1",
        http_client=mock_client,
    )
    result = await provider.generate_scene(_mirror_request())
    assert result.scene_image_url == "https://cdn.example.com/scene.png"
    assert result.provider == "openai"


@pytest.mark.asyncio
async def test_openai_provider_sends_v5_minimal_prompt_without_legacy_append():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "data": [{"url": "https://cdn.example.com/v5-scene.png"}],
    }

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.aclose = AsyncMock()

    provider = OpenAIMirrorImageProvider(
        api_key="sk-test",
        model="gpt-image-1",
        http_client=mock_client,
    )
    result = await provider.generate_scene(_v5_mirror_request())

    payload = mock_client.post.call_args.kwargs.get("json")
    assert result.provider == "openai"
    assert payload["prompt"] == V5_MINIMAL_PROMPT
    assert len(payload["prompt"]) <= 1400
    assert "Avoid:" not in payload["prompt"]
    assert "Quality:" not in payload["prompt"]
    assert "Style:" not in payload["prompt"]
    assert "eza_mirror_professional_v1" not in payload["prompt"]


def test_factory_selects_openai_provider():
    get_settings.cache_clear()
    prev = os.environ.get("EZA_MIRROR_IMAGE_PROVIDER")
    try:
        os.environ["EZA_MIRROR_IMAGE_PROVIDER"] = "openai"
        get_settings.cache_clear()
        provider = get_mirror_image_provider("openai")
        assert isinstance(provider, OpenAIMirrorImageProvider)
    finally:
        if prev is None:
            os.environ.pop("EZA_MIRROR_IMAGE_PROVIDER", None)
        else:
            os.environ["EZA_MIRROR_IMAGE_PROVIDER"] = prev
        get_settings.cache_clear()


@pytest.mark.asyncio
async def test_openai_logs_do_not_contain_api_key(caplog, asset_dir):
    caplog.set_level(logging.INFO, logger="backend.services.mirror.providers.openai_provider")
    caplog.set_level(logging.INFO, logger="backend.services.mirror.mirror_scene_asset_store")
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"data": [{"b64_json": TINY_PNG_B64}]}
    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.aclose = AsyncMock()
    secret = "sk-super-secret-key-12345"
    provider = OpenAIMirrorImageProvider(
        api_key=secret,
        model="dall-e-3",
        http_client=mock_client,
    )
    await provider.generate_scene(_mirror_request())
    log_text = caplog.text
    assert "sk-super-secret" not in log_text
    assert VALID_BODY["prompt"] not in log_text
    assert "mirror-visual-abc123" in log_text or "seed=" in log_text


def test_endpoint_returns_openai_provider_when_mocked():
    from backend.main import app
    from backend.core.account.usage_service import UsageConsumeResult
    from backend.services.mirror.types import MirrorImageResult

    fake = MirrorImageResult(
        scene_image_url="https://cdn.example.com/scene.png",
        provider="openai",
        cached=False,
    )
    plus_user = _make_plus_user()
    body = {
        **VALID_BODY,
        "conversationId": "conv-openai-provider",
        "generationRequestId": "req-openai01",
    }

    with (
        patch(
            "backend.services.mirror.mirror_image_service.get_mirror_image_provider"
        ) as get_prov,
        patch(
            "backend.auth.mirror_entitlement.get_production_user_by_id",
            new_callable=AsyncMock,
            return_value=plus_user,
        ),
        patch(
            "backend.core.account.subject.get_production_user_by_id",
            new_callable=AsyncMock,
            return_value=plus_user,
        ),
        patch(
            "backend.routers.standalone_mirror.consume_usage_event_atomic",
            new_callable=AsyncMock,
            return_value=UsageConsumeResult(event=SimpleNamespace(), created=True),
        ),
    ):
        mock_provider = MagicMock()
        mock_provider.generate_scene = AsyncMock(return_value=fake)
        get_prov.return_value = mock_provider

        client = TestClient(app)
        res = client.post(
            "/api/standalone/mirror/generate-scene",
            json=body,
            headers=_auth_header(plus_user),
        )
        assert res.status_code == 200
        data = res.json()
        assert data["provider"] == "openai"
        assert data["sceneImageUrl"].startswith("https://")
