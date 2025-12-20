# -*- coding: utf-8 -*-
"""
Platform Organizations Router
Production CRUD endpoints for organizations
"""

import logging
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from backend.core.utils.dependencies import get_db
from backend.auth.proxy_auth import require_proxy_auth
from backend.auth.bootstrap import require_bootstrap_auth
from backend.services.production_org import (
    create_organization as db_create_organization,
    get_organization as db_get_organization,
    list_organizations as db_list_organizations,
    update_organization as db_update_organization,
    archive_organization as db_archive_organization,
    list_organization_users as db_list_organization_users
)
from backend.services.production_auth import get_user_by_id

router = APIRouter()
logger = logging.getLogger(__name__)


class CreateOrganizationRequest(BaseModel):
    name: str
    plan: str = "free"  # free | pro | enterprise
    base_currency: str = "TRY"  # TRY | USD
    proxy_access: bool = True
    sla_tier: Optional[str] = None
    default_policy_set: Optional[str] = None


class OrganizationResponse(BaseModel):
    id: str
    name: str
    plan: str
    status: str
    proxy_access: bool
    base_currency: str
    sla_tier: Optional[str] = None
    default_policy_set: Optional[str] = None
    created_at: str


class OrganizationListResponse(BaseModel):
    ok: bool
    organizations: List[OrganizationResponse]


class UpdateOrganizationRequest(BaseModel):
    name: Optional[str] = None
    plan: Optional[str] = None
    base_currency: Optional[str] = None
    proxy_access: Optional[bool] = None
    sla_tier: Optional[str] = None
    default_policy_set: Optional[str] = None


@router.post("/organizations", response_model=Dict[str, Any])
async def create_organization(
    request: CreateOrganizationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_bootstrap_auth)
):
    """
    Create a new organization
    
    Development mode: Only requires X-Api-Key (EZA_ADMIN_API_KEY or "dev-key")
    Production mode: Requires both JWT (admin role) + X-Api-Key
    
    This endpoint allows platform bootstrap before any users exist.
    """
    user_role = current_user.get("role", "")
    user_id = current_user.get("user_id") or current_user.get("sub")
    is_bootstrap = current_user.get("bootstrap_mode", False)
    
    # In production, verify admin role (already checked in require_bootstrap_auth)
    if not is_bootstrap and user_role not in ["admin", "org_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin and org_admin roles can create organizations"
        )
    
    # Validate plan
    if request.plan not in ["free", "pro", "enterprise"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Plan must be one of: free, pro, enterprise"
        )
    
    # Validate currency
    if request.base_currency not in ["TRY", "USD"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Base currency must be TRY or USD"
        )
    
    # Create organization in database
    created_by_user_id = None if is_bootstrap else user_id
    
    org = await db_create_organization(
        db=db,
        name=request.name,
        plan=request.plan,
        base_currency=request.base_currency,
        proxy_access=request.proxy_access,
        sla_tier=request.sla_tier,
        default_policy_set=request.default_policy_set,
        created_by_user_id=created_by_user_id
    )
    
    # Log audit event
    await _log_audit_db(
        db=db,
        action="ORG_CREATED",
        user_id=user_id if not is_bootstrap else None,
        org_id=str(org.id),
        metadata={"name": request.name, "plan": request.plan, "bootstrap_mode": is_bootstrap}
    )
    
    logger.info(f"[Org] Created organization: {request.name} (ID: {org.id}) by {'bootstrap' if is_bootstrap else f'user {user_id}'}")
    
    return {
        "ok": True,
        "organization": OrganizationResponse(
            id=str(org.id),
            name=org.name,
            plan=org.plan,
            status=org.status,
            proxy_access=org.proxy_access,
            base_currency=org.base_currency,
            sla_tier=org.sla_tier,
            default_policy_set=org.default_policy_set,
            created_at=org.created_at.isoformat()
        )
    }


@router.get("/organizations", response_model=OrganizationListResponse)
async def list_organizations(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth),
    proxy_access_only: bool = False
):
    """
    List organizations that the user is a member of
    
    Args:
        proxy_access_only: If True, only return organizations with proxy_access=True
    """
    user_id = current_user.get("user_id") or current_user.get("sub")
    user_role = current_user.get("role", "")
    
    # Convert user_id to string if needed
    user_id_str = str(user_id) if user_id else None
    
    # Get organizations from database
    orgs = await db_list_organizations(
        db=db,
        user_id=user_id_str,
        user_role=user_role,
        proxy_access_only=proxy_access_only
    )
    
    org_list = [
        OrganizationResponse(
            id=str(org.id),
            name=org.name,
            plan=org.plan,
            status=org.status,
            proxy_access=org.proxy_access,
            base_currency=org.base_currency,
            sla_tier=org.sla_tier,
            default_policy_set=org.default_policy_set,
            created_at=org.created_at.isoformat()
        )
        for org in orgs
    ]
    
    return OrganizationListResponse(
        ok=True,
        organizations=org_list
    )


