# -*- coding: utf-8 -*-
"""
Authentication Service
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta
from backend.models.user import LegacyUser as User
from backend.models.role import Role
from backend.core.utils.security import verify_password, create_access_token, get_password_hash
from backend.core.schemas.auth import LoginRequest, TokenResponse


async def authenticate_user(
    db: AsyncSession,
    email: str,
    password: str
) -> User | None:
    """Authenticate a user by email and password"""
    result = await db.execute(
        select(User).join(Role).where(User.email == email)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        return None
    
    if not verify_password(password, user.hashed_password):
        return None
    
    if not user.is_active:
        return None
    
    return user


async def create_token_response(user: User) -> TokenResponse:
    """Create a token response for authenticated user"""
    from datetime import timedelta
    
    access_token_expires = timedelta(minutes=30)
    access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role.name},
        expires_delta=access_token_expires
    )
    
    return TokenResponse(
        access_token=access_token,
        role=user.role.name,
        expires_in=1800  # 30 minutes in seconds
    )

