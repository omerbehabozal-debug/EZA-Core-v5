# -*- coding: utf-8 -*-
"""Stage 4 — production governance and security verification."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.auth.deps import get_current_user
from backend.core.governance.status import build_governance_status
from backend.core.events.event_normalizer import _resolve_case_snapshot
from backend.core.events import event_pipeline_hook
from backend.core.engines.behavioral.service import resolve_case_snapshot


def test_production_blocks_snapshot_even_if_test_mode_true(monkeypatch):
    from backend.config import get_settings

    get_settings.cache_clear()
    settings = get_settings()
    settings.ENV = "production"
    settings.EZA_ENV = "production"
    settings.TEST_MODE = True

    assert resolve_case_snapshot({"vector": {}, "mode": "x"}) is None
    assert _resolve_case_snapshot({"vector": {}, "mode": "x"}) is None
    get_settings.cache_clear()


def test_get_settings_forces_test_mode_false_in_production(monkeypatch):
    from backend.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("ENV", "prod")
    monkeypatch.setenv("EZA_ENV", "production")
    monkeypatch.setenv("TEST_MODE", "true")
    get_settings.cache_clear()
    s = get_settings()
    assert s.TEST_MODE is False
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_event_logging_disabled_hook_noop():
    with patch("backend.core.events.event_pipeline_hook.get_settings") as mock_gs:
        mock_gs.return_value = MagicMock(EZA_EVENT_LOGGING_ENABLED=False)
        with patch(
            "backend.core.events.event_pipeline_hook.log_eza_event",
            new_callable=AsyncMock,
        ) as mock_log:
            await event_pipeline_hook.maybe_log_pipeline_event(
                AsyncMock(), "standalone", {"ok": True}
            )
    mock_log.assert_not_called()


@pytest.mark.asyncio
async def test_governance_status_missing_tables_no_crash():
    db = AsyncMock()
    db.execute = AsyncMock(return_value=MagicMock(scalar=lambda: None))
    status = await build_governance_status(db)
    assert status["migration"]["behavioral_tables"] is False
    assert status["migration"]["event_tables"] is False
    assert status["safe_mode"]["tables_ready"] is False
    assert status["event_logging"]["tables_ready"] is False


@pytest.mark.asyncio
async def test_governance_status_all_tables_ready():
    with patch(
        "backend.core.governance.status._table_exists",
        new_callable=AsyncMock,
        return_value=True,
    ), patch(
        "backend.core.governance.status._column_exists",
        new_callable=AsyncMock,
        return_value=True,
    ):
        status = await build_governance_status(AsyncMock())
    assert status["migration"]["behavioral_tables"] is True
    assert status["migration"]["event_tables"] is True
    assert status["migration"]["feedback_event_id"] is True


def test_governance_endpoint_admin_only():
    from backend.main import app

    client = TestClient(app)
    r = client.get("/api/admin/system/governance-status")
    assert r.status_code in (401, 403)


def test_governance_endpoint_admin_ok():
    from backend.main import app

    app.dependency_overrides[get_current_user] = lambda: {"user_id": "a1", "role": "admin"}
    with patch(
        "backend.api.routers.admin_system_router.build_governance_status",
        new_callable=AsyncMock,
        return_value={
            "safe_mode": {"enabled": False, "tables_ready": True, "routes_loaded": True},
            "event_logging": {"enabled": False, "tables_ready": True, "hook_loaded": True},
            "privacy": {
                "test_mode": False,
                "case_snapshot_allowed": False,
                "production_snapshot_blocked": True,
            },
            "migration": {
                "behavioral_tables": True,
                "event_tables": True,
                "feedback_event_id": True,
            },
        },
    ):
        client = TestClient(app)
        r = client.get(
            "/api/admin/system/governance-status",
            headers={"Authorization": "Bearer x"},
        )
    assert r.status_code == 200
    body = r.json()
    assert "safe_mode" in body
    assert "event_logging" in body
    assert "privacy" in body
    assert "migration" in body
    app.dependency_overrides.clear()


def test_behavioral_calibration_default_false():
    from backend.config import Settings

    s = Settings()
    assert s.BEHAVIORAL_CALIBRATION_ENABLED is False
    assert s.EZA_EVENT_LOGGING_ENABLED is False
