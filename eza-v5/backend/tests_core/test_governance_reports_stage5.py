# -*- coding: utf-8 -*-
"""Governance report APIs — Stage 5."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.auth.deps import get_current_user
from backend.core.governance.reports import (
    build_governance_overview,
    build_engine_reliability,
    build_calibration_summary,
    FORBIDDEN_RESPONSE_KEYS,
)


@pytest.mark.asyncio
async def test_overview_empty_state():
    db = AsyncMock()
    with patch(
        "backend.core.governance.reports._events_table_ready",
        new_callable=AsyncMock,
        return_value=False,
    ), patch(
        "backend.core.governance.reports._feedback_stats",
        new_callable=AsyncMock,
        return_value={
            "feedback_count": 0,
            "false_positive_count": 0,
            "false_negative_count": 0,
        },
    ):
        out = await build_governance_overview(db, "org-a")
    assert out["tables_ready"] is False
    assert out["event_counts"]["last_24h"] == 0
    assert out["source_mode_distribution"] == {}


@pytest.mark.asyncio
async def test_overview_org_isolation_in_query():
    """Overview uses org_id parameter in SQL (verified via call path)."""
    db = AsyncMock()
    with patch(
        "backend.core.governance.reports._events_table_ready",
        new_callable=AsyncMock,
        return_value=True,
    ), patch(
        "backend.core.governance.reports._count_events_since",
        new_callable=AsyncMock,
        return_value=5,
    ) as mock_count, patch(
        "backend.core.governance.reports._distribution",
        new_callable=AsyncMock,
        return_value={"standalone": 3},
    ), patch(
        "backend.core.governance.reports._avg_scores",
        new_callable=AsyncMock,
        return_value=(72.0, 68.0),
    ), patch(
        "backend.core.governance.reports._feedback_stats",
        new_callable=AsyncMock,
        return_value={
            "feedback_count": 2,
            "false_positive_count": 1,
            "false_negative_count": 0,
        },
    ):
        out = await build_governance_overview(db, "org-secret")
    assert out["org_id"] == "org-secret"
    assert mock_count.await_args_list[0].args[1] == "org-secret"


@pytest.mark.asyncio
async def test_engine_reliability_empty_state():
    db = AsyncMock()
    with patch(
        "backend.core.governance.reports._events_table_ready",
        new_callable=AsyncMock,
        return_value=False,
    ):
        out = await build_engine_reliability(db, "org-a")
    assert out["tables_ready"] is False
    assert out["engine_average_scores"] == {}
    assert out["disagreement_rate"] == 0.0


@pytest.mark.asyncio
async def test_calibration_summary_feedback_aggregation():
    db = AsyncMock()

    type_rows = MagicMock()
    type_rows.fetchall.return_value = [
        ("CORRECT", 10),
        ("TOO_STRICT", 4),
        ("TOO_SOFT", 2),
        ("FALSE_POSITIVE", 3),
    ]
    weekly_rows = MagicMock()
    weekly_rows.fetchall.return_value = [
        (MagicMock(isoformat=lambda: "2026-05-01T00:00:00+00:00"), "CORRECT", 5),
    ]
    risk_rows = MagicMock()
    risk_rows.fetchall.return_value = [("medium", 4), ("high", 2)]

    async def fake_execute(stmt, params=None):
        sql = str(stmt)
        if "GROUP BY feedback_type" in sql and "week_start" not in sql:
            return type_rows
        if "week_start" in sql:
            return weekly_rows
        if "risk_label" in sql:
            return risk_rows
        return MagicMock(fetchall=lambda: [])

    db.execute = fake_execute

    with patch(
        "backend.core.governance.reports._feedback_table_ready",
        new_callable=AsyncMock,
        return_value=True,
    ), patch(
        "backend.core.governance.reports._events_table_ready",
        new_callable=AsyncMock,
        return_value=True,
    ):
        out = await build_calibration_summary(db, "org-a", weeks=4)

    assert out["total_feedback"] == 19
    assert out["feedback_type_distribution"]["TOO_STRICT"] == 4
    assert out["too_strict_ratio"] == pytest.approx(4 / 6, rel=1e-3)
    assert len(out["weekly_calibration_raw"]) == 1
    assert out["most_corrected_risk_labels"][0]["risk_label"] == "medium"


def test_no_raw_content_in_overview_shape():
    forbidden = FORBIDDEN_RESPONSE_KEYS
    from backend.core.governance.reports import _sanitize_distribution

    clean = _sanitize_distribution({"standalone": 5, "message": 99, "user_input": 1})
    assert "message" not in clean
    assert "standalone" in clean
    for key in forbidden:
        assert key not in json.dumps(clean)


def test_governance_overview_endpoint_cross_org_403():
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
            "/api/admin/governance/overview",
            headers={"Authorization": "Bearer x", "x-org-id": "org-other"},
        )
        assert r.status_code == 403
    app.dependency_overrides.clear()
