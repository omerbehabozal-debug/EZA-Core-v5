# -*- coding: utf-8 -*-
"""Phase 8.1.1 — security closure tests (error leakage, test surfaces, env fail-closed)."""

from __future__ import annotations

import json

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.requests import Request

from backend.config import get_settings
from backend.main import app, http_exception_handler
from backend.security.production_surface import (
    PUBLIC_INTERNAL_ERROR_BODY,
    assert_non_production_surface,
    is_explicit_non_production_surface_allowed,
    normalize_public_http_error_content,
    public_internal_error_content,
    raw_runtime_env_label,
)

_TEST_JWT = "phase811-unit-test-jwt-secret-not-for-production"

_LEAK_PAYLOAD = (
    "postgresql+asyncpg://admin:SecretPass@db.internal.ezacore.ai:5432/eza "
    "SELECT * FROM users — traceback (most recent call last)"
)


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _production_env(monkeypatch: pytest.MonkeyPatch, **extra: str) -> None:
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("EZA_ENV", "production")
    monkeypatch.setenv("EZA_JWT_SECRET", _TEST_JWT)
    for key, value in extra.items():
        if value is None:
            monkeypatch.delenv(key, raising=False)
        else:
            monkeypatch.setenv(key, value)
    get_settings.cache_clear()


def _ci_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EZA_ENV", "ci")
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.setenv("JWT_SECRET", _TEST_JWT)
    get_settings.cache_clear()


def test_normalize_public_http_error_content_masks_500():
    body = normalize_public_http_error_content(500, _LEAK_PAYLOAD)
    assert body == PUBLIC_INTERNAL_ERROR_BODY
    assert "postgresql" not in json.dumps(body).lower()


def test_normalize_public_http_error_content_preserves_422():
    detail = [{"loc": ["body", "email"], "msg": "value is not a valid email", "type": "value_error"}]
    body = normalize_public_http_error_content(422, detail)
    assert body == {"detail": detail}


@pytest.mark.asyncio
async def test_http_exception_handler_masks_500_detail():
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [],
        "query_string": b"",
    }
    request = Request(scope)
    exc = StarletteHTTPException(status_code=500, detail=_LEAK_PAYLOAD)
    response = await http_exception_handler(request, exc)
    body = json.loads(response.body.decode())
    assert body == PUBLIC_INTERNAL_ERROR_BODY
    assert response.status_code == 500


@pytest.mark.asyncio
async def test_http_exception_handler_preserves_404():
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [],
        "query_string": b"",
    }
    request = Request(scope)
    exc = StarletteHTTPException(status_code=404, detail="Not found")
    response = await http_exception_handler(request, exc)
    body = json.loads(response.body.decode())
    assert body == {"detail": "Not found"}


def test_missing_runtime_env_is_not_explicit_non_production(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.delenv("EZA_ENV", raising=False)
    get_settings.cache_clear()
    assert raw_runtime_env_label() is None
    assert is_explicit_non_production_surface_allowed() is False


def test_unknown_runtime_env_is_not_explicit_non_production(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("ENV", "mystery")
    monkeypatch.delenv("EZA_ENV", raising=False)
    get_settings.cache_clear()
    assert is_explicit_non_production_surface_allowed() is False


def test_assert_non_production_surface_blocks_missing_env(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.delenv("EZA_ENV", raising=False)
    get_settings.cache_clear()
    with pytest.raises(HTTPException) as exc:
        assert_non_production_surface()
    assert exc.value.status_code == 404


def test_assert_non_production_surface_allows_explicit_ci(monkeypatch: pytest.MonkeyPatch):
    _ci_env(monkeypatch)
    assert_non_production_surface() is None


def test_public_test_benchmarks_absent_in_production(monkeypatch: pytest.MonkeyPatch):
    _production_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/api/public/test-safety-benchmarks")
    assert response.status_code == 404


def test_test_results_latest_absent_in_production(monkeypatch: pytest.MonkeyPatch):
    _production_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/api/test-results/latest")
    assert response.status_code == 404


def test_test_results_latest_reachable_in_ci(monkeypatch: pytest.MonkeyPatch):
    _ci_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/api/test-results/latest")
    assert response.status_code != 404


def test_main_health_reachable_in_production(monkeypatch: pytest.MonkeyPatch):
    _production_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json().get("status") == "ok"


def test_phase81_auth_debug_still_closed_in_production(monkeypatch: pytest.MonkeyPatch):
    _production_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    assert client.get("/api/auth/debug/check-email", params={"email": "a@b.c"}).status_code == 404
    assert (
        client.post(
            "/api/auth/debug/test-login",
            json={"email": "a@b.c", "password": "x"},
        ).status_code
        == 404
    )


def test_phase81_reset_still_closed_in_production(monkeypatch: pytest.MonkeyPatch):
    _production_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    response = client.post(
        "/api/auth/reset-password",
        json={"email": "a@b.c", "new_password": "longpassword123"},
    )
    assert response.status_code == 404


def test_phase81_internal_setup_still_closed_in_production(monkeypatch: pytest.MonkeyPatch):
    _production_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    response = client.post(
        "/internal/create-test-regulator-user",
        headers={"internal-setup-key": "any"},
    )
    assert response.status_code == 404
