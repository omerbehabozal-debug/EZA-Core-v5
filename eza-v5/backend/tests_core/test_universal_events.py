# -*- coding: utf-8 -*-
"""Universal Event backbone — Stage 1 unit tests."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.behavioral.interaction import analyze_interaction_turn
from backend.core.events import event_normalizer, event_logger
from backend.core.events.event_normalizer import _clip_score, _resolve_case_snapshot
from backend.core.events.event_logger import log_eza_event


def _pipeline_stub():
    return {
        "ok": True,
        "mode": "standalone",
        "eza_score": 82.5,
        "risk_level": "low",
        "data": {"user_score": 90.0, "assistant_score": 82.5},
        "behavioral": None,
    }


def _behavioral_stub():
    return analyze_interaction_turn(
        mode="standalone",
        input_analysis={"risk_score": 0.1, "intent": "question"},
        output_analysis={"risk_score": 0.15},
        alignment={"alignment_score": 88.0, "verdict": "aligned", "label": "Safe"},
        eza_score=82.5,
        redirect={"redirect": False},
    )


def test_event_normalizer_standalone():
    ev = event_normalizer.normalize_standalone_event(
        user_id="u1",
        session_id="s1",
        org_id="o1",
        pipeline_result=_pipeline_stub(),
        behavioral_snapshot=_behavioral_stub(),
        metadata={"message": "must be stripped", "turn": 1},
        case_snapshot={"vector": {"input_risk": 0.1}, "message": "secret"},
    )
    assert ev["source_mode"] == "standalone"
    assert ev["entity_type"] == "user"
    assert ev["event_type"] == "message"
    assert ev["calibration_scope"] == "user_level"
    assert ev["entity_id"] == "u1"
    assert ev["risk_score"] == pytest.approx(20.0, abs=1.0)
    assert ev["score_vector"] is not None
    assert "message" not in (ev.get("metadata") or {})
    assert "message" not in (ev.get("case_snapshot") or {})


def test_event_normalizer_proxy():
    ev = event_normalizer.normalize_proxy_event(
        user_id="u2",
        session_id="sess-fallback",
        analysis_id="analysis-abc",
        pipeline_result={"ok": True, "eza_score": 70, "risk_level": "medium"},
    )
    assert ev["source_mode"] == "proxy"
    assert ev["entity_type"] == "content"
    assert ev["event_type"] == "analysis_case"
    assert ev["calibration_scope"] == "case_level"
    assert ev["entity_id"] == "analysis-abc"
    assert ev["metadata"]["analysis_id"] == "analysis-abc"


def test_event_normalizer_proxy_entity_session_fallback():
    ev = event_normalizer.normalize_proxy_event(
        user_id="u2",
        session_id="sess-only",
        pipeline_result={"ok": True, "risk_level": "low"},
    )
    assert ev["entity_id"] == "sess-only"


def test_event_normalizer_proxy_lite():
    ev = event_normalizer.normalize_proxy_lite_event(
        user_id="u3",
        session_id="s3",
        org_id="org-1",
        case_id="case-9",
        pipeline_result={"ok": True, "risk_level": "high", "data": {"risk_level": "high"}},
        regulation_scope="btk",
    )
    assert ev["source_mode"] == "proxy_lite"
    assert ev["event_type"] == "audit_case"
    assert ev["calibration_scope"] == "org_level"
    assert ev["entity_id"] == "case-9"
    assert ev["regulation_scope"] == "btk"


def test_event_normalizer_media():
    ev = event_normalizer.normalize_media_event(
        media_case_id="mc-1",
        session_id="s4",
        media_event_type="media_video",
        risk_score=65,
        confidence_score=80,
        reliability_score=72,
        score_vector={"duration_sec": 120, "content": "strip me"},
    )
    assert ev["source_mode"] == "media_monitor"
    assert ev["entity_type"] == "media_case"
    assert ev["event_type"] == "media_video"
    assert ev["regulation_scope"] == "rtuk"
    assert ev["reliability_score"] == 72.0
    assert "content" not in (ev.get("score_vector") or {})


def test_clip_score_unknown_is_none():
    assert _clip_score(None) is None
    assert _clip_score("bad") is None
    assert _clip_score(150) == 100.0
    assert _clip_score(-5) == 0.0


@pytest.mark.asyncio
async def test_event_logger_no_raw_content_in_production():
    from backend.config import get_settings

    get_settings.cache_clear()
    settings = get_settings()
    settings.ENV = "prod"
    settings.EZA_ENV = "prod"
    settings.TEST_MODE = True

    ev = event_normalizer.normalize_standalone_event(
        user_id="u1",
        session_id="s1",
        case_snapshot={"vector": {"input_risk": 0.2}, "message": "raw"},
    )
    assert ev["case_snapshot"] is None

    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()

    with patch("backend.core.events.event_logger.EzaEvent") as MockCls:
        MockCls.return_value = MagicMock()
        eid = await log_eza_event(db, ev)
    assert eid is not None
    assert MockCls.call_args.kwargs.get("case_snapshot") is None
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_event_logger_allows_snapshot_in_test_mode():
    from backend.config import get_settings

    get_settings.cache_clear()
    settings = get_settings()
    settings.ENV = "dev"
    settings.TEST_MODE = True

    snap = {"vector": {"input_risk": 0.2}, "mode": "standalone"}
    ev = event_normalizer.normalize_standalone_event(
        user_id="u1",
        session_id="s1",
        case_snapshot=snap,
    )
    assert ev["case_snapshot"] is not None

    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()

    mock_row = MagicMock()
    snap = ev["case_snapshot"]
    with patch("backend.core.events.event_logger.EzaEvent", return_value=mock_row) as MockCls:
        eid = await log_eza_event(db, ev)
    assert eid is not None
    assert MockCls.call_args.kwargs.get("case_snapshot") == snap
    get_settings.cache_clear()


def test_agent_event_stub_shape():
    ev = event_normalizer.normalize_agent_event(
        agent_id="agent-7",
        session_id="s-agent",
        decision_label="pending",
    )
    assert ev["source_mode"] == "agent_runtime"
    assert ev["entity_type"] == "agent"
    assert ev["event_type"] == "agent_decision"
    assert ev["can_interpret"] is False
    assert ev["metadata"]["stub"] is True
    assert ev["metadata"]["phase"] == 3
    assert ev["risk_score"] is None
    assert ev["reliability_score"] is None


def test_autonomy_event_stub_shape():
    ev = event_normalizer.normalize_autonomy_event(
        entity_id="veh-1",
        session_id="s-auto",
        autonomy_event_type="motion_event",
        entity_type="vehicle",
    )
    assert ev["source_mode"] == "autonomy_monitor"
    assert ev["entity_type"] == "vehicle"
    assert ev["event_type"] == "motion_event"
    assert ev["regulation_scope"] == "autonomy_safety"
    assert ev["can_interpret"] is False
    assert ev["metadata"]["stub"] is True
    assert ev["metadata"]["phase"] == 4


@pytest.mark.asyncio
async def test_event_logger_missing_required_returns_none():
    db = AsyncMock()
    assert await log_eza_event(db, {"source_mode": "standalone"}) is None
    db.add.assert_not_called()


def test_pipeline_hook_is_non_blocking_optional():
    import inspect
    from backend.api import pipeline_runner

    src = inspect.getsource(pipeline_runner)
    assert "maybe_log_pipeline_event" in src
    assert "Universal event hook failed (non-blocking)" in src
    assert "return response" in src
