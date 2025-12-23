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

# Normalize DATABASE_URL to use asyncpg driver
# Railway and other providers often give postgresql:// but we need postgresql+asyncpg://
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
# If already has +asyncpg, keep it as is

# Configure engine with pool settings to prevent connection issues
engine = create_async_engine(
    DATABASE_URL, 
    echo=True,
    pool_pre_ping=True,  # Verify connections before using
    pool_recycle=3600,   # Recycle connections after 1 hour
    pool_size=10,        # Maximum number of connections in pool
    max_overflow=20      # Maximum overflow connections
)
AsyncSessionLocal = async_sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False,
    autoflush=False,     # Don't autoflush (we'll commit explicitly)
    autocommit=False     # Don't autocommit
)
Base = declarative_base()

# Redis - Get from settings
REDIS_URL = settings.REDIS_URL or "redis://localhost:6379"
redis_client: Optional[redis.Redis] = None

# Security
security = HTTPBearer()


async def get_db() -> AsyncSession:
    """
    Database session dependency
    
    Note: Commit should be done explicitly in endpoints.
    This dependency only provides the session and handles cleanup.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            # Rollback on any exception
            await session.rollback()
            raise
        finally:
            # Close session (this will also close the connection)
            # Don't commit here - endpoints should commit explicitly
            await session.close()


async def init_db():
    """Initialize database tables (including production models)"""
    import logging
    from sqlalchemy import text
    
    # Import all models to ensure they are registered with SQLAlchemy
    from backend.models.production import (
        User, Organization, OrganizationUser, ApiKey, 
        AuditLog, TelemetryEvent, AlertEvent, Invitation,
        IntentLog, ImpactEvent
    )
    # Import legacy models to ensure they are registered
    from backend.models.user import LegacyUser
    from backend.models.role import Role
    from backend.models.institution import Institution
    from backend.models.api_key import APIKey
    from backend.models.application import Application
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # Add missing soft delete columns if they don't exist (migration helper)
        # This ensures backward compatibility with existing databases
        try:
            # Check and add columns for production_intent_logs - using separate queries for safety
            # Check if deleted_by_user column exists
            check_result = await conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'production_intent_logs' 
                AND column_name = 'deleted_by_user'
            """))
            if not check_result.scalar_one_or_none():
                await conn.execute(text("""
                    ALTER TABLE production_intent_logs 
                    ADD COLUMN deleted_by_user BOOLEAN NOT NULL DEFAULT false
                """))
                await conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_production_intent_logs_deleted_by_user 
                    ON production_intent_logs(deleted_by_user)
                """))
            
            # Check if deleted_at column exists
            check_result = await conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'production_intent_logs' 
                AND column_name = 'deleted_at'
            """))
            if not check_result.scalar_one_or_none():
                await conn.execute(text("""
                    ALTER TABLE production_intent_logs 
                    ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE
                """))
            
            # Check if deleted_by_user_id column exists
            check_result = await conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'production_intent_logs' 
                AND column_name = 'deleted_by_user_id'
            """))
            if not check_result.scalar_one_or_none():
                await conn.execute(text("""
                    ALTER TABLE production_intent_logs 
                    ADD COLUMN deleted_by_user_id UUID
                """))
                # Check if foreign key constraint exists
                fk_check = await conn.execute(text("""
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'fk_intent_logs_deleted_by_user'
                """))
                if not fk_check.scalar_one_or_none():
                    await conn.execute(text("""
                        ALTER TABLE production_intent_logs
                        ADD CONSTRAINT fk_intent_logs_deleted_by_user
                        FOREIGN KEY (deleted_by_user_id) 
                        REFERENCES production_users(id) 
                        ON DELETE SET NULL
                    """))
            
            # Check and add columns for production_impact_events
            check_result = await conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'production_impact_events' 
                AND column_name = 'deleted_by_user'
            """))
            if not check_result.scalar_one_or_none():
                await conn.execute(text("""
                    ALTER TABLE production_impact_events 
                    ADD COLUMN deleted_by_user BOOLEAN NOT NULL DEFAULT false
                """))
                await conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_production_impact_events_deleted_by_user 
                    ON production_impact_events(deleted_by_user)
                """))
            
            check_result = await conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'production_impact_events' 
                AND column_name = 'deleted_at'
            """))
            if not check_result.scalar_one_or_none():
                await conn.execute(text("""
                    ALTER TABLE production_impact_events 
                    ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE
                """))
            
            check_result = await conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'production_impact_events' 
                AND column_name = 'deleted_by_user_id'
            """))
            if not check_result.scalar_one_or_none():
                await conn.execute(text("""
                    ALTER TABLE production_impact_events 
                    ADD COLUMN deleted_by_user_id UUID
                """))
                # Check if foreign key constraint exists
                fk_check = await conn.execute(text("""
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'fk_impact_events_deleted_by_user'
                """))
                if not fk_check.scalar_one_or_none():
                    await conn.execute(text("""
                        ALTER TABLE production_impact_events
                        ADD CONSTRAINT fk_impact_events_deleted_by_user
                        FOREIGN KEY (deleted_by_user_id) 
                        REFERENCES production_users(id) 
                        ON DELETE SET NULL
                    """))
            
            logging.info("Soft delete columns checked/added successfully")
        except Exception as e:
            logging.warning(f"Could not add soft delete columns (may already exist): {e}")
    
    # Log production mode status
    settings = get_settings()
    env_value = settings.EZA_ENV if settings.EZA_ENV else settings.ENV
    logger = logging.getLogger(__name__)
    
    # Always log production mode (database is persistent)
    logger.info("=" * 60)
    logger.info("EZA running in PRODUCTION MODE with persistent DB")
    logger.info(f"Database: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else 'configured'}")
    logger.info("=" * 60)


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
    from backend.models.user import LegacyUser as User
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
    from backend.models.user import LegacyUser as User
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
