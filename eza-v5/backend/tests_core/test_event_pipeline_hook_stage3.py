# -*- coding: utf-8 -*-
"""Universal Event Stage 3 — optional pipeline hook tests."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.core.events import event_pipeline_hook
from backend.api.pipeline_runner import run_full_pipeline


class _FakeLLM:
    async def generate(self, prompt: str) -> str:
        return "Safe test response for event hook."


@pytest.fixture
def fake_llm():
    return _FakeLLM()


@pytest.fixture
def sample_text():
    return "What is ethical AI?"


@pytest.mark.asyncio
async def test_event_logging_disabled_does_not_call_log(fake_llm, sample_text):
    db = AsyncMock()
    with patch("backend.core.events.event_pipeline_hook.get_settings") as mock_gs:
        settings = MagicMock()
        settings.EZA_EVENT_LOGGING_ENABLED = False
        mock_gs.return_value = settings
        with patch(
            "backend.core.events.event_pipeline_hook.log_eza_event",
            new_callable=AsyncMock,
        ) as mock_log:
            result = await run_full_pipeline(
                user_input=sample_text,
                mode="standalone",
                llm_override=fake_llm,
                db_session=db,
                event_context={"user_id": "u1", "session_id": "s1"},
            )
    assert result["ok"] is True
    mock_log.assert_not_called()


@pytest.mark.asyncio
async def test_event_logging_enabled_writes_standalone_event(fake_llm, sample_text):
    db = AsyncMock()
    with patch("backend.core.events.event_pipeline_hook.get_settings") as mock_gs:
        settings = MagicMock()
        settings.EZA_EVENT_LOGGING_ENABLED = True
        mock_gs.return_value = settings
        with patch(
            "backend.core.events.event_pipeline_hook.log_eza_event",
            new_callable=AsyncMock,
            return_value="evt-123",
        ) as mock_log:
            with patch(
                "backend.core.events.event_pipeline_hook.normalize_standalone_event",
                return_value={
                    "source_mode": "standalone",
                    "entity_type": "user",
                    "entity_id": "u1",
                    "event_type": "message",
                    "calibration_scope": "user_level",
                },
            ) as mock_norm:
                result = await run_full_pipeline(
                    user_input=sample_text,
                    mode="standalone",
                    llm_override=fake_llm,
                    db_session=db,
                    event_context={"user_id": "u1", "session_id": "s1", "org_id": "o1"},
                )
    assert result["ok"] is True
    mock_norm.assert_called_once()
    mock_log.assert_called_once()


@pytest.mark.asyncio
async def test_logger_failure_pipeline_still_returns(fake_llm, sample_text):
    db = AsyncMock()
    with patch("backend.core.events.event_pipeline_hook.get_settings") as mock_gs:
        settings = MagicMock()
        settings.EZA_EVENT_LOGGING_ENABLED = True
        mock_gs.return_value = settings
        with patch(
            "backend.core.events.event_pipeline_hook.maybe_log_pipeline_event",
            new_callable=AsyncMock,
            side_effect=RuntimeError("db down"),
        ):
            result = await run_full_pipeline(
                user_input=sample_text,
                mode="standalone",
                llm_override=fake_llm,
                db_session=db,
            )
    assert result["ok"] is True
    assert result["mode"] == "standalone"


def test_production_snapshot_null_in_hook_normalizer(monkeypatch):
    from backend.config import get_settings

    get_settings.cache_clear()
    settings = get_settings()
    settings.ENV = "prod"
    settings.EZA_ENV = "prod"
    settings.TEST_MODE = True

    from backend.core.events.event_normalizer import normalize_standalone_event

    ev = normalize_standalone_event(
        user_id="u1",
        session_id="s1",
        case_snapshot={"vector": {"input_risk": 0.1}, "message": "secret"},
    )
    assert ev["case_snapshot"] is None
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_maybe_log_proxy_mode_calls_normalize():
    db = AsyncMock()
    pipeline_result = {"ok": True, "mode": "proxy", "behavioral": None, "risk_level": "low"}
    with patch("backend.core.events.event_pipeline_hook.get_settings") as mock_gs:
        settings = MagicMock()
        settings.EZA_EVENT_LOGGING_ENABLED = True
        mock_gs.return_value = settings
        with patch(
            "backend.core.events.event_pipeline_hook.normalize_proxy_event",
            return_value={
                "source_mode": "proxy",
                "entity_type": "content",
                "entity_id": "e1",
                "event_type": "analysis_case",
                "calibration_scope": "case_level",
            },
        ) as mock_norm:
            with patch(
                "backend.core.events.event_pipeline_hook.log_eza_event",
                new_callable=AsyncMock,
            ) as mock_log:
                await event_pipeline_hook.maybe_log_pipeline_event(
                    db, "proxy", pipeline_result, {"user_id": "u", "session_id": "s"}
                )
    mock_norm.assert_called_once()
    mock_log.assert_called_once()


@pytest.mark.asyncio
async def test_pipeline_response_unchanged_by_hook_flag_off(fake_llm, sample_text):
    """Hook disabled / no db: response shape identical to pre-hook behavior."""
    with patch("backend.core.events.event_pipeline_hook.get_settings") as mock_gs:
        settings = MagicMock()
        settings.EZA_EVENT_LOGGING_ENABLED = False
        mock_gs.return_value = settings
        result = await run_full_pipeline(
            user_input=sample_text,
            mode="standalone",
            llm_override=fake_llm,
            db_session=None,
        )
    assert "ok" in result
    assert result["mode"] == "standalone"
