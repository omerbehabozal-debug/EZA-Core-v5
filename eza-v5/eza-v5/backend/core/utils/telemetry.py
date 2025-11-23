# -*- coding: utf-8 -*-
"""
Telemetry Module
Production-grade logging for LLM calls and system events
"""

import time
import logging
from typing import Optional

logger = logging.getLogger("eza.telemetry")


def log_llm_call(
    provider: str,
    model: str,
    duration_ms: float,
    ok: bool,
    error: Optional[str] = None,
    mode: str = "standalone",
):
    """
    Log LLM call telemetry data.
    
    Args:
        provider: LLM provider name (e.g., "openai")
        model: Model name (e.g., "gpt-4o-mini")
        duration_ms: Call duration in milliseconds
        ok: Whether the call was successful
        error: Error message if call failed (None if successful)
        mode: Pipeline mode ("standalone", "proxy_fast", "proxy_deep")
    """
    level = logging.INFO if ok else logging.WARNING
    logger.log(
        level,
        f"[LLM_CALL] provider={provider} model={model} mode={mode} "
        f"duration_ms={duration_ms:.1f} ok={ok} error={error or '-'}",
    )


def log_pipeline_event(
    event_type: str,
    mode: str,
    duration_ms: float,
    ok: bool,
    details: Optional[str] = None,
):
    """
    Log pipeline-level events.
    
    Args:
        event_type: Event type (e.g., "standalone_request", "proxy_eval")
        mode: Pipeline mode
        duration_ms: Total pipeline duration
        ok: Whether pipeline completed successfully
        details: Additional details (optional)
    """
    level = logging.INFO if ok else logging.ERROR
    logger.log(
        level,
        f"[PIPELINE] event={event_type} mode={mode} "
        f"duration_ms={duration_ms:.1f} ok={ok} details={details or '-'}",
    )

