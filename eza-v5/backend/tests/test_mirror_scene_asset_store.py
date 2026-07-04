# -*- coding: utf-8 -*-
"""Tests for mirror scene durable asset storage."""

from __future__ import annotations

import base64
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.config import get_settings
from backend.main import app
from backend.services.mirror.mirror_scene_asset_store import (
    build_mirror_scene_asset_public_url,
    ensure_persistable_mirror_scene_url,
    parse_mirror_scene_data_url,
    save_mirror_scene_bytes,
)
from backend.services.mirror_network.publish import resolve_scene_image_url

# 1x1 PNG
TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
TINY_PNG_DATA_URL = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


@pytest.fixture
def asset_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("EZA_MIRROR_SCENE_ASSET_DIR", str(tmp_path))
    monkeypatch.setenv("EZA_MIRROR_SCENE_ASSET_BASE_URL", "https://api.test.eza.ai")
    get_settings.cache_clear()
    yield tmp_path
    get_settings.cache_clear()


def test_parse_mirror_scene_data_url_accepts_png(asset_dir: Path):
    parsed = parse_mirror_scene_data_url(TINY_PNG_DATA_URL)
    assert parsed == TINY_PNG


def test_parse_mirror_scene_data_url_rejects_blob():
    assert parse_mirror_scene_data_url("blob:https://localhost/uuid") is None


def test_save_mirror_scene_bytes_returns_https_url(asset_dir: Path):
    url = save_mirror_scene_bytes(TINY_PNG)
    assert url.startswith("https://api.test.eza.ai/api/public/mirror-scene-assets/")
    assert url.endswith(".png")
    assert len(list(asset_dir.glob("*.png"))) == 1


def test_ensure_persistable_mirror_scene_url_persists_data_url(asset_dir: Path):
    url = ensure_persistable_mirror_scene_url(TINY_PNG_DATA_URL)
    assert url is not None
    assert url.startswith("https://api.test.eza.ai/api/public/mirror-scene-assets/")


def test_ensure_persistable_mirror_scene_url_passes_through_https():
    raw = "https://cdn.example.com/scene.png"
    assert ensure_persistable_mirror_scene_url(raw) == raw


def test_ensure_persistable_mirror_scene_url_rejects_blob():
    assert ensure_persistable_mirror_scene_url("blob:https://localhost/scene") is None


def test_resolve_scene_image_url_persists_incoming_data_url(asset_dir: Path):
    resolved = resolve_scene_image_url(
        existing_scene="https://cdn.example.com/old.png",
        incoming_scene=TINY_PNG_DATA_URL,
    )
    assert resolved is not None
    assert resolved.startswith("https://api.test.eza.ai/api/public/mirror-scene-assets/")


def test_resolve_scene_image_url_keeps_existing_when_incoming_invalid(asset_dir: Path):
    resolved = resolve_scene_image_url(
        existing_scene="https://cdn.example.com/old.png",
        incoming_scene="blob:invalid",
    )
    assert resolved == "https://cdn.example.com/old.png"


def test_public_asset_endpoint_serves_saved_file(asset_dir: Path):
    public_url = save_mirror_scene_bytes(TINY_PNG)
    filename = public_url.rsplit("/", 1)[-1]
    client = TestClient(app)
    res = client.get(f"/api/public/mirror-scene-assets/{filename}")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("image/png")
    assert res.headers.get("x-content-type-options") == "nosniff"
    assert res.headers.get("cache-control") == "public, max-age=31536000, immutable"
    assert res.content == TINY_PNG


def test_public_asset_endpoint_rejects_path_traversal(asset_dir: Path):
    client = TestClient(app)
    res = client.get("/api/public/mirror-scene-assets/../../etc/passwd")
    assert res.status_code == 404


def test_public_asset_endpoint_rejects_invalid_filename(asset_dir: Path):
    client = TestClient(app)
    res = client.get("/api/public/mirror-scene-assets/not-a-valid-uuid.png")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_openai_b64_json_returns_durable_https_url(asset_dir: Path):
    from unittest.mock import AsyncMock, MagicMock

    from backend.services.mirror.providers.openai_provider import OpenAIMirrorImageProvider
    from backend.services.mirror.mirror_image_service import validate_and_build_request

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "data": [
            {
                "b64_json": base64.b64encode(TINY_PNG).decode("ascii"),
            }
        ],
    }
    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.aclose = AsyncMock()

    req = validate_and_build_request(
        prompt="premium soft 3D illustration, wellness garden, no text",
        negative_prompt="text",
        seed_hint="mirror-asset-test",
        style_preset="eza_mirror_professional_v1",
        card_date="2026-05-21",
    )
    provider = OpenAIMirrorImageProvider(
        api_key="sk-test",
        model="gpt-image-1",
        http_client=mock_client,
    )
    result = await provider.generate_scene(req)
    assert result.provider == "openai"
    assert result.scene_image_url.startswith("https://api.test.eza.ai/api/public/mirror-scene-assets/")
    assert not result.scene_image_url.startswith("data:")
