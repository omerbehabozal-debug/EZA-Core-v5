# -*- coding: utf-8 -*-
"""Phase 8.1.3 — internal key logging polish and regression guards."""

from __future__ import annotations

import logging
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.config import get_settings
from backend.main import app

_TEST_JWT = "phase813-unit-test-jwt-secret-not-for-production"
_TEST_INTERNAL_KEY = "phase813-internal-api-key-test-only"
_INVALID_KEY = "phase813-invalid-key-value-not-for-production"


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
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


def test_invalid_internal_api_key_still_rejected(monkeypatch: pytest.MonkeyPatch):
    _ci_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    with patch(
        "backend.routers.gateway.call_llm_provider",
        new_callable=AsyncMock,
    ) as mock_provider:
        response = client.post(
            "/api/gateway/test-call",
            json={"prompt": "hello", "provider": "openai"},
            headers={"X-Api-Key": _INVALID_KEY},
        )
    assert response.status_code == 401
    mock_provider.assert_not_called()


def test_invalid_internal_key_logs_no_credential_fragment(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
):
    _ci_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    caplog.set_level(logging.WARNING, logger="backend.auth.internal_access")

    with patch(
        "backend.routers.gateway.call_llm_provider",
        new_callable=AsyncMock,
    ):
        client.post(
            "/api/gateway/test-call",
            json={"prompt": "hello", "provider": "openai"},
            headers={"X-Api-Key": _INVALID_KEY},
        )

    internal_logs = [
        r.message
        for r in caplog.records
        if r.name == "backend.auth.internal_access"
    ]
    assert any("Invalid internal API key" in msg for msg in internal_logs)
    joined = "\n".join(internal_logs)
    assert _INVALID_KEY not in joined
    assert _INVALID_KEY[:8] not in joined
    assert _TEST_INTERNAL_KEY not in joined


def test_missing_internal_key_logs_no_credential_fragment(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
):
    _ci_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    caplog.set_level(logging.WARNING, logger="backend.auth.internal_access")

    with patch(
        "backend.routers.gateway.call_llm_provider",
        new_callable=AsyncMock,
    ):
        client.post(
            "/api/gateway/test-call",
            json={"prompt": "hello", "provider": "openai"},
        )

    internal_logs = [
        r.message
        for r in caplog.records
        if r.name == "backend.auth.internal_access"
    ]
    assert not any("prefix=" in msg for msg in internal_logs)
    assert not any(_TEST_INTERNAL_KEY in msg for msg in internal_logs)


def test_internal_routes_remain_closed_in_production(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("EZA_ENV", "production")
    monkeypatch.setenv("EZA_JWT_SECRET", _TEST_JWT)
    monkeypatch.setenv("EZA_ADMIN_API_KEY", _TEST_INTERNAL_KEY)
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
