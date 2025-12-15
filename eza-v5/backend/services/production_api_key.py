# -*- coding: utf-8 -*-
"""
Production API Key Service
Database-backed API key management
"""

import secrets
import hashlib
import uuid
import logging
from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from backend.models.production import ApiKey, Organization

logger = logging.getLogger(__name__)


def generate_api_key() -> str:
    """Generate a new organization API key (ezak_ prefix)"""
    key_prefix = "ezak_"
    random_part = secrets.token_urlsafe(32)
    return f"{key_prefix}{random_part}"


def hash_api_key(api_key: str) -> str:
    """Hash API key for storage"""
    return hashlib.sha256(api_key.encode()).hexdigest()


async def create_api_key(
    db: AsyncSession,
    org_id: str,
    name: str,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    """Create a new API key for organization"""
    # Verify organization exists
    try:
        org_uuid = uuid.UUID(org_id)
    except ValueError:
        raise ValueError("Invalid organization ID")
    
    result = await db.execute(select(Organization).where(Organization.id == org_uuid))
    org = result.scalar_one_or_none()
    if not org:
        raise ValueError("Organization not found")
    
    if org.status != "active":
        raise ValueError(f"Organization is {org.status}")
    
    # Generate API key
    api_key = generate_api_key()
    key_hash = hash_api_key(api_key)
    
    # Create API key record
    user_uuid = None
    if user_id:
        try:
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            pass
    
    api_key_obj = ApiKey(
        org_id=org_uuid,
        user_id=user_uuid,
        name=name,
        key_hash=key_hash,
        revoked=False
    )
    db.add(api_key_obj)
    await db.commit()
    await db.refresh(api_key_obj)
    
    logger.info(f"Created API key for org {org_id}: {name}")
    
    return {
        "ok": True,
        "api_key": api_key,  # Only shown once!
        "key_id": str(api_key_obj.id),
        "name": name,
        "message": "API key created. Save it securely - it won't be shown again."
    }


async def validate_api_key(db: AsyncSession, api_key: str) -> Optional[Dict[str, Any]]:
    """Validate API key and return organization info"""
    if not api_key.startswith("ezak_"):
        return None
    
    key_hash = hash_api_key(api_key)
    
    result = await db.execute(
        select(ApiKey).where(
            and_(
                ApiKey.key_hash == key_hash,
                ApiKey.revoked == False
            )
        )
    )
    api_key_obj = result.scalar_one_or_none()
    
    if not api_key_obj:
        return None
    
    # Update last used
    api_key_obj.last_used_at = datetime.utcnow()
    await db.commit()
    
    # Get organization
    org = await db.get(Organization, api_key_obj.org_id)
    if not org or org.status != "active":
        return None
    
    return {
        "org_id": str(org.id),
        "org_name": org.name,
        "api_key_id": str(api_key_obj.id)
    }


async def list_api_keys(
    db: AsyncSession,
    org_id: str
) -> List[Dict[str, Any]]:
    """List API keys for organization"""
    try:
        org_uuid = uuid.UUID(org_id)
    except ValueError:
        return []
    
    result = await db.execute(
        select(ApiKey).where(
            and_(
                ApiKey.org_id == org_uuid,
                ApiKey.revoked == False
            )
        )
    )
    keys = result.scalars().all()
    
    return [
        {
            "key_id": str(key.id),
            "name": key.name,
            "masked_key": f"ezak_{'*' * 20}{str(key.id)[:8]}",
            "created_at": key.created_at.isoformat() if key.created_at else None,
            "last_used": key.last_used_at.isoformat() if key.last_used_at else None
        }
        for key in keys
    ]


async def revoke_api_key(db: AsyncSession, key_id: str) -> bool:
    """Revoke an API key"""
    try:
        key_uuid = uuid.UUID(key_id)
    except ValueError:
        return False
    
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_uuid))
    api_key_obj = result.scalar_one_or_none()
    
    if not api_key_obj:
        return False
    
    api_key_obj.revoked = True
    api_key_obj.revoked_at = datetime.utcnow()
    await db.commit()
    
    logger.info(f"Revoked API key {key_id}")
    return True

