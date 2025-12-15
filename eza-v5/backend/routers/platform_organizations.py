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

from backend.core.utils.dependencies import get_db
from backend.auth.proxy_auth import require_proxy_auth
from backend.auth.bootstrap import require_bootstrap_auth
from backend.routers.organization import organizations

router = APIRouter()
logger = logging.getLogger(__name__)

# Import organization_users store from middleware
from backend.middleware.organization_guard import get_organization_users_store
organization_users_store = get_organization_users_store()


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
    
    # Generate organization ID
    org_id = str(uuid.uuid4())
    
    # Create organization
    org_data = {
        "id": org_id,
        "name": request.name,
        "plan": request.plan,
        "status": "active",
        "proxy_access": request.proxy_access,
        "base_currency": request.base_currency,
        "sla_tier": request.sla_tier,
        "default_policy_set": request.default_policy_set,
        "created_at": datetime.utcnow().isoformat(),
        "created_by": user_id,
    }
    
    organizations[org_id] = org_data
    
    # Add creator as admin to organization_users (skip if bootstrap mode)
    if not is_bootstrap:
        if org_id not in organization_users_store:
            organization_users_store[org_id] = {}
        
        organization_users_store[org_id][user_id] = {
            "role": "org_admin",
            "status": "active",
            "joined_at": datetime.utcnow().isoformat(),
        }
    
    # Log audit event
    await _log_audit(
        action="ORG_CREATED",
        user_id=user_id if not is_bootstrap else "bootstrap",
        org_id=org_id,
        metadata={"name": request.name, "plan": request.plan, "bootstrap_mode": is_bootstrap}
    )
    
    logger.info(f"[Org] Created organization: {request.name} (ID: {org_id}) by {'bootstrap' if is_bootstrap else f'user {user_id}'}")
    
    return {
        "ok": True,
        "organization": OrganizationResponse(**org_data)
    }


@router.get("/organizations", response_model=OrganizationListResponse)
async def list_organizations(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth)
):
    """
    List organizations that the user is a member of
    """
    user_id = current_user.get("user_id") or current_user.get("sub")
    user_role = current_user.get("role", "")
    
    # Admin can see all organizations
    if user_role in ["admin"]:
        org_list = [
            OrganizationResponse(**org)
            for org in organizations.values()
            if org.get("status") != "archived"
        ]
    else:
        # Regular users see only organizations they're members of
        user_orgs = []
        for org_id, users in organization_users_store.items():
            if user_id in users:
                if org_id in organizations:
                    org = organizations[org_id]
                    if org.get("status") != "archived":
                        user_orgs.append(OrganizationResponse(**org))
        
        org_list = user_orgs
    
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
    user_role = current_user.get("role", "")
    user_id = current_user.get("user_id") or current_user.get("sub")
    
    if user_role not in ["admin", "org_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin and org_admin roles can update organizations"
        )
    
    if org_id not in organizations:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    org = organizations[org_id]
    
    # Check if user is member (for org_admin)
    if user_role == "org_admin":
        if org_id not in organization_users_store:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of this organization"
            )
        
        if user_id not in organization_users_store[org_id]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of this organization"
            )
    
    # Update fields
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
    
    # Apply updates
    org.update(updates)
    organizations[org_id] = org
    
    # Log audit event
    await _log_audit(
        action="ORG_UPDATED",
        user_id=user_id,
        org_id=org_id,
        metadata=updates
    )
    
    logger.info(f"[Org] Updated organization {org_id} by user {user_id}: {updates}")
    
    return {
        "ok": True,
        "organization": OrganizationResponse(**org)
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
    
    if user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin role can delete organizations"
        )
    
    if org_id not in organizations:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    org = organizations[org_id]
    
    # Soft delete: set status to archived
    org["status"] = "archived"
    organizations[org_id] = org
    
    # Log audit event
    await _log_audit(
        action="ORG_ARCHIVED",
        user_id=user_id,
        org_id=org_id,
        metadata={"name": org.get("name")}
    )
    
    logger.info(f"[Org] Archived organization {org_id} by user {user_id}")
    
    return {
        "ok": True,
        "message": "Organization archived successfully"
    }


async def _log_audit(action: str, user_id: str, org_id: str, metadata: Dict[str, Any]):
    """Log audit event"""
    try:
        from backend.routers.proxy_audit import audit_store
        
        audit_entry = {
            "action": action,
            "user_id": user_id,
            "org_id": org_id,
            "metadata": metadata,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        audit_store.append(audit_entry)
        logger.info(f"[Audit] {action}: user={user_id}, org={org_id}")
    except Exception as e:
        logger.error(f"[Audit] Failed to log {action}: {e}")

