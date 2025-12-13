# -*- coding: utf-8 -*-
"""
API Key Authentication
API key validation for admin-only internal APIs
"""

from fastapi import Depends, HTTPException, status, Header
from typing import Optional
import logging

from backend.config import get_settings

logger = logging.getLogger(__name__)


def validate_api_key(x_api_key: Optional[str] = Header(None, alias="X-Api-Key")) -> str:
    """
    Validate API key from X-Api-Key header
    
    Args:
        x_api_key: API key from header
    
    Returns:
        API key string if valid
    
    Raises:
        HTTPException 401 if API key is missing or invalid
    """
    settings = get_settings()
    
    # Get admin API key from env (EZA_ADMIN_API_KEY)
    admin_api_key = getattr(settings, "EZA_ADMIN_API_KEY", None)
    
    if not admin_api_key:
        # In dev mode, allow if no key is configured
        if settings.ENV == "dev":
            logger.warning("EZA_ADMIN_API_KEY not configured, allowing in dev mode")
            return "dev-key"
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="API key validation not configured"
            )
    
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required (X-Api-Key header)"
        )
    
    if x_api_key != admin_api_key:
        logger.warning(f"Invalid API key attempt from {x_api_key[:10]}...")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    
    return x_api_key


def require_api_key():
    """
    FastAPI dependency for API key authentication
    
    Returns:
        Dependency function
    """
    return Depends(validate_api_key)

