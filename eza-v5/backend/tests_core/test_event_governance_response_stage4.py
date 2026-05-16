# -*- coding: utf-8 -*-
"""Stage 4 — governance meta on pipeline responses."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.api.pipeline_runner import run_full_pipeline
from backend.core.events.event_pipeline_hook import (
    build_governance_meta,
    maybe_log_pipeline_event,
)


class _FakeLLM:
    async def generate(self, prompt: str) -> str:
        return "Safe test response for governance meta."


@pytest.mark.asyncio
async def test_governance_meta_when_logging_disabled():
    with patch("backend.core.events.event_pipeline_hook.get_settings") as mock_gs:
        settings = MagicMock()
        settings.EZA_EVENT_LOGGING_ENABLED = False
        mock_gs.return_value = settings
        result = await run_full_pipeline(
            user_input="What is ethical AI?",
            mode="standalone",
            llm_override=_FakeLLM(),
            db_session=AsyncMock(),
        )
    assert result["ok"] is True
    assert result["governance"]["event_logging_enabled"] is False
    assert result["governance"]["event_id"] is None


@pytest.mark.asyncio
async def test_governance_meta_includes_event_id_when_logged():
    db = AsyncMock()
    with patch("backend.core.events.event_pipeline_hook.get_settings") as mock_gs:
        settings = MagicMock()
        settings.EZA_EVENT_LOGGING_ENABLED = True
        mock_gs.return_value = settings
        with patch(
            "backend.core.events.event_pipeline_hook.log_eza_event",
            new_callable=AsyncMock,
            return_value="evt-uuid-99",
        ):
            with patch(
                "backend.core.events.event_pipeline_hook.normalize_standalone_event",
                return_value={
                    "source_mode": "standalone",
                    "entity_type": "user",
                    "entity_id": "u1",
                    "event_type": "message",
                    "calibration_scope": "user_level",
                },
            ):
                result = await run_full_pipeline(
                    user_input="What is ethical AI?",
                    mode="standalone",
                    llm_override=_FakeLLM(),
                    db_session=db,
                )
    assert result["governance"]["event_id"] == "evt-uuid-99"
    assert result["governance"]["event_logging_enabled"] is True


@pytest.mark.asyncio
async def test_maybe_log_returns_meta_on_failure():
    db = AsyncMock()
    with patch("backend.core.events.event_pipeline_hook.get_settings") as mock_gs:
        settings = MagicMock()
        settings.EZA_EVENT_LOGGING_ENABLED = True
        mock_gs.return_value = settings
        with patch(
            "backend.core.events.event_pipeline_hook._hook_standalone",
            new_callable=AsyncMock,
            side_effect=RuntimeError("db"),
        ):
            meta = await maybe_log_pipeline_event(
                db,
                "standalone",
                {"ok": True, "mode": "standalone"},
            )
    assert meta["event_id"] is None
    assert meta["event_logging_enabled"] is True


def test_build_governance_meta_respects_flag():
    with patch("backend.core.events.event_pipeline_hook.get_settings") as mock_gs:
        settings = MagicMock()
        settings.EZA_EVENT_LOGGING_ENABLED = True
        mock_gs.return_value = settings
        meta = build_governance_meta("id-1")
    assert meta["event_id"] == "id-1"

    with patch("backend.core.events.event_pipeline_hook.get_settings") as mock_gs:
        settings = MagicMock()
        settings.EZA_EVENT_LOGGING_ENABLED = False
        mock_gs.return_value = settings
        meta_off = build_governance_meta("id-1")
    assert meta_off["event_id"] is None
