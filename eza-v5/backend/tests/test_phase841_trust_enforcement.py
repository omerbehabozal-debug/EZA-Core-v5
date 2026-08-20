# -*- coding: utf-8 -*-
"""Phase 8.4.1 — trust enforcement closure tests."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.auth.yansi_trust_admin import (
    resolve_yansi_trust_admin_expected_key,
    validate_yansi_trust_admin_api_key,
)
from backend.config import get_settings
from backend.main import app
from backend.scripts.audit_sensitive_public_yansi_rows import (
    aggregate_yansi_visibility_audit,
    classify_yansi_visibility_row,
    risky_historical_total,
)
from backend.services.mirror_network.yansi_visibility_controls import (
    apply_yansi_safety_removal,
)

_TEST_JWT = "phase841-unit-test-jwt-secret-not-for-production"
_TRUST_KEY = "phase841-trust-admin-key-test-only"
_INTERNAL_KEY = "phase841-internal-api-key-test-only"


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


@pytest.mark.asyncio
async def test_trust_admin_rejects_missing_and_invalid_in_production(monkeypatch):
    _production_env(
        monkeypatch,
        EZA_YANSI_TRUST_ADMIN_API_KEY=_TRUST_KEY,
        EZA_ADMIN_API_KEY=_INTERNAL_KEY,
    )
    with pytest.raises(HTTPException) as missing:
        await validate_yansi_trust_admin_api_key(x_api_key=None)
    assert missing.value.status_code == 401

    with pytest.raises(HTTPException) as invalid:
        await validate_yansi_trust_admin_api_key(x_api_key="wrong-key")
    assert invalid.value.status_code == 401

    ok = await validate_yansi_trust_admin_api_key(x_api_key=_TRUST_KEY)
    assert ok == _TRUST_KEY


def test_trust_admin_prefers_dedicated_key(monkeypatch):
    _production_env(
        monkeypatch,
        EZA_YANSI_TRUST_ADMIN_API_KEY=_TRUST_KEY,
        EZA_ADMIN_API_KEY=_INTERNAL_KEY,
    )
    assert resolve_yansi_trust_admin_expected_key() == _TRUST_KEY


def test_trust_admin_falls_back_to_admin_key(monkeypatch):
    monkeypatch.delenv("EZA_YANSI_TRUST_ADMIN_API_KEY", raising=False)
    _production_env(monkeypatch, EZA_ADMIN_API_KEY=_INTERNAL_KEY)
    monkeypatch.delenv("EZA_YANSI_TRUST_ADMIN_API_KEY", raising=False)
    get_settings.cache_clear()
    assert resolve_yansi_trust_admin_expected_key() == _INTERNAL_KEY


def test_production_safety_remove_auth_matrix(monkeypatch):
    _production_env(
        monkeypatch,
        EZA_YANSI_TRUST_ADMIN_API_KEY=_TRUST_KEY,
        EZA_ADMIN_API_KEY=_INTERNAL_KEY,
    )
    client = TestClient(app)
    slug = "phase841-safety-demo"

    no_auth = client.post(f"/api/mirror-network/{slug}/safety-remove")
    assert no_auth.status_code == 401

    bad = client.post(
        f"/api/mirror-network/{slug}/safety-remove",
        headers={"X-Api-Key": "not-the-trust-key"},
    )
    assert bad.status_code == 401

    node = SimpleNamespace(
        slug=slug,
        visibility="public",
        safety_status="open",
        user_id=uuid4(),
        id=uuid4(),
    )

    async def fake_get(_db, s):
        return node if s == slug else None

    with patch(
        "backend.services.mirror_network.yansi_visibility_controls.get_mirror_network_node_by_slug",
        fake_get,
    ), patch(
        "backend.routers.mirror_network.apply_yansi_safety_removal",
        AsyncMock(
            return_value=SimpleNamespace(
                status="removed",
                slug=slug,
                visibility="private",
                safety_status="restricted",
            )
        ),
    ):
        ok = client.post(
            f"/api/mirror-network/{slug}/safety-remove",
            headers={"X-Api-Key": _TRUST_KEY},
        )
    assert ok.status_code == 200
    body = ok.json()
    assert body["status"] == "removed"
    assert body["visibility"] == "private"
    assert body["safetyStatus"] == "restricted"


def test_phase81_internal_surfaces_remain_closed_in_production(monkeypatch):
    _production_env(
        monkeypatch,
        EZA_YANSI_TRUST_ADMIN_API_KEY=_TRUST_KEY,
        EZA_ADMIN_API_KEY=_INTERNAL_KEY,
    )
    client = TestClient(app, raise_server_exceptions=False)
    headers = {"X-Api-Key": _TRUST_KEY}
    # Trust key must NOT reopen Phase 8.1 internal / gateway surfaces.
    with patch(
        "backend.routers.gateway.call_llm_provider",
        new_callable=AsyncMock,
    ) as mock_provider:
        gateway = client.post(
            "/api/gateway/test-call",
            json={"prompt": "hello", "provider": "openai"},
            headers=headers,
        )
    assert gateway.status_code == 404
    mock_provider.assert_not_called()

    for path in ("/api/internal/setup", "/api/proxy/eval", "/api/multimodal/health"):
        res = client.get(path, headers=headers)
        assert res.status_code in (404, 401, 403, 405), path


def test_require_internal_source_still_asserts_non_production():
    src = Path("auth/internal_access.py").read_text(encoding="utf-8")
    assert "assert_non_production_surface" in src
    trust = Path("auth/yansi_trust_admin.py").read_text(encoding="utf-8")
    assert "assert_non_production_surface" not in trust
    assert "EZA_YANSI_TRUST_ADMIN_API_KEY" in trust


def test_historical_sensitive_audit_fixture_counts():
    rows = [
        {"visibility": "public", "safety_status": "open"},
        {"visibility": "public", "safety_status": "review"},
        {"visibility": "unlisted", "safety_status": "review"},
        {"visibility": "private", "safety_status": "review"},
        {"visibility": "private", "safety_status": "restricted"},
    ]
    counts = aggregate_yansi_visibility_audit(rows)
    assert counts["public_open_discover_visibility"] == 1
    assert counts["review_and_public"] == 1
    assert counts["unlisted_review_link_only"] == 1
    assert counts["private_any_safety"] == 2
    assert counts["restricted_and_public"] == 0
    assert counts["restricted_not_private"] == 0
    assert risky_historical_total(counts) == 1

    flags = classify_yansi_visibility_row(
        visibility="public", safety_status="review"
    )
    assert flags["review_and_public"] is True
    assert flags["public_open_discover_visibility"] is False


def test_audit_sql_has_no_impossible_open_and_review():
    src = Path("scripts/audit_sensitive_public_yansi_rows.py").read_text(encoding="utf-8")
    assert "= 'open'\n              AND lower(coalesce(safety_status,'')) = 'review'" not in src
    assert "discover_eligible_with_review" not in src


@pytest.mark.asyncio
async def test_safety_removal_still_blocks_access(monkeypatch):
    node = SimpleNamespace(
        slug="x",
        visibility="public",
        safety_status="open",
        user_id=uuid4(),
        id=uuid4(),
    )

    async def fake_get(_db, slug):
        return node

    monkeypatch.setattr(
        "backend.services.mirror_network.yansi_visibility_controls.get_mirror_network_node_by_slug",
        fake_get,
    )
    db = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    result = await apply_yansi_safety_removal(db, slug="x")
    assert result.status == "removed"
    from backend.services.mirror_network.visibility_access import is_direct_link_accessible

    assert is_direct_link_accessible(node) is False
