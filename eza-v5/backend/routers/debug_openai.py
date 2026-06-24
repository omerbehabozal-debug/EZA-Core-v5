# -*- coding: utf-8 -*-
"""Protected OpenAI diagnostic endpoint."""

from __future__ import annotations

import os

from fastapi import APIRouter, Header, HTTPException, Request, status

from backend.config import get_settings
from backend.core.openai.health import run_openai_health_checks

router = APIRouter(prefix="/api/debug", tags=["Debug"])


def _is_production_env() -> bool:
    settings = get_settings()
    env = (settings.EZA_ENV or settings.ENV or "").lower()
    return env in ("prod", "production")


def _configured_debug_secret() -> str | None:
    settings = get_settings()
    return (
        (settings.EZA_DEBUG_SECRET or "").strip()
        or (os.getenv("DEBUG_SECRET") or "").strip()
        or None
    )


def _verify_debug_access(
    request: Request,
    x_debug_secret: str | None = Header(default=None, alias="X-Debug-Secret"),
    debug_secret: str | None = Header(default=None, alias="DEBUG_SECRET"),
) -> None:
    expected = _configured_debug_secret()
    if not expected:
        # Hide endpoint when secret is not configured (especially production).
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    provided = (x_debug_secret or debug_secret or "").strip()
    if not provided or provided != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"ok": False, "error": "debug_secret_required", "message": "Unauthorized"},
        )

    if _is_production_env() and not provided:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


@router.get("/openai-health")
async def openai_health(
    request: Request,
    x_debug_secret: str | None = Header(default=None, alias="X-Debug-Secret"),
    debug_secret: str | None = Header(default=None, alias="DEBUG_SECRET"),
):
    """
    OpenAI billing/connectivity diagnostic.

  Protected by EZA_DEBUG_SECRET / DEBUG_SECRET header (X-Debug-Secret).
  Returns 404 when secret is not configured on the server.
    """
    _verify_debug_access(request, x_debug_secret, debug_secret)
    report = await run_openai_health_checks()
    return report
