# -*- coding: utf-8 -*-
"""
EZA Proxy - Corporate Authentication
JWT + API Key required for corporate access
"""

from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from backend.auth.deps import get_current_user
from backend.auth.api_key import validate_api_key
from backend.core.utils.dependencies import get_db

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)  # Don't auto-raise on missing token (for bootstrap in dev mode)


async def require_proxy_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    api_key: Optional[str] = Header(None, alias="X-Api-Key"),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Require both JWT token AND API key for Proxy access
    Corporate users must have both
    
    Returns:
        Dict with user info and company_id
    """
    # Require API key (optional in development)
    from backend.config import get_settings
    settings = get_settings()
    # Check ENV (with EZA_ENV override) and DEBUG flag
    env_value = settings.EZA_ENV if settings.EZA_ENV else settings.ENV
    # More aggressive development mode check
    is_dev = (
        env_value.lower() in ["dev", "development", "local", "test"] 
        or settings.DEBUG 
        or "localhost" in str(env_value).lower()
    )
    
    # Log for debugging
    if not api_key:
        logger.info(f"[ProxyAuth] No API key provided. ENV={env_value}, DEBUG={settings.DEBUG}, is_dev={is_dev}")
        if is_dev:
            logger.info("[ProxyAuth] Development mode detected - API key check bypassed")
    
    if not api_key and not is_dev:
        logger.warning(f"[ProxyAuth] API key required but not provided. ENV={env_value}, DEBUG={settings.DEBUG}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required (X-Api-Key header). In development mode, API key is optional."
        )
    
    # Check if it's an organization API key (ezak_ prefix)
    org_id_from_key = None
    if api_key and api_key.startswith("ezak_"):
        from backend.services.production_api_key import validate_api_key as db_validate_api_key
        result = await db_validate_api_key(db, api_key)
        if result:
            org_id_from_key = result.get("org_id")
        if not org_id_from_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid organization API key"
            )
    elif api_key:
        # Validate admin API key
        try:
            validated_key = validate_api_key(api_key)
        except HTTPException:
            raise
    
    # Require JWT token (optional in development mode or with valid admin API key for bootstrap)
    if not credentials:
        # Check if we have a valid admin API key (allows bootstrap operations)
        admin_api_key = getattr(settings, "EZA_ADMIN_API_KEY", None)
        is_valid_admin_key = (
            (is_dev and (api_key == "dev-key" or (admin_api_key and api_key == admin_api_key))) or
            (not is_dev and admin_api_key and api_key == admin_api_key)
        )
        
        if is_valid_admin_key:
            # Allow bootstrap operations with valid admin API key (dev or prod)
            logger.info(f"[ProxyAuth] Bootstrap mode: Valid admin API key provided, using bootstrap context (ENV={env_value})")
            return {
                "user_id": "bootstrap",
                "role": "admin",
                "sub": "bootstrap",
                "bootstrap_mode": True,
                "api_key": api_key if (api_key and not api_key.startswith("ezak_")) else ("org_key" if api_key else None),
                "company_id": org_id_from_key,
                "org_id": org_id_from_key,
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="JWT token required (Authorization header) or valid admin API key for bootstrap"
            )
    
    # Get user from JWT token directly
    from backend.auth.jwt import get_user_from_token
    token = credentials.credentials
    user_info = get_user_from_token(token)
    
    if user_info is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    # Check role - support both Proxy and Platform roles
    user_role = user_info.get("role", "")
    
    # Proxy roles (operational desk)
    proxy_roles = ["admin", "reviewer", "auditor", "readonly", "proxy_user"]
    
    # Platform roles (control plane)
    platform_roles = ["admin", "org_admin", "ops", "finance", "auditor"]
    
    # Legacy roles for backward compatibility
    legacy_roles = ["corp_user", "dev", "corporate", "regulator"]
    
    # Allow if role is in any of the allowed role sets
    if user_role not in proxy_roles and user_role not in platform_roles and user_role not in legacy_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Allowed roles: {', '.join(set(proxy_roles + platform_roles + legacy_roles))}"
        )
    
    return {
        **user_info,
        "api_key": api_key if (api_key and not api_key.startswith("ezak_")) else ("org_key" if api_key else None),
        "company_id": org_id_from_key or user_info.get("company_id"),  # From API key or JWT
        "org_id": org_id_from_key or user_info.get("org_id"),  # Alias for org_id
    }

