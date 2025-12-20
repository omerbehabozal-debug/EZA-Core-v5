# -*- coding: utf-8 -*-
"""
Production Organization Service
Database-backed organization management
"""

import uuid
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from backend.models.production import Organization, OrganizationUser, User
from sqlalchemy.orm import joinedload

logger = logging.getLogger(__name__)


async def create_organization(
    db: AsyncSession,
    name: str,
    plan: str = "free",
    base_currency: str = "TRY",
    proxy_access: bool = True,
    sla_tier: Optional[str] = None,
    default_policy_set: Optional[str] = None,
    created_by_user_id: Optional[str] = None
) -> Organization:
    """Create a new organization"""
    org = Organization(
        name=name,
        plan=plan,
        status="active",
        base_currency=base_currency,
        proxy_access=proxy_access,
        sla_tier=sla_tier,
        default_policy_set=default_policy_set
    )
    db.add(org)
    await db.commit()
    await db.refresh(org)
    
    # If created_by_user_id provided, add user as org_admin
    if created_by_user_id:
        try:
            user_uuid = uuid.UUID(created_by_user_id)
            org_user = OrganizationUser(
                org_id=org.id,
                user_id=user_uuid,
                role="org_admin",
                status="active"
            )
            db.add(org_user)
            await db.commit()
        except (ValueError, Exception) as e:
            logger.warning(f"Failed to add creator as org_admin: {e}")
    
    logger.info(f"Created organization: {name} (ID: {org.id})")
    return org


async def get_organization(db: AsyncSession, org_id: str) -> Optional[Organization]:
    """Get organization by UUID"""
    try:
        org_uuid = uuid.UUID(org_id)
    except ValueError:
        return None
    
    result = await db.execute(select(Organization).where(Organization.id == org_uuid))
    return result.scalar_one_or_none()


async def list_organizations(
    db: AsyncSession,
    user_id: Optional[str] = None,
    user_role: Optional[str] = None
) -> List[Organization]:
    """List organizations (all for admin, filtered for regular users)"""
    if user_role == "admin":
        # Admin sees all active organizations
        result = await db.execute(
            select(Organization).where(Organization.status == "active")
        )
        return list(result.scalars().all())
    elif user_id:
        # Regular users see only their organizations
        try:
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            return []
        
        result = await db.execute(
            select(Organization)
            .join(OrganizationUser)
            .where(
                and_(
                    OrganizationUser.user_id == user_uuid,
                    OrganizationUser.status == "active",
                    Organization.status == "active"
                )
            )
        )
        return list(result.scalars().all())
    else:
        return []


async def check_user_organization_membership(
    db: AsyncSession,
    user_id: str,
    org_id: str
) -> bool:
    """Check if user is a member of organization"""
    try:
        user_uuid = uuid.UUID(user_id)
        org_uuid = uuid.UUID(org_id)
    except ValueError:
        return False
    
    result = await db.execute(
        select(OrganizationUser).where(
            and_(
                OrganizationUser.user_id == user_uuid,
                OrganizationUser.org_id == org_uuid,
                OrganizationUser.status == "active"
            )
        )
    )
    return result.scalar_one_or_none() is not None


async def update_organization(
    db: AsyncSession,
    org_id: str,
    updates: Dict[str, Any]
) -> Optional[Organization]:
    """Update organization fields"""
    org = await get_organization(db, org_id)
    if not org:
        return None
    
    # Update allowed fields
    allowed_fields = ["name", "plan", "base_currency", "proxy_access", "sla_tier", "default_policy_set", "status"]
    for field, value in updates.items():
        if field in allowed_fields and hasattr(org, field):
            setattr(org, field, value)
    
    org.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(org)
    
    logger.info(f"Updated organization {org_id}: {updates}")
    return org


async def archive_organization(db: AsyncSession, org_id: str) -> bool:
    """Soft delete (archive) organization"""
    org = await get_organization(db, org_id)
    if not org:
        return False
    
    org.status = "archived"
    org.updated_at = datetime.utcnow()
    await db.commit()
    
    logger.info(f"Archived organization {org_id}")
    return True


async def list_organization_users(
    db: AsyncSession,
    org_id: str
) -> Dict[str, Any]:
    """
    List all users and pending invitations in an organization
    Returns: {
        "users": [active OrganizationUser records],
        "invitations": [pending Invitation records]
    }
    """
    try:
        org_uuid = uuid.UUID(org_id)
    except ValueError:
        return {"users": [], "invitations": []}
    
    # Query active OrganizationUser records (only "active" status, no "invited")
    result = await db.execute(
        select(OrganizationUser, User)
        .join(User, OrganizationUser.user_id == User.id)
        .where(
            and_(
                OrganizationUser.org_id == org_uuid,
                OrganizationUser.status == "active"  # Only active users
            )
        )
        .order_by(OrganizationUser.joined_at.desc())
    )
    
    users = []
    for row in result.all():
        org_user, user = row
        users.append({
            "id": str(user.id),
            "email": user.email,
            "role": org_user.role,  # org_admin, user, ops
            "joined_at": org_user.joined_at.isoformat() if org_user.joined_at else None,
            "status": "active"  # Always active for OrganizationUser
        })
    
    # Query pending invitations
    from backend.services.production_invitation import list_organization_invitations
    invitations = await list_organization_invitations(db, org_id, include_expired=False)
    
    return {
        "users": users,
        "invitations": invitations
    }
