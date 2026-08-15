# -*- coding: utf-8 -*-
"""Security Hardening 1.0 — production JWT fail-closed + docs guards."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import HTTPException

from backend.auth.api_key import validate_api_key
from backend.auth.jwt import create_jwt, decode_jwt
from backend.config import get_settings, resolve_jwt_secret

BACKEND_ROOT = Path(__file__).resolve().parents[1]
_FAIL_MSG = "JWT secret must be configured in production"
_TEST_JWT = "unit-test-production-jwt-secret"
_TEST_JWT_EZA = "unit-test-eza-jwt-secret"
_TEST_ADMIN = "unit-test-admin-api-key"


@pytest.fixture(autouse=True)
def _clear_settings():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _production_env(monkeypatch, **extra: str) -> None:
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("EZA_ENV", "production")
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.delenv("EZA_JWT_SECRET", raising=False)
    for key, value in extra.items():
        if value is None:
            monkeypatch.delenv(key, raising=False)
        else:
            monkeypatch.setenv(key, value)
    get_settings.cache_clear()


def test_production_jwt_secret_from_jwt_secret(monkeypatch):
    _production_env(monkeypatch, JWT_SECRET=_TEST_JWT)
    settings = get_settings()
    token = create_jwt(1, "admin")
    payload = decode_jwt(token)
    assert payload is not None
    assert payload.get("sub") == "1"
    assert settings.TEST_MODE is False


def test_production_jwt_secret_from_eza_jwt_secret(monkeypatch):
    _production_env(monkeypatch, EZA_JWT_SECRET=_TEST_JWT_EZA)
    get_settings()
    token = create_jwt(1, "admin")
    assert decode_jwt(token) is not None


def test_production_eza_jwt_secret_takes_precedence(monkeypatch):
    _production_env(
        monkeypatch,
        EZA_JWT_SECRET=_TEST_JWT_EZA,
        JWT_SECRET=_TEST_JWT,
    )
    settings = get_settings()
    chosen = resolve_jwt_secret(settings)
    token = create_jwt(1, "admin")
    monkeypatch.setenv("EZA_JWT_SECRET", "")
    monkeypatch.setenv("JWT_SECRET", _TEST_JWT)
    get_settings.cache_clear()
    loser_settings = get_settings()
    assert chosen != resolve_jwt_secret(loser_settings)
    assert decode_jwt(token) is None


def test_production_missing_jwt_secret_fails_closed(monkeypatch):
    _production_env(monkeypatch)
    with pytest.raises(RuntimeError, match=_FAIL_MSG):
        get_settings()


def test_production_placeholder_supersecretkey_fails_closed(monkeypatch):
    _production_env(monkeypatch, JWT_SECRET="supersecretkey")
    with pytest.raises(RuntimeError, match=_FAIL_MSG):
        get_settings()


def test_production_documented_placeholder_fails_closed(monkeypatch):
    _production_env(
        monkeypatch, JWT_SECRET="your-secret-key-change-in-production"
    )
    with pytest.raises(RuntimeError, match=_FAIL_MSG):
        get_settings()


def test_dev_allows_default_jwt_secret(monkeypatch):
    monkeypatch.setenv("ENV", "dev")
    monkeypatch.setenv("EZA_ENV", "dev")
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.delenv("EZA_JWT_SECRET", raising=False)
    get_settings.cache_clear()
    settings = get_settings()
    secret = resolve_jwt_secret(settings)
    assert secret
    token = create_jwt(1, "admin")
    assert decode_jwt(token) is not None


def test_ci_and_test_env_remain_usable(monkeypatch):
    monkeypatch.setenv("ENV", "ci")
    monkeypatch.setenv("EZA_ENV", "ci")
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.delenv("EZA_JWT_SECRET", raising=False)
    get_settings.cache_clear()
    assert get_settings().ENV.lower() == "ci"

    monkeypatch.setenv("ENV", "test")
    monkeypatch.setenv("EZA_ENV", "test")
    get_settings.cache_clear()
    token = create_jwt(1, "admin")
    assert decode_jwt(token) is not None


def test_production_rejects_dev_key_when_admin_configured(monkeypatch):
    _production_env(
        monkeypatch,
        JWT_SECRET=_TEST_JWT,
        EZA_ADMIN_API_KEY=_TEST_ADMIN,
    )
    get_settings()
    with pytest.raises(HTTPException) as rejected:
        validate_api_key(x_api_key="dev-key")
    assert rejected.value.status_code == 401


def test_production_accepts_configured_admin_key(monkeypatch):
    _production_env(
        monkeypatch,
        JWT_SECRET=_TEST_JWT,
        EZA_ADMIN_API_KEY=_TEST_ADMIN,
    )
    get_settings()
    assert validate_api_key(x_api_key=_TEST_ADMIN) == _TEST_ADMIN


def test_production_missing_admin_key_fails_closed(monkeypatch):
    _production_env(monkeypatch, JWT_SECRET=_TEST_JWT)
    monkeypatch.delenv("EZA_ADMIN_API_KEY", raising=False)
    get_settings.cache_clear()
    get_settings()
    with pytest.raises(HTTPException) as missing:
        validate_api_key(x_api_key="dev-key")
    assert missing.value.status_code == 500


def test_bootstrap_docs_do_not_pair_dev_key_with_production_url():
    guide = (BACKEND_ROOT / "docs" / "BOOTSTRAP_GUIDE.md").read_text(encoding="utf-8")
    blocks = guide.split("```")
    for block in blocks:
        lower = block.lower()
        if "railway.app" in lower and "dev-key" in lower:
            pytest.fail("production URL example must not use dev-key")
    # Local-only examples may mention dev-key next to localhost.
    assert "LOCAL DEVELOPMENT ONLY" in guide
