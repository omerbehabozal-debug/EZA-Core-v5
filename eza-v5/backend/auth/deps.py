# -*- coding: utf-8 -*-
"""
Authentication Dependencies
FastAPI dependencies for JWT authentication and role-based access control
"""

from typing import Literal, Optional
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from backend.core.utils.dependencies import get_db
from backend.auth.jwt import decode_jwt, get_user_from_token
from backend.auth.models import UserRole

logger = logging.getLogger(__name__)

# HTTP Bearer token security
security = HTTPBearer(auto_error=False)  # auto_error=False allows optional auth


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get current authenticated user from JWT token
    
    Args:
        credentials: HTTP Bearer credentials (optional)
        db: Database session
    
    Returns:
        Dict with user_id and role
    
    Raises:
        HTTPException 401 if authentication fails
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    token = credentials.credentials
    user_info = get_user_from_token(token)
    
    if user_info is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    return user_info


def require_role(allowed_roles: list[UserRole]) -> callable:
    """
    Dependency factory for role-based access control
    
    Args:
        allowed_roles: List of allowed roles
    
    Returns:
        FastAPI dependency function
    """
    async def role_checker(
        current_user: dict = Depends(get_current_user)
    ) -> dict:
        user_role = current_user.get("role")
        
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {allowed_roles}"
            )
        
        return current_user
    
    return role_checker


# Convenience functions for common role requirements
def require_admin():
    """Require admin role"""
    return require_role(["admin"])


def require_corporate_or_admin():
    """Require corporate or admin role"""
    return require_role(["corporate", "admin"])


def require_regulator_or_admin():
    """Require regulator or admin role"""
    return require_role(["regulator", "admin"])

