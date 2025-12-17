# -*- coding: utf-8 -*-
"""
Production Authentication Service
Bcrypt password hashing and JWT token management
"""

import bcrypt
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import jwt

from backend.config import get_settings
from backend.models.production import User, Organization, OrganizationUser
from backend.auth.jwt import create_jwt

logger = logging.getLogger(__name__)


def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


async def create_user(
    db: AsyncSession,
    email: str,
    password: str,
    role: str = "user"
) -> User:
    """Create a new user"""
    # Check if user already exists
    result = await db.execute(select(User).where(User.email == email))
    existing = result.scalar_one_or_none()
    if existing:
        raise ValueError(f"User with email {email} already exists")
    
    # Create user
    user = User(
        email=email,
        password_hash=hash_password(password),
        role=role
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    logger.info(f"Created user: {email} with role {role}")
    return user


async def authenticate_user(
    db: AsyncSession,
    email: str,
    password: str
) -> Optional[User]:
    """Authenticate user by email and password"""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    
    if not user:
        return None
    
    if not verify_password(password, user.password_hash):
        return None
    
    return user


async def get_user_by_id(db: AsyncSession, user_id: str) -> Optional[User]:
    """Get user by UUID"""
    import uuid
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        return None
    
    result = await db.execute(select(User).where(User.id == user_uuid))
    return result.scalar_one_or_none()


async def reset_user_password(
    db: AsyncSession,
    email: str,
    new_password: str
) -> bool:
    """Reset user password by email"""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    
    if not user:
        return False
    
    # Update password hash
    user.password_hash = hash_password(new_password)
    await db.commit()
    await db.refresh(user)
    
    logger.info(f"Password reset for user: {email}")
    return True


async def check_bootstrap_allowed(db: AsyncSession) -> bool:
    """Check if bootstrap is allowed (no users or orgs exist)"""
    # Check if any users exist
    result = await db.execute(select(User).limit(1))
    has_users = result.scalar_one_or_none() is not None
    
    # Check if any organizations exist
    result = await db.execute(select(Organization).limit(1))
    has_orgs = result.scalar_one_or_none() is not None
    
    # Bootstrap allowed only if no users AND no orgs
    return not has_users and not has_orgs


def create_access_token(user: User, expires_in_hours: int = 8) -> str:
    """Create JWT access token for user"""
    settings = get_settings()
    jwt_secret = getattr(settings, "EZA_JWT_SECRET", None) or settings.JWT_SECRET
    
    expire = datetime.utcnow() + timedelta(hours=expires_in_hours)
    
    payload = {
        "sub": str(user.id),  # UUID as string
        "user_id": str(user.id),
        "role": user.role,
        "email": user.email,
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access"
    }
    
    encoded_jwt = jwt.encode(
        payload,
        jwt_secret,
        algorithm="HS256"
    )
    
    logger.debug(f"JWT token created for user {user.id} with role {user.role}")
    return encoded_jwt

