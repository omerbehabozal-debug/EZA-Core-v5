# -*- coding: utf-8 -*-
"""Phase 8.4.1 — production-safe Yansı trust/moderation admin auth.

Separate from ``require_internal()`` (Phase 8.1.2), which remains
non-production-only for /api/internal/*, gateway, proxy, multimodal, etc.

This guard:
- Works in production when a trust admin key is configured
- Accepts credentials only via ``X-Api-Key`` header (never query params)
- Does not accept normal user JWTs as admin authority
- Never logs credential values or prefixes
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import Depends, Header, HTTPException, status

from backend.config import get_settings

logger = logging.getLogger(__name__)


def resolve_yansi_trust_admin_expected_key() -> str:
    """
    Prefer dedicated trust key; fall back to EZA_ADMIN_API_KEY.

    Dedicated key lets ops rotate trust-moderation credentials independently
    of any non-prod internal tooling key usage.
    """
    settings = get_settings()
    dedicated = (getattr(settings, "EZA_YANSI_TRUST_ADMIN_API_KEY", None) or "").strip()
    if dedicated:
        return dedicated
    return (getattr(settings, "EZA_ADMIN_API_KEY", None) or "").strip()


async def validate_yansi_trust_admin_api_key(
    x_api_key: Optional[str] = Header(default=None, alias="X-Api-Key"),
) -> str:
    expected = resolve_yansi_trust_admin_expected_key()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "trust_admin_not_configured",
                "message": "Yansı trust admin access not configured",
            },
        )
    provided = (x_api_key or "").strip()
    if not provided or provided != expected:
        if provided:
            logger.warning("Invalid Yansı trust admin API key")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "trust_admin_unauthorized",
                "message": "Invalid or missing trust admin credentials",
            },
        )
    return provided


def require_yansi_trust_admin_dependency():
    """FastAPI dependency factory for production-safe trust moderation."""

    async def _guard(api_key: str = Depends(validate_yansi_trust_admin_api_key)) -> str:
        return api_key

    return _guard
