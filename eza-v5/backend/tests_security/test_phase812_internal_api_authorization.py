# -*- coding: utf-8 -*-
"""Phase 8.1.2 — internal API authorization closure tests."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.config import get_settings
from backend.main import app
from backend.security.production_surface import assert_non_production_surface

_TEST_JWT = "phase812-unit-test-jwt-secret-not-for-production"
_TEST_INTERNAL_KEY = "phase812-internal-api-key-test-only"


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _production_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("EZA_ENV", "production")
    monkeypatch.setenv("EZA_JWT_SECRET", _TEST_JWT)
    monkeypatch.setenv("EZA_ADMIN_API_KEY", _TEST_INTERNAL_KEY)
    get_settings.cache_clear()


def _ci_env(monkeypatch: pytest.MonkeyPatch, *, admin_key: str | None = _TEST_INTERNAL_KEY) -> None:
    monkeypatch.setenv("EZA_ENV", "ci")
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.setenv("JWT_SECRET", _TEST_JWT)
    if admin_key is None:
        monkeypatch.delenv("EZA_ADMIN_API_KEY", raising=False)
    else:
        monkeypatch.setenv("EZA_ADMIN_API_KEY", admin_key)
    get_settings.cache_clear()


def test_require_internal_not_no_auth_in_production(monkeypatch: pytest.MonkeyPatch):
    _production_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    with patch(
        "backend.routers.gateway.call_llm_provider",
        new_callable=AsyncMock,
    ) as mock_provider:
        response = client.post(
            "/api/gateway/test-call",
            json={"prompt": "hello", "provider": "openai"},
            headers={"X-Api-Key": _TEST_INTERNAL_KEY},
        )
    assert response.status_code == 404
    mock_provider.assert_not_called()


def test_gateway_test_call_rejects_missing_key(monkeypatch: pytest.MonkeyPatch):
    _ci_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    with patch(
        "backend.routers.gateway.call_llm_provider",
        new_callable=AsyncMock,
    ) as mock_provider:
        response = client.post(
            "/api/gateway/test-call",
            json={"prompt": "hello", "provider": "openai"},
        )
    assert response.status_code == 401
    mock_provider.assert_not_called()


def test_gateway_test_call_rejects_invalid_key(monkeypatch: pytest.MonkeyPatch):
    _ci_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    with patch(
        "backend.routers.gateway.call_llm_provider",
        new_callable=AsyncMock,
    ) as mock_provider:
        response = client.post(
            "/api/gateway/test-call",
            json={"prompt": "hello", "provider": "openai"},
            headers={"X-Api-Key": "wrong-key-value"},
        )
    assert response.status_code == 401
    mock_provider.assert_not_called()


def test_gateway_evaluate_not_public_in_production(monkeypatch: pytest.MonkeyPatch):
    _production_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    response = client.post(
        "/api/gateway/evaluate",
        json={"input_text": "a", "output_text": "b"},
        headers={"X-Api-Key": _TEST_INTERNAL_KEY},
    )
    assert response.status_code == 404


def test_proxy_eval_not_public_in_production(monkeypatch: pytest.MonkeyPatch):
    _production_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    with patch(
        "backend.routers.proxy.route_model",
        new_callable=AsyncMock,
    ) as mock_route:
        response = client.post(
            "/api/proxy/eval",
            json={"message": "hello", "depth": "fast"},
            headers={"X-Api-Key": _TEST_INTERNAL_KEY},
        )
    assert response.status_code == 404
    mock_route.assert_not_called()


def test_internal_proxy_run_not_public_in_production(monkeypatch: pytest.MonkeyPatch):
    _production_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    with patch(
        "backend.routers.internal_proxy.run_debug_pipeline",
        new_callable=AsyncMock,
    ) as mock_pipeline:
        response = client.post(
            "/api/internal/run",
            json={"text": "hello"},
            headers={"X-Api-Key": _TEST_INTERNAL_KEY},
        )
    assert response.status_code == 404
    mock_pipeline.assert_not_called()


def test_multimodal_video_not_public_in_production(monkeypatch: pytest.MonkeyPatch):
    _production_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    with patch(
        "backend.routers.multimodal.run_video_multimodal_pipeline",
    ) as mock_video:
        response = client.post(
            "/api/multimodal/video/run",
            files={"file": ("clip.mp4", b"fake-video", "video/mp4")},
            headers={"X-Api-Key": _TEST_INTERNAL_KEY},
        )
    assert response.status_code == 404
    mock_video.assert_not_called()


def test_unknown_env_blocks_internal_surface(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.delenv("EZA_ENV", raising=False)
    get_settings.cache_clear()
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        assert_non_production_surface(surface="internal-api")
    assert exc.value.status_code == 404


def test_missing_env_blocks_internal_surface(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.delenv("EZA_ENV", raising=False)
    get_settings.cache_clear()
    client = TestClient(app, raise_server_exceptions=False)
    with patch(
        "backend.routers.gateway.call_llm_provider",
        new_callable=AsyncMock,
    ) as mock_provider:
        response = client.post(
            "/api/gateway/test-call",
            json={"prompt": "hello", "provider": "openai"},
            headers={"X-Api-Key": _TEST_INTERNAL_KEY},
        )
    assert response.status_code == 404
    mock_provider.assert_not_called()


def test_ci_internal_key_allows_gateway_before_provider(monkeypatch: pytest.MonkeyPatch):
    _ci_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    with patch(
        "backend.routers.gateway.call_llm_provider",
        new_callable=AsyncMock,
        return_value="mock-output",
    ) as mock_provider:
        response = client.post(
            "/api/gateway/test-call",
            json={"prompt": "hello", "provider": "openai", "policy_pack": "eu_ai"},
            headers={"X-Api-Key": _TEST_INTERNAL_KEY},
        )
    assert response.status_code == 200
    mock_provider.assert_called_once()


def test_login_validation_4xx_preserved(monkeypatch: pytest.MonkeyPatch):
    _production_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    response = client.post(
        "/api/auth/login",
        json={"email": "not-an-email", "password": "x"},
    )
    assert response.status_code == 422
    assert "detail" in response.json()
