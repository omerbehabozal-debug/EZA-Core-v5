# -*- coding: utf-8 -*-
"""
Safe Mode Faz 1 — doğrulama ve stabilizasyon testleri.
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.behavioral.interaction import analyze_interaction_turn
from backend.core.engines.behavioral import service as behavioral_service
from backend.auth.deps import get_current_user


def _minimal_snapshot():
    return analyze_interaction_turn(
        mode="standalone",
        input_analysis={"risk_score": 0.2, "intent": "question"},
        output_analysis={"risk_score": 0.15},
        alignment={"alignment_score": 88.0, "verdict": "aligned", "label": "Safe"},
        eza_score=85.0,
        redirect={"redirect": False},
    )


@pytest.mark.asyncio
async def test_record_from_pipeline_snapshot_manual():
    """record_from_pipeline_snapshot pipeline'a bağlı olmadan test edilebilir."""
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()

    snap = _minimal_snapshot()
    with patch("backend.core.engines.behavioral.service.get_settings") as mock_settings:
        mock_settings.return_value.BEHAVIORAL_CALIBRATION_ENABLED = True
        mock_settings.return_value.TEST_MODE = False
        mock_settings.return_value.ENV = "dev"
        mock_settings.return_value.EZA_ENV = None

        log_id = await behavioral_service.record_from_pipeline_snapshot(
            db,
            user_id="user-a",
            session_id="sess-1",
            org_id="org-a",
            behavioral_snapshot=snap,
        )

    assert log_id is not None
    db.add.assert_called_once()
    row = db.add.call_args[0][0]
    assert row.user_id == "user-a"
    assert row.session_id == "sess-1"
    assert row.org_id == "org-a"
    assert row.case_snapshot is None
    assert row.eza_score == 85.0


@pytest.mark.asyncio
async def test_feedback_writes_user_and_org():
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()

    mock_row = MagicMock()
    mock_row.id = uuid.uuid4()
    mock_row.user_id = "user-x"
    mock_row.org_id = "org-y"
    mock_row.feedback_type = "CORRECT"

    with patch(
        "backend.core.engines.behavioral.service.BehavioralFeedback",
        return_value=mock_row,
    ):
        result = await behavioral_service.submit_feedback(
            db,
            user_id="user-x",
            org_id="org-y",
            feedback_type="CORRECT",
            analysis_id=str(uuid.uuid4()),
            metric_name="eza_score",
        )
    assert result["ok"] is True
    assert mock_row.user_id == "user-x"
    assert mock_row.org_id == "org-y"
    assert mock_row.feedback_type == "CORRECT"


def test_case_snapshot_null_when_prod_even_if_test_mode(monkeypatch):
    from backend.config import get_settings

    get_settings.cache_clear()
    settings = get_settings()
    settings.ENV = "prod"
    settings.EZA_ENV = "prod"
    settings.TEST_MODE = True
    snap = behavioral_service.resolve_case_snapshot({"vector": {}, "mode": "x"})
    assert snap is None
    get_settings.cache_clear()


def test_pipeline_runner_not_coupled_to_safemode_db():
    import inspect
    from backend.api import pipeline_runner

    src = inspect.getsource(pipeline_runner)
    assert "record_from_pipeline_snapshot" not in src
    assert "append_behavioral_log" not in src
    assert "core.engines.behavioral.service" not in src
    # Universal events use optional hook module, not inline logging
    assert "maybe_log_pipeline_event" in src


def test_me_endpoints_use_current_user_only():
    """JWT user_id kullanılır; path/query ile başka kullanıcı seçilemez."""
    from backend.api.routers import safemode_router

    me_routes = [
        r for r in safemode_router.router.routes
        if hasattr(r, "path") and "/me/" in getattr(r, "path", "")
    ]
    assert len(me_routes) >= 3
    for route in me_routes:
        assert "{user_id}" not in route.path


def test_admin_cross_org_returns_403():
    from backend.main import app

    async def fake_admin():
        return {"user_id": "admin-1", "role": "admin"}

    app.dependency_overrides[get_current_user] = fake_admin

    with patch(
        "backend.api.routers.safemode_router.behavioral_service.verify_admin_can_view_user",
        new_callable=AsyncMock,
        return_value=False,
    ):
        with patch(
            "backend.api.routers.safemode_router.behavioral_service.get_user_trend",
            new_callable=AsyncMock,
        ) as mock_trend:
            client = TestClient(app)
            r = client.get(
                "/api/safemode/admin/users/other-user/trend",
                headers={"Authorization": "Bearer fake", "x-org-id": "org-a"},
            )
            assert r.status_code == 403
            mock_trend.assert_not_called()

    app.dependency_overrides.clear()
