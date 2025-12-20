# -*- coding: utf-8 -*-
"""
Production Invitation Service
Enterprise-grade invitation management - SOC2/ISO compliant
"""

import uuid
import secrets
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from backend.models.production import Invitation, Organization, User, OrganizationUser

logger = logging.getLogger(__name__)


def generate_invitation_token() -> str:
    """Generate secure, single-use invitation token"""
    return secrets.token_urlsafe(32)


def get_invitation_expiry_days() -> int:
    """Get invitation expiry period in days (default: 7 days)"""
    return 7


async def create_invitation(
    db: AsyncSession,
    email: str,
    organization_id: str,
    role: str,
    invited_by_user_id: Optional[str] = None
) -> Invitation:
    """
    Create a new invitation (SOC2/ISO compliant)
    - Does NOT create User
    - Does NOT create OrganizationUser
    - Only creates Invitation record
    """
    try:
        org_uuid = uuid.UUID(organization_id)
    except ValueError:
        raise ValueError(f"Invalid organization ID: {organization_id}")
    
    # Normalize email
    normalized_email = email.strip().lower()
    
    # Check if invitation already exists for this email + org (not expired, not accepted)
    existing = await db.execute(
        select(Invitation).where(
            and_(
                Invitation.email == normalized_email,
                Invitation.organization_id == org_uuid,
                Invitation.status == "invited",
                Invitation.expires_at > datetime.utcnow()
            )
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError(f"Active invitation already exists for {normalized_email}")
    
    # Generate secure token
    token = generate_invitation_token()
    
    # Set expiry (7 days from now)
    expires_at = datetime.utcnow() + timedelta(days=get_invitation_expiry_days())
    
    # Convert invited_by_user_id to UUID if provided
    invited_by_uuid = None
    if invited_by_user_id:
        try:
            invited_by_uuid = uuid.UUID(invited_by_user_id)
        except ValueError:
            logger.warning(f"Invalid invited_by_user_id: {invited_by_user_id}")
    
    invitation = Invitation(
        email=normalized_email,
        organization_id=org_uuid,
        role=role,
        token=token,
        expires_at=expires_at,
        status="invited",
        invited_by_user_id=invited_by_uuid
    )
    
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)
    
    logger.info(f"[Invitation] Created invitation for {normalized_email} to org {organization_id} with role {role}")
    
    return invitation


async def get_invitation_by_token(
    db: AsyncSession,
    token: str
) -> Optional[Invitation]:
    """Get invitation by token"""
    result = await db.execute(
        select(Invitation).where(Invitation.token == token)
    )
    return result.scalar_one_or_none()


async def validate_invitation_token(
    db: AsyncSession,
    token: str
) -> tuple[bool, Optional[str], Optional[Invitation]]:
    """
    Validate invitation token
    Returns: (is_valid, error_message, invitation)
    """
    invitation = await get_invitation_by_token(db, token)
    
    if not invitation:
        return False, "Invalid invitation token", None
    
    if invitation.status == "accepted":
        return False, "Invitation has already been accepted", None
    
    if invitation.status == "expired":
        return False, "Invitation has expired", None
    
    if invitation.expires_at < datetime.utcnow():
        # Auto-expire
        invitation.status = "expired"
        await db.commit()
        return False, "Invitation has expired", None
    
    return True, None, invitation


async def accept_invitation(
    db: AsyncSession,
    invitation: Invitation,
    user_id: str
) -> OrganizationUser:
    """
    Accept invitation and create OrganizationUser
    Called after User is created during registration
    """
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise ValueError(f"Invalid user ID: {user_id}")
    
    # Verify email matches
    user_result = await db.execute(
        select(User).where(User.id == user_uuid)
    )
    user = user_result.scalar_one_or_none()
    
    if not user:
        raise ValueError(f"User not found: {user_id}")
    
    # Normalize and compare emails
    from backend.services.production_auth import normalize_email
    if normalize_email(user.email) != normalize_email(invitation.email):
        raise ValueError("User email does not match invitation email")
    
    # Create OrganizationUser
    org_user = OrganizationUser(
        org_id=invitation.organization_id,
        user_id=user_uuid,
        role=invitation.role,
        status="active"  # Always active when created from invitation
    )
    db.add(org_user)
    
    # Mark invitation as accepted
    invitation.status = "accepted"
    invitation.accepted_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(org_user)
    
    logger.info(f"[Invitation] Accepted invitation {invitation.id} by user {user_id}")
    
    return org_user


async def list_organization_invitations(
    db: AsyncSession,
    organization_id: str,
    include_expired: bool = False
) -> list[Dict[str, Any]]:
    """List all invitations for an organization"""
    try:
        org_uuid = uuid.UUID(organization_id)
    except ValueError:
        return []
    
    query = select(Invitation).where(
        Invitation.organization_id == org_uuid
    )
    
    if not include_expired:
        # Only active invitations (not expired, not accepted)
        query = query.where(
            and_(
                Invitation.status == "invited",
                Invitation.expires_at > datetime.utcnow()
            )
        )
    
    result = await db.execute(query.order_by(Invitation.created_at.desc()))
    invitations = result.scalars().all()
    
    return [
        {
            "id": str(inv.id),
            "email": inv.email,
            "role": inv.role,
            "status": inv.status,
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
            "expires_at": inv.expires_at.isoformat() if inv.expires_at else None,
            "accepted_at": inv.accepted_at.isoformat() if inv.accepted_at else None,
            "invited_by_user_id": str(inv.invited_by_user_id) if inv.invited_by_user_id else None,
        }
        for inv in invitations
    ]

