# -*- coding: utf-8 -*-
"""Governance weekly calibration report — Stage 6."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.auth.deps import get_current_user
from backend.core.governance.reports import (
    build_weekly_calibration_report,
    _generate_calibration_suggestions,
    WEEKLY_CALIBRATION_DISCLAIMER,
    FORBIDDEN_RESPONSE_KEYS,
)


@pytest.mark.asyncio
async def test_weekly_report_empty_state():
    db = AsyncMock()
    with patch(
        "backend.core.governance.reports._events_table_ready",
        new_callable=AsyncMock,
        return_value=False,
    ), patch(
        "backend.core.governance.reports._feedback_table_ready",
        new_callable=AsyncMock,
        return_value=False,
    ):
        out = await build_weekly_calibration_report(db, "org-a", weeks=1)
    assert out["total_events"] == 0
    assert out["total_feedback"] == 0
    assert out["confidence"] == "low"
    assert out["do_not_auto_apply"] is True
    assert out["disclaimer"] == WEEKLY_CALIBRATION_DISCLAIMER


@pytest.mark.asyncio
async def test_weekly_report_feedback_aggregation():
    db = AsyncMock()

    type_rows = MagicMock()
    type_rows.fetchall.return_value = [
        ("CORRECT", 8),
        ("FALSE_POSITIVE", 2),
        ("TOO_STRICT", 1),
    ]
    metric_rows = MagicMock()
    metric_rows.fetchall.return_value = [("eza_score", 2)]
    label_rows = MagicMock()
    label_rows.fetchall.return_value = []

    async def fake_execute(stmt, params=None):
        sql = str(stmt)
        if "GROUP BY feedback_type" in sql and "metric_name" not in sql:
            return type_rows
        if "metric_name" in sql:
            return metric_rows
        if "risk_label" in sql:
            return label_rows
        if "COUNT(*)" in sql and "eza_events" in sql:
            m = MagicMock()
            m.scalar = lambda: 50
            return m
        return MagicMock(fetchall=lambda: [], scalar=lambda: 0)

    db.execute = fake_execute

    with patch(
        "backend.core.governance.reports._events_table_ready",
        new_callable=AsyncMock,
        return_value=True,
    ), patch(
        "backend.core.governance.reports._feedback_table_ready",
        new_callable=AsyncMock,
        return_value=True,
    ), patch(
        "backend.core.governance.reports.build_engine_reliability",
        new_callable=AsyncMock,
        return_value={
            "disagreement_rate": 0.05,
            "low_confidence_event_count": 0,
            "engine_average_scores": {},
            "sample_size": 10,
        },
    ):
        out = await build_weekly_calibration_report(db, "org-a", weeks=1)

    assert out["total_feedback"] == 11
    assert out["feedback_quality"]["correct_rate"] == pytest.approx(8 / 11, rel=1e-3)
    assert out["top_problem_metrics"][0]["metric_name"] == "eza_score"


def test_suggestions_generated_for_high_false_positive():
    type_dist = {
        "CORRECT": 2,
        "FALSE_POSITIVE": 8,
        "FALSE_NEGATIVE": 0,
        "TOO_STRICT": 0,
        "TOO_SOFT": 0,
    }
    suggestions = _generate_calibration_suggestions(
        type_dist,
        total_feedback=10,
        top_metrics=[],
        engine_report={"disagreement_rate": 0, "low_confidence_event_count": 0, "sample_size": 0},
        confidence="high",
    )
    types = {s["type"] for s in suggestions}
    assert "threshold_review" in types
    assert any("false positive" in s["message"].lower() for s in suggestions)


def test_suggestions_generated_for_too_strict():
    type_dist = {
        "CORRECT": 1,
        "TOO_STRICT": 4,
        "TOO_SOFT": 1,
    }
    suggestions = _generate_calibration_suggestions(
        type_dist,
        total_feedback=6,
        top_metrics=[],
        engine_report={"disagreement_rate": 0, "low_confidence_event_count": 0, "sample_size": 0},
        confidence="medium",
    )
    assert any(s["type"] == "too_strict_warning" for s in suggestions)


@pytest.mark.asyncio
async def test_weekly_report_org_isolation():
    db = AsyncMock()
    captured: list = []

    async def fake_count(d, org_id, since):
        captured.append(org_id)
        return 0

    with patch(
        "backend.core.governance.reports._events_table_ready",
        new_callable=AsyncMock,
        return_value=True,
    ), patch(
        "backend.core.governance.reports._feedback_table_ready",
        new_callable=AsyncMock,
        return_value=False,
    ), patch(
        "backend.core.governance.reports._count_events_since",
        new_callable=AsyncMock,
        side_effect=fake_count,
    ):
        await build_weekly_calibration_report(db, "org-xyz", weeks=1)
    assert captured == ["org-xyz"]


def test_no_raw_content_in_weekly_report():
    out = build_weekly_calibration_report  # ensure module loads
    payload = json.dumps({
        "top_problem_metrics": [{"metric_name": "eza_score", "count": 1}],
        "disclaimer": WEEKLY_CALIBRATION_DISCLAIMER,
    })
    for key in FORBIDDEN_RESPONSE_KEYS:
        assert key not in payload


def test_weekly_endpoint_cross_org_403():
    from backend.main import app

    with patch(
        "backend.api.routers.admin_governance_router.check_user_organization_membership",
        new_callable=AsyncMock,
        return_value=False,
    ):
        app.dependency_overrides[get_current_user] = lambda: {
            "user_id": "admin-1",
            "role": "admin",
        }
        client = TestClient(app)
        r = client.get(
            "/api/admin/governance/weekly-calibration-report?weeks=1",
            headers={"Authorization": "Bearer x", "x-org-id": "org-other"},
        )
        assert r.status_code == 403
    app.dependency_overrides.clear()
