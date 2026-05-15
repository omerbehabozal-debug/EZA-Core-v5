# -*- coding: utf-8 -*-
"""
Runtime governance status for Safe Mode + Universal Events (production readiness).
"""

from __future__ import annotations

import inspect
import logging
from typing import Any, Dict, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.core.events.event_normalizer import _resolve_case_snapshot

logger = logging.getLogger(__name__)

BEHAVIORAL_TABLES = ("behavioral_logs", "behavioral_baselines", "behavioral_feedback")
EVENT_TABLES = ("eza_events",)


def _is_production_env(env: str, eza_env: Optional[str]) -> bool:
    combined = { (env or "").lower(), (eza_env or "").lower() }
    return bool(combined & {"prod", "production"})


async def _table_exists(db: AsyncSession, table_name: str) -> bool:
    try:
        result = await db.execute(
            text(
                """
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = :t
                LIMIT 1
                """
            ),
            {"t": table_name},
        )
        return result.scalar() is not None
    except Exception as exc:
        logger.warning("governance table check failed for %s: %s", table_name, exc)
        return False


async def _column_exists(db: AsyncSession, table_name: str, column_name: str) -> bool:
    try:
        result = await db.execute(
            text(
                """
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = :t
                  AND column_name = :c
                LIMIT 1
                """
            ),
            {"t": table_name, "c": column_name},
        )
        return result.scalar() is not None
    except Exception as exc:
        logger.warning(
            "governance column check failed for %s.%s: %s",
            table_name,
            column_name,
            exc,
        )
        return False


def _safemode_routes_loaded() -> bool:
    try:
        from backend.api.routers import safemode_router

        return bool(getattr(safemode_router, "router", None))
    except Exception:
        return False


def _event_hook_loaded() -> bool:
    try:
        from backend.api import pipeline_runner

        return "maybe_log_pipeline_event" in inspect.getsource(pipeline_runner)
    except Exception:
        return False


def _admin_events_routes_loaded() -> bool:
    try:
        from backend.api.routers import admin_events_router

        return bool(getattr(admin_events_router, "router", None))
    except Exception:
        return False


async def build_governance_status(db: Optional[AsyncSession] = None) -> Dict[str, Any]:
    """
    Build governance status payload. Never raises — safe for production probes.
    """
    settings = get_settings()
    env = (settings.ENV or "").lower()
    eza_env = (settings.EZA_ENV or "").lower() if settings.EZA_ENV else None
    is_prod = _is_production_env(env, eza_env)

    behavioral_tables = False
    event_tables = False
    feedback_event_id = False

    if db is not None:
        try:
            behavioral_tables = True
            for table_name in BEHAVIORAL_TABLES:
                if not await _table_exists(db, table_name):
                    behavioral_tables = False
                    break
            event_tables = True
            for table_name in EVENT_TABLES:
                if not await _table_exists(db, table_name):
                    event_tables = False
                    break
            if await _table_exists(db, "behavioral_feedback"):
                feedback_event_id = await _column_exists(
                    db, "behavioral_feedback", "event_id"
                )
        except Exception as exc:
            logger.warning("governance status DB checks failed: %s", exc)

    test_mode = bool(settings.TEST_MODE)
    case_snapshot_allowed = test_mode and not is_prod
    production_snapshot_blocked = is_prod or not test_mode

    # Verify resolver blocks snapshots in production even if TEST_MODE mis-set
    probe = _resolve_case_snapshot({"vector": {"x": 1}, "mode": "standalone"})
    if is_prod:
        production_snapshot_blocked = probe is None

    routes_ok = _safemode_routes_loaded() and _admin_events_routes_loaded()

    return {
        "safe_mode": {
            "enabled": bool(settings.BEHAVIORAL_CALIBRATION_ENABLED),
            "tables_ready": behavioral_tables,
            "routes_loaded": routes_ok,
        },
        "event_logging": {
            "enabled": bool(settings.EZA_EVENT_LOGGING_ENABLED),
            "tables_ready": event_tables,
            "hook_loaded": _event_hook_loaded(),
        },
        "privacy": {
            "test_mode": test_mode,
            "case_snapshot_allowed": case_snapshot_allowed,
            "production_snapshot_blocked": production_snapshot_blocked,
        },
        "migration": {
            "behavioral_tables": behavioral_tables,
            "event_tables": event_tables,
            "feedback_event_id": feedback_event_id,
        },
        "environment": {
            "env": settings.ENV,
            "eza_env": settings.EZA_ENV,
            "is_production": is_prod,
        },
    }