@router.get("/proxy/organizations", response_model=OrganizationListResponse)
async def list_proxy_organizations(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth)
):
    """
    List organizations with proxy_access=True that the user is a member of
    This endpoint is specifically for Proxy UI (proxy.ezacore.ai)
    """
    user_id = current_user.get("user_id") or current_user.get("sub")
    user_role = current_user.get("role", "")
    
    # Convert user_id to string if needed
    user_id_str = str(user_id) if user_id else None
    
    # Get organizations with proxy_access=True only
    orgs = await db_list_organizations(
        db=db,
        user_id=user_id_str,
        user_role=user_role,
        proxy_access_only=True
    )
    
    org_list = [
        OrganizationResponse(
            id=str(org.id),
            name=org.name,
            plan=org.plan,
            status=org.status,
            proxy_access=org.proxy_access,
            base_currency=org.base_currency,
            sla_tier=org.sla_tier,
            default_policy_set=org.default_policy_set,
            created_at=org.created_at.isoformat()
        )
        for org in orgs
    ]
    
    return OrganizationListResponse(
        ok=True,
        organizations=org_list
    )


@router.patch("/organizations/{org_id}", response_model=Dict[str, Any])
async def update_organization(
    org_id: str,
    request: UpdateOrganizationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth)
):
    """
    Update organization
    Only admin can update organizations
    """
    from backend.services.production_org import check_user_organization_membership
    
    user_role = current_user.get("role", "")
    user_id = current_user.get("user_id") or current_user.get("sub")
    user_id_str = str(user_id) if user_id else None
    
    if user_role not in ["admin", "org_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin and org_admin roles can update organizations"
        )
    
    # Check organization exists
    org = await db_get_organization(db, org_id)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Check if user is member (for org_admin)
    if user_role == "org_admin" and user_id_str:
        is_member = await check_user_organization_membership(db, user_id_str, org_id)
        if not is_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of this organization"
            )
    
    # Build updates dict
    updates = {}
    if request.name is not None:
        updates["name"] = request.name
    if request.plan is not None:
        if request.plan not in ["free", "pro", "enterprise"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Plan must be one of: free, pro, enterprise"
            )
        updates["plan"] = request.plan
    if request.base_currency is not None:
        if request.base_currency not in ["TRY", "USD"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Base currency must be TRY or USD"
            )
        updates["base_currency"] = request.base_currency
    if request.proxy_access is not None:
        updates["proxy_access"] = request.proxy_access
    if request.sla_tier is not None:
        updates["sla_tier"] = request.sla_tier
    if request.default_policy_set is not None:
        updates["default_policy_set"] = request.default_policy_set
    
    # Update in database
    updated_org = await db_update_organization(db, org_id, updates)
    if not updated_org:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update organization"
        )
    
    # Log audit event
    await _log_audit_db(
        db=db,
        action="ORG_UPDATED",
        user_id=user_id_str,
        org_id=org_id,
        metadata=updates
    )
    
    logger.info(f"[Org] Updated organization {org_id} by user {user_id}: {updates}")
    
    return {
        "ok": True,
        "organization": OrganizationResponse(
            id=str(updated_org.id),
            name=updated_org.name,
            plan=updated_org.plan,
            status=updated_org.status,
            proxy_access=updated_org.proxy_access,
            base_currency=updated_org.base_currency,
            sla_tier=updated_org.sla_tier,
            default_policy_set=updated_org.default_policy_set,
            created_at=updated_org.created_at.isoformat()
        )
    }


