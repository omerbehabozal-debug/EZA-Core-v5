# -*- coding: utf-8 -*-
"""
JWT Authentication
JWT token creation and validation
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Literal
from jose import JWTError, jwt
import logging

from backend.config import get_settings
from backend.auth.models import UserRole

logger = logging.getLogger(__name__)


def create_jwt(
    user_id: int,
    role: UserRole,
    expires_in_hours: int = 8
) -> str:
    """
    Create a JWT token for a user
    
    Args:
        user_id: User ID
        role: User role (admin, corporate, regulator)
        expires_in_hours: Token expiration in hours (default: 8)
    
    Returns:
        JWT token string
    """
    settings = get_settings()
    
    # Get JWT secret from env (EZA_JWT_SECRET) or fallback to JWT_SECRET
    jwt_secret = getattr(settings, "EZA_JWT_SECRET", None) or settings.JWT_SECRET
    
    # Calculate expiration
    expire = datetime.utcnow() + timedelta(hours=expires_in_hours)
    
    # Create payload
    payload = {
        "sub": str(user_id),  # Subject (user ID)
        "role": role,
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access"
    }
    
    # Encode token
    encoded_jwt = jwt.encode(
        payload,
        jwt_secret,
        algorithm="HS256"
    )
    
    logger.debug(f"JWT token created for user {user_id} with role {role}")
    
    return encoded_jwt


def decode_jwt(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode and verify a JWT token
    
    Args:
        token: JWT token string
    
    Returns:
        Decoded payload dict or None if invalid
    """
    settings = get_settings()
    
    # Get JWT secret from env (EZA_JWT_SECRET) or fallback to JWT_SECRET
    jwt_secret = getattr(settings, "EZA_JWT_SECRET", None) or settings.JWT_SECRET
    
    try:
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"]
        )
        return payload
    except JWTError as e:
        logger.warning(f"JWT decode failed: {str(e)}")
        return None


def get_user_from_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Extract user information from JWT token
    
    Args:
        token: JWT token string
    
    Returns:
        Dict with user_id (UUID string) and role, or None if invalid
    """
    payload = decode_jwt(token)
    if payload is None:
        return None
    
    user_id = payload.get("sub") or payload.get("user_id")
    role = payload.get("role")
    
    if not user_id or not role:
        return None
    
    # Return UUID as string (no conversion to int)
    return {
        "user_id": str(user_id),
        "sub": str(user_id),  # Alias for compatibility
        "role": role,
        "email": payload.get("email")  # Optional
    }

