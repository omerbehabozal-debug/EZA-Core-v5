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

security = HTTPBearer()


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
    # Require API key
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required (X-Api-Key header)"
        )
    
    # Check if it's an organization API key (ezak_ prefix)
    org_id_from_key = None
    if api_key.startswith("ezak_"):
        from backend.routers.organization import validate_api_key_and_get_org
        org_id_from_key = validate_api_key_and_get_org(api_key)
        if not org_id_from_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid organization API key"
            )
    else:
        # Validate admin API key
        try:
            validated_key = validate_api_key(api_key)
        except HTTPException:
            raise
    
    # Require JWT token
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="JWT token required (Authorization header)"
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
    
    # Check role (admin, reviewer, auditor, readonly)
    user_role = user_info.get("role", "")
    if user_role not in ["admin", "reviewer", "auditor", "readonly"]:
        # Allow legacy roles for backward compatibility
        if user_role not in ["corp_user", "dev", "admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Corporate access required. Roles: admin, reviewer, auditor, readonly"
            )
    
    return {
        **user_info,
        "api_key": api_key if not api_key.startswith("ezak_") else "org_key",
        "company_id": org_id_from_key or user_info.get("company_id"),  # From API key or JWT
        "org_id": org_id_from_key or user_info.get("org_id"),  # Alias for org_id
    }