@router.delete("/organizations/{org_id}", response_model=Dict[str, Any])
async def delete_organization(
    org_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth)
):
    """
    Soft delete (archive) organization
    Only admin can delete organizations
    """
    user_role = current_user.get("role", "")
    user_id = current_user.get("user_id") or current_user.get("sub")
    user_id_str = str(user_id) if user_id else None
    
    if user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin role can delete organizations"
        )
    
    # Check organization exists
    org = await db_get_organization(db, org_id)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Archive organization
    success = await db_archive_organization(db, org_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to archive organization"
        )
    
    # Log audit event
    await _log_audit_db(
        db=db,
        action="ORG_ARCHIVED",
        user_id=user_id_str,
        org_id=org_id,
        metadata={"name": org.name}
    )
    
    logger.info(f"[Org] Archived organization {org_id} by user {user_id}")
    
    return {
        "ok": True,
        "message": "Organization archived successfully"
    }


@router.get("/organizations/{org_id}/users", response_model=Dict[str, Any])
async def list_org_users(
    org_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth)
):
    """
    List all users in an organization
    """
    user_role = current_user.get("role", "")
    if user_role not in ["admin", "org_admin", "ops"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    # Verify organization exists
    org = await db_get_organization(db, org_id)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Get users and invitations from database
    result = await db_list_organization_users(db, org_id)
    
    return {
        "ok": True,
        "users": result.get("users", []),
        "invitations": result.get("invitations", [])
    }


class InviteUserRequest(BaseModel):
    email: str
    role: str  # org_admin, user, ops


@router.post("/organizations/{org_id}/users/invite", response_model=Dict[str, Any])
async def invite_user(
    org_id: str,
    request: InviteUserRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth)
):
    """
    Invite a user to an organization (Enterprise/SOC2/ISO compliant)
    
    - DOES NOT create User
    - DOES NOT create OrganizationUser
    - ONLY creates Invitation record
    - Returns invitation link with secure token
    """
    user_role = current_user.get("role", "")
    if user_role not in ["admin", "org_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can invite users"
        )
    
    # Verify organization exists
    org = await db_get_organization(db, org_id)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    from backend.services.production_invitation import create_invitation
    
    try:
        invited_by_user_id = current_user.get("user_id") or current_user.get("sub")
        
        invitation = await create_invitation(
            db=db,
            email=request.email,
            organization_id=org_id,
            role=request.role,
            invited_by_user_id=str(invited_by_user_id) if invited_by_user_id else None
        )
        
        # Generate invitation link (frontend will construct full URL)
        invitation_link = f"/platform/register?token={invitation.token}"
        
        # Log audit
        await _log_audit_db(
            db=db,
            action="USER_INVITED",
            user_id=str(invited_by_user_id) if invited_by_user_id else None,
            org_id=org_id,
            metadata={
                "invited_email": invitation.email,
                "role": invitation.role,
                "invitation_id": str(invitation.id),
                "expires_at": invitation.expires_at.isoformat() if invitation.expires_at else None
            }
        )
        
        logger.info(f"[Invite] Created invitation for {invitation.email} to org {org_id} with role {invitation.role}")
        
        return {
            "ok": True,
            "message": f"Invitation created for {invitation.email}",
            "invitation_id": str(invitation.id),
            "email": invitation.email,
            "role": invitation.role,
            "token": invitation.token,  # For email service integration
            "invitation_link": invitation_link,
            "expires_at": invitation.expires_at.isoformat() if invitation.expires_at else None
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


async def _log_audit_db(
    db: AsyncSession,
    action: str,
    user_id: Optional[str],
    org_id: str,
    metadata: Dict[str, Any]
):
    """Log audit event to database"""
    try:
        from backend.models.production import AuditLog
        
        # Safely convert org_id and user_id to UUID (skip if invalid format)
        org_uuid = None
        if org_id:
            try:
                org_uuid = uuid.UUID(org_id)
            except (ValueError, TypeError):
                # Legacy string IDs are not UUIDs - store in context instead
                if isinstance(metadata, dict):
                    metadata["org_id_legacy"] = org_id
                pass
        
        user_uuid = None
        if user_id:
            try:
                user_uuid = uuid.UUID(user_id)
            except (ValueError, TypeError):
                if isinstance(metadata, dict):
                    metadata["user_id_legacy"] = user_id
                pass
        
        # Create AuditLog without triggering relationship resolution
        # Use direct table insert to avoid User model conflict
        from sqlalchemy import insert
        
        # Insert directly to avoid relationship resolution issues
        stmt = insert(AuditLog).values(
            org_id=org_uuid,
            user_id=user_uuid,
            action=action,
            context=metadata
        )
        await db.execute(stmt)
        await db.commit()
        logger.info(f"[Audit] {action}: user={user_id}, org={org_id}")
    except Exception as e:
        logger.error(f"[Audit] Failed to log {action}: {e}")
        await db.rollback()

