# -*- coding: utf-8 -*-
"""
Policy Service (Corporate)
Handles tenant-specific policy management
"""

from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.models.corporate_policy import CorporatePolicy
import json


async def get_policy(
    db: AsyncSession,
    tenant: str
) -> Optional[CorporatePolicy]:
    """
    Get policy for a tenant
    
    Args:
        db: Database session
        tenant: Tenant identifier
    
    Returns:
        CorporatePolicy object or None
    """
    result = await db.execute(
        select(CorporatePolicy)
        .where(CorporatePolicy.tenant == tenant)
        .where(CorporatePolicy.is_active == "true")
    )
    return result.scalar_one_or_none()


async def update_policy(
    db: AsyncSession,
    tenant: str,
    rules: Dict[str, Any],
    policy_type: str = "default"
) -> CorporatePolicy:
    """
    Update or create policy for a tenant
    
    Args:
        db: Database session
        tenant: Tenant identifier
        rules: Policy rules dictionary
        policy_type: Policy type (default, custom, regulatory)
    
    Returns:
        Created or updated CorporatePolicy object
    """
    # Check if policy exists
    existing = await get_policy(db, tenant)
    
    if existing:
        # Update existing policy
        existing.rules = json.dumps(rules)
        existing.policy_type = policy_type
        await db.commit()
        await db.refresh(existing)
        return existing
    else:
        # Create new policy
        policy = CorporatePolicy(
            tenant=tenant,
            rules=json.dumps(rules),
            policy_type=policy_type,
            is_active="true"
        )
        db.add(policy)
        await db.commit()
        await db.refresh(policy)
        return policy

