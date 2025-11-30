# -*- coding: utf-8 -*-
"""
FastAPI Dependencies
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime
import redis.asyncio as redis

# Config import - load_dotenv() is called ONLY in config.py
from backend.config import get_settings

# Get settings (config.py already loaded .env)
settings = get_settings()

# Database - Get from settings (config.py loads .env)
DATABASE_URL = settings.DATABASE_URL
engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

# Redis - Get from settings
REDIS_URL = settings.REDIS_URL or "redis://localhost:6379"
redis_client: Optional[redis.Redis] = None

# Security
security = HTTPBearer()


async def get_db() -> AsyncSession:
    """Database session dependency"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Initialize database tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def init_redis():
    """Initialize Redis connection"""
    global redis_client
    redis_client = await redis.from_url(REDIS_URL, decode_responses=True)


async def get_redis():
    """Redis client dependency"""
    if redis_client is None:
        await init_redis()
    return redis_client


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Get current authenticated user from JWT token"""
    from backend.core.utils.security import decode_access_token
    from backend.models.user import User
    from backend.models.role import Role
    
    token = credentials.credentials
    payload = decode_access_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )
    
    result = await db.execute(
        select(User).join(Role).where(User.id == int(user_id))
    )
    user = result.scalar_one_or_none()
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive"
        )
    
    return user


def require_role(allowed_roles: List[str]):
    """Dependency factory for role-based access control"""
    async def role_checker(current_user = Depends(get_current_user)):
        if current_user.role.name not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {allowed_roles}"
            )
        return current_user
    return role_checker


def require_internal():
    """Require EZA internal or admin role"""
    # TEMPORARY: Authentication disabled for development
    # TODO: Re-enable authentication when ready
    async def no_auth():
        return None
    return no_auth
    # ORIGINAL CODE - DISABLED
    # return require_role(["eza_internal", "admin"])


def require_institution_auditor():
    """Require institution auditor or admin role"""
    # TEMPORARY: Authentication disabled for development
    # TODO: Re-enable authentication when ready
    async def no_auth():
        return None
    return no_auth
    # ORIGINAL CODE - DISABLED
    # return require_role(["institution_auditor", "admin"])


async def get_api_key_user(
    api_key: str,
    db: AsyncSession = Depends(get_db)
):
    """Get user from API key (for B2B corporate clients)"""
    from backend.models.api_key import APIKey
    from backend.models.user import User
    from backend.core.utils.security import hash_api_key
    
    # Hash the provided key and search
    # In production, store hashed keys and compare
    hashed_key = hash_api_key(api_key)
    result = await db.execute(
        select(APIKey).where(APIKey.key_hash == hashed_key)
    )
    api_key_obj = result.scalar_one_or_none()
    
    if api_key_obj is None or not api_key_obj.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    
    # Check expiration
    if api_key_obj.expires_at and api_key_obj.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key expired"
        )
    
    # Update last used
    api_key_obj.last_used_at = datetime.utcnow()
    await db.commit()
    
    # Get user
    result = await db.execute(select(User).where(User.id == api_key_obj.user_id))
    user = result.scalar_one_or_none()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    return user


# Vector DB initialization placeholder
async def init_vector_db():
    """Initialize vector database (Weaviate/Qdrant)"""
    # Will be implemented with actual vector DB client
    pass
