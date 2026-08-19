# -*- coding: utf-8 -*-
"""Phase 8.1.2 — internal API access (explicit non-prod env + admin API key)."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import Depends, Header, HTTPException, status

from backend.config import get_settings
from backend.security.production_surface import assert_non_production_surface

logger = logging.getLogger(__name__)


async def validate_internal_api_key(
    x_api_key: Optional[str] = Header(default=None, alias="X-Api-Key"),
) -> str:
    """
    Internal tooling guard:

    1. Fail closed unless runtime env is explicitly dev/test/ci/staging (404).
    2. Require configured EZA_ADMIN_API_KEY via X-Api-Key header (401).

    No query-param keys, no dev-key placeholder, no JWT substitution.
    """
    assert_non_production_surface(surface="internal-api")
    settings = get_settings()
    expected = (getattr(settings, "EZA_ADMIN_API_KEY", None) or "").strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Internal API access not configured",
        )
    provided = (x_api_key or "").strip()
    if not provided or provided != expected:
        if provided:
            logger.warning("Invalid internal API key attempt (prefix=%s)", provided[:8])
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
    return provided


def require_internal_dependency():
    """FastAPI dependency factory matching legacy ``Depends(require_internal())`` usage."""

    async def _guard(api_key: str = Depends(validate_internal_api_key)) -> str:
        return api_key

    return _guard
