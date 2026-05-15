# -*- coding: utf-8 -*-
"""Universal Event Stage 2 — admin events API and feedback-event linkage."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.auth.deps import get_current_user
from backend.core.events import event_admin_service
from backend.core.engines.behavioral import service as behavioral_service
from backend.models.eza_event import EzaEvent
from backend.models.behavioral import BehavioralFeedback


def _mock_event(org_id: str = "org-a", user_id: str = "user-1") -> EzaEvent:
    row = MagicMock(spec=EzaEvent)
    row.id = uuid.uuid4()
    row.org_id = org_id
    row.user_id = user_id
    row.source_mode = "standalone"
    row.entity_type = "user"
    row.entity_id = user_id
    row.event_type = "message"
    row.calibration_scope = "user_level"
    row.regulation_scope = "none"
    row.session_id = "sess-1"
    row.timestamp = datetime.now(timezone.utc)
    row.score_vector = {"eza_final": 80.0}
    row.engine_votes = None
    row.decision_trace = None
    row.event_metadata = {"turn": 1}
    row.risk_label = "low"
    row.risk_score = 20.0
    row.confidence_score = 70.0
    row.reliability_score = 65.0
    row.can_interpret = True
    row.schema_version = 1
    return row


@pytest.mark.asyncio
async def test_admin_events_list_org_isolation():
    db = AsyncMock()
    with patch(
        "backend.api.routers.admin_events_router.check_user_organization_membership",
        new_callable=AsyncMock,
        return_value=False,
    ):
        from backend.main import app

        app.dependency_overrides[get_current_user] = lambda: {"user_id": "admin-1", "role": "admin"}
        client = TestClient(app)
        r = client.get(
            "/api/admin/events",
            headers={"Authorization": "Bearer x", "x-org-id": "org-other"},
        )
        assert r.status_code == 403
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_admin_event_detail_org_isolation():
    ev = _mock_event(org_id="org-b")
    with patch(
        "backend.core.events.event_admin_service.get_event_by_id",
        new_callable=AsyncMock,
        return_value=ev,
    ):
        detail, status = await event_admin_service.get_event_detail_for_org(
            AsyncMock(), "org-a", str(ev.id)
        )
    assert detail is None
    assert status == 403


@pytest.mark.asyncio
async def test_feedback_accepts_event_id():
    ev = _mock_event()
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()

    mock_row = MagicMock()
    mock_row.id = uuid.uuid4()
    mock_row.event_id = ev.id
    mock_row.feedback_type = "CORRECT"

    with patch(
        "backend.core.events.event_admin_service.authorize_event_feedback",
        new_callable=AsyncMock,
        return_value=(ev, None, None),
    ), patch(
        "backend.core.engines.behavioral.service.BehavioralFeedback",
        return_value=mock_row,
    ):
        result = await behavioral_service.submit_feedback(
            db,
            user_id="user-1",
            org_id="org-a",
            feedback_type="CORRECT",
            event_id=str(ev.id),
            actor_role="user",
            metric_name="eza_score",
        )
    assert result["ok"] is True
    assert result.get("event_id") == str(ev.id)
    db.add.assert_called_once()


@pytest.mark.asyncio
async def test_feedback_rejects_foreign_event():
    ev = _mock_event(user_id="other-user")
    with patch(
        "backend.core.events.event_admin_service.authorize_event_feedback",
        new_callable=AsyncMock,
        return_value=(None, 403, "foreign_event"),
    ):
        result = await behavioral_service.submit_feedback(
            AsyncMock(),
            user_id="user-1",
            org_id=None,
            feedback_type="CORRECT",
            event_id=str(ev.id),
            actor_role="user",
        )
    assert result["ok"] is False
    assert result["status"] == 403


@pytest.mark.asyncio
async def test_feedback_requires_event_or_analysis_id():
    result = await behavioral_service.submit_feedback(
        AsyncMock(),
        user_id="u1",
        org_id=None,
        feedback_type="CORRECT",
    )
    assert result["ok"] is False
    assert result["status"] == 400


def test_safemode_feedback_endpoint_requires_reference():
    from backend.main import app

    app.dependency_overrides[get_current_user] = lambda: {"user_id": "u1", "role": "user"}
    client = TestClient(app)
    r = client.post(
        "/api/safemode/feedback",
        headers={"Authorization": "Bearer x"},
        json={"feedback_type": "CORRECT", "metric_name": "eza_score"},
    )
    assert r.status_code == 400
    app.dependency_overrides.clear()
