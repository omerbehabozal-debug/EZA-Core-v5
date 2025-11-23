# -*- coding: utf-8 -*-
"""
API Key Service (Platform)
Handles API key generation and management
"""

from typing import List, Optional, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.models.api_key import APIKey
from backend.core.utils.security import hash_api_key
from datetime import datetime, timedelta
import secrets
import string


async def generate_api_key(
    db: AsyncSession,
    user_id: int,
    name: str,
    institution_id: Optional[int] = None,
    application_id: Optional[int] = None,
    expires_days: Optional[int] = None
) -> Dict[str, str]:
    """
    Generate a new API key
    
    Args:
        db: Database session
        user_id: User ID who owns the key
        name: Key name/description
        institution_id: Optional institution ID
        application_id: Optional application ID
        expires_days: Optional expiration in days
    
    Returns:
        Dictionary with 'key' (plain text) and 'api_key' (database object)
    """
    # Generate secure random key
    alphabet = string.ascii_letters + string.digits
    key = "eza_" + ''.join(secrets.choice(alphabet) for _ in range(32))
    
    # Hash the key for storage
    key_hash = hash_api_key(key)
    
    # Calculate expiration
    expires_at = None
    if expires_days:
        expires_at = datetime.utcnow() + timedelta(days=expires_days)
    
    # Create API key record
    api_key = APIKey(
        key_hash=key_hash,
        name=name,
        user_id=user_id,
        institution_id=institution_id,
        application_id=application_id,
        is_active=True,
        expires_at=expires_at
    )
    
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    
    return {
        "key": key,  # Return plain text key only once
        "api_key": api_key
    }


async def revoke_api_key(
    db: AsyncSession,
    api_key_id: int
) -> bool:
    """
    Revoke an API key
    
    Args:
        db: Database session
        api_key_id: API key ID to revoke
    
    Returns:
        True if successful
    """
    result = await db.execute(select(APIKey).where(APIKey.id == api_key_id))
    api_key = result.scalar_one_or_none()
    
    if not api_key:
        return False
    
    api_key.is_active = False
    api_key.revoked_at = datetime.utcnow()
    
    await db.commit()
    return True


async def list_api_keys(
    db: AsyncSession,
    user_id: Optional[int] = None,
    institution_id: Optional[int] = None
) -> List[APIKey]:
    """
    List API keys with optional filtering
    
    Args:
        db: Database session
        user_id: Filter by user ID
        institution_id: Filter by institution ID
    
    Returns:
        List of APIKey objects
    """
    query = select(APIKey)
    
    if user_id:
        query = query.where(APIKey.user_id == user_id)
    
    if institution_id:
        query = query.where(APIKey.institution_id == institution_id)
    
    query = query.where(APIKey.is_active == True)
    
    result = await db.execute(query)
    return list(result.scalars().all())

