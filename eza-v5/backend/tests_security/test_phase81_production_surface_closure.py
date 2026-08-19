# -*- coding: utf-8 -*-
"""Phase 8.1 — production surface closure tests."""

from __future__ import annotations

import json

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request

from backend.config import get_settings
from backend.main import app, general_exception_handler
from backend.security.production_surface import (
    PUBLIC_INTERNAL_ERROR_BODY,
    assert_non_production_surface,
    public_internal_error_content,
)

_TEST_JWT = "phase81-unit-test-jwt-secret-not-for-production"


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


def _dev_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENV", "dev")
    monkeypatch.delenv("EZA_ENV", raising=False)
    monkeypatch.setenv("JWT_SECRET", _TEST_JWT)
    get_settings.cache_clear()


def test_assert_non_production_surface_raises_in_production(monkeypatch: pytest.MonkeyPatch):
    _production_env(monkeypatch)
    with pytest.raises(HTTPException) as exc:
        assert_non_production_surface(surface="test")
    assert exc.value.status_code == 404


def test_assert_non_production_surface_allows_dev(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("ENV", "dev")
    monkeypatch.delenv("EZA_ENV", raising=False)
    get_settings.cache_clear()
    assert_non_production_surface(surface="test") is None


def test_public_internal_error_content_is_stable():
    assert public_internal_error_content() == PUBLIC_INTERNAL_ERROR_BODY


@pytest.mark.asyncio
async def test_general_exception_handler_masks_internal_text():
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [],
        "query_string": b"",
    }
    request = Request(scope)
    response = await general_exception_handler(
        request,
        RuntimeError("postgresql+asyncpg://secret-host/db failed"),
    )
    body = json.loads(response.body.decode())
    assert body == PUBLIC_INTERNAL_ERROR_BODY
    assert "postgresql" not in json.dumps(body).lower()
    assert response.status_code == 500


def test_reset_password_absent_in_production(monkeypatch: pytest.MonkeyPatch):
    _production_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    response = client.post(
        "/api/auth/reset-password",
        json={"email": "user@example.com", "new_password": "longpassword123"},
    )
    assert response.status_code == 404


def test_reset_password_reachable_in_dev(monkeypatch: pytest.MonkeyPatch):
    _dev_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    response = client.post(
        "/api/auth/reset-password",
        json={"email": "missing-user@example.com", "new_password": "longpassword123"},
    )
    assert response.status_code == 404
    assert response.json().get("detail") == "User not found or password reset failed"


def test_auth_debug_check_email_absent_in_production(monkeypatch: pytest.MonkeyPatch):
    _production_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/api/auth/debug/check-email", params={"email": "a@b.c"})
    assert response.status_code == 404


def test_auth_debug_test_login_absent_in_production(monkeypatch: pytest.MonkeyPatch):
    _production_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    response = client.post(
        "/api/auth/debug/test-login",
        json={"email": "a@b.c", "password": "secret"},
    )
    assert response.status_code == 404


def test_auth_debug_check_email_reachable_in_dev(monkeypatch: pytest.MonkeyPatch):
    _dev_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/api/auth/debug/check-email", params={"email": "a@b.c"})
    assert response.status_code != 404


def test_auth_debug_test_login_absent_in_production_no_credential_leak(
    monkeypatch: pytest.MonkeyPatch,
):
    _production_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    response = client.post(
        "/api/auth/debug/test-login",
        json={"email": "a@b.c", "password": "secret"},
    )
    assert response.status_code == 404
    assert "password_hash_preview" not in response.text
    assert "password_valid" not in response.text


def test_internal_setup_absent_in_production(monkeypatch: pytest.MonkeyPatch):
    _production_env(monkeypatch, INTERNAL_SETUP_KEY="test-setup-key")
    client = TestClient(app, raise_server_exceptions=False)
    response = client.post(
        "/internal/create-test-regulator-user",
        headers={"internal-setup-key": "test-setup-key"},
    )
    assert response.status_code == 404


def test_debug_openai_absent_in_production_even_with_secret(
    monkeypatch: pytest.MonkeyPatch,
):
    _production_env(monkeypatch, EZA_DEBUG_SECRET="phase81-debug-secret")
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get(
        "/api/debug/openai-health",
        headers={"X-Debug-Secret": "phase81-debug-secret"},
    )
    assert response.status_code == 404


def test_debug_mirror_network_absent_in_production_even_with_secret(
    monkeypatch: pytest.MonkeyPatch,
):
    _production_env(monkeypatch, EZA_DEBUG_SECRET="phase81-debug-secret")
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get(
        "/api/debug/mirror-network/test-slug",
        headers={"X-Debug-Secret": "phase81-debug-secret"},
    )
    assert response.status_code == 404


def test_validation_errors_preserved_in_production(monkeypatch: pytest.MonkeyPatch):
    _production_env(monkeypatch)
    client = TestClient(app, raise_server_exceptions=False)
    response = client.post(
        "/api/auth/login",
        json={"email": "not-an-email", "password": "x"},
    )
    assert response.status_code == 422
    body = response.json()
    assert "detail" in body
