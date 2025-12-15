# -*- coding: utf-8 -*-
"""
Bootstrap Authentication
Allows platform bootstrap before any users exist
"""

from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from backend.config import get_settings
from backend.core.utils.dependencies import get_db

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)  # Don't auto-raise on missing token


async def require_bootstrap_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    api_key: Optional[str] = Header(None, alias="X-Api-Key"),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Bootstrap-friendly authentication for organization creation
    
    Development mode (ENV == "dev"):
    - Skip JWT authentication entirely
    - Accept X-Api-Key == "dev-key" OR EZA_ADMIN_API_KEY
    - Return bootstrap auth context:
      {
        user_id: "bootstrap",
        role: "admin",
        bootstrap_mode: true
      }
    
    Production mode:
    - Require BOTH:
      - Valid JWT with role "admin" or "org_admin"
      - X-Api-Key == EZA_ADMIN_API_KEY
    - Reject otherwise
    """
    settings = get_settings()
    env_value = settings.EZA_ENV if settings.EZA_ENV else settings.ENV
    is_dev = env_value.lower() in ["dev", "development", "local", "test"]
    
    # Validate API key (required in both dev and prod)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required (X-Api-Key header)"
        )
    
    # Get admin API key from settings
    admin_api_key = getattr(settings, "EZA_ADMIN_API_KEY", None)
    
    if is_dev:
        # Dev mode: Accept EZA_ADMIN_API_KEY or "dev-key"
        if api_key != "dev-key" and (admin_api_key and api_key != admin_api_key):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key. In dev mode, use EZA_ADMIN_API_KEY or 'dev-key'"
            )
        logger.info("[BootstrapAuth] Dev mode: API key validated, skipping JWT")
        # Return bootstrap user info (no JWT required)
        return {
            "user_id": "bootstrap",
            "role": "admin",
            "sub": "bootstrap",
            "bootstrap_mode": True
        }
    else:
        # Production mode: Require both API key AND JWT
        if not admin_api_key or api_key != admin_api_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid admin API key"
            )
        
        # Require JWT token
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="JWT token required (Authorization header) in production mode"
            )
        
        # Get user from JWT token
        from backend.auth.jwt import get_user_from_token
        token = credentials.credentials
        user_info = get_user_from_token(token)
        
        if user_info is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        # Check admin role
        user_role = user_info.get("role", "")
        if user_role not in ["admin", "org_admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin and org_admin roles can create organizations in production"
            )
        
        logger.info(f"[BootstrapAuth] Production mode: API key + JWT validated for user {user_info.get('user_id')}")
        return user_info

