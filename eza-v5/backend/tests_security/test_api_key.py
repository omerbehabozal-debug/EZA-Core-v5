# -*- coding: utf-8 -*-
"""
API Key Authentication Tests
"""

import pytest
from fastapi.testclient import TestClient

from backend.config import get_settings
from backend.main import app

client = TestClient(app)

_TEST_INTERNAL_KEY = "phase812-api-key-test-only"


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_test_results_endpoint_uses_non_production_surface_guard(monkeypatch: pytest.MonkeyPatch):
    """Phase 8.1: /api/test-results/latest is absent in production (404), open in explicit CI."""
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("EZA_ENV", "production")
    get_settings.cache_clear()
    response = client.get("/api/test-results/latest")
    assert response.status_code == 404

    monkeypatch.setenv("EZA_ENV", "ci")
    monkeypatch.delenv("ENV", raising=False)
    get_settings.cache_clear()
    response = client.get("/api/test-results/latest")
    assert response.status_code == 200


def test_internal_endpoints_require_api_key(monkeypatch: pytest.MonkeyPatch):
    """Phase 8.1.2: /api/internal/* requires non-prod env + EZA_ADMIN_API_KEY."""
    monkeypatch.setenv("EZA_ENV", "ci")
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.setenv("EZA_ADMIN_API_KEY", _TEST_INTERNAL_KEY)
    get_settings.cache_clear()

    response = client.post("/api/internal/run", json={"text": "Test"})
    assert response.status_code == 401

    response = client.post(
        "/api/internal/run",
        json={"text": "Test"},
        headers={"X-Api-Key": "invalid_key"},
    )
    assert response.status_code == 401

    response = client.post(
        "/api/internal/run",
        json={"text": "Test"},
        headers={"X-Api-Key": _TEST_INTERNAL_KEY},
    )
    assert response.status_code != 401
