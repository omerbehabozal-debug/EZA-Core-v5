# -*- coding: utf-8 -*-
"""Phase 8.1 / 8.1.1 — production fail-closed guards and public error envelopes."""

from __future__ import annotations

import logging
import os
from typing import Any, NoReturn

from fastapi import HTTPException, status

from backend.config import get_settings, is_production_settings

# Canonical public envelope for unexpected server failures (Phase 8.1).
PUBLIC_INTERNAL_ERROR_BODY: dict[str, str] = {"error": "internal_server_error"}

# Explicit env labels where dev/debug/lab/test surfaces may exist (Phase 8.1.1).
NON_PRODUCTION_SURFACE_ENV_VALUES = frozenset({
    "dev",
    "development",
    "test",
    "ci",
    "staging",
})

logger = logging.getLogger(__name__)


def raw_runtime_env_label() -> str | None:
    """
    Security-surface env label from process environment only (not Pydantic defaults).

    EZA_ENV takes precedence over ENV when both are set.
    Returns None when neither variable is set in the process environment.
    """
    eza = os.getenv("EZA_ENV")
    env = os.getenv("ENV")
    if eza is not None and str(eza).strip():
        return str(eza).strip().lower()
    if env is not None and str(env).strip():
        return str(env).strip().lower()
    return None


def is_explicit_non_production_surface_allowed() -> bool:
    """
    Fail closed unless env is explicitly approved for dev/debug/lab/test tooling.

    Blocked: prod, production, missing, unknown, unrecognized values.
    """
    label = raw_runtime_env_label()
    if not label:
        return False
    return label in NON_PRODUCTION_SURFACE_ENV_VALUES


def is_production_runtime() -> bool:
    """True when ENV/EZA_ENV indicates production (canonical Settings detector)."""
    return is_production_settings(get_settings())


def assert_non_production_surface(*, surface: str = "endpoint") -> None:
    """
    Fail closed unless runtime env explicitly allows non-production surfaces.

    Returns 404 so dev/debug routes are absent from production and unknown env.
    """
    if not is_explicit_non_production_surface_allowed():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


def public_internal_error_content() -> dict[str, str]:
    """Stable JSON body for unhandled 500 responses — no exception text."""
    return dict(PUBLIC_INTERNAL_ERROR_BODY)


def normalize_public_http_error_content(status_code: int, detail: Any) -> dict[str, Any]:
    """
    Map HTTP errors to public response bodies.

    - 4xx: preserve intentional domain detail under ``detail``.
    - 5xx: always canonical generic envelope (no raw exception text).
    """
    if status_code >= 500:
        return public_internal_error_content()
    return {"detail": detail}


def raise_public_internal_server_error(
    exc: BaseException | None = None,
    *,
    log_message: str = "Internal server error",
) -> NoReturn:
    """Log server-side and raise canonical public 500."""
    if exc is not None:
        logger.exception(log_message, exc_info=exc)
    else:
        logger.error(log_message)
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=public_internal_error_content(),
    )


def safe_http_exception_detail(exc: HTTPException) -> Any:
    """Pass through intentional HTTPException detail unchanged."""
    return exc.detail
