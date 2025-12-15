# -*- coding: utf-8 -*-
"""
EZA Proxy - Organization Management
Organization creation, API key management
"""

import logging
import secrets
import hashlib
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.utils.dependencies import get_db
from backend.auth.proxy_auth import require_proxy_auth
from backend.services.production_api_key import (
    create_api_key as db_create_api_key,
    validate_api_key as db_validate_api_key,
    list_api_keys as db_list_api_keys
)
from backend.services.production_org import get_organization as db_get_organization

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory stores removed - all data now in PostgreSQL database


class CreateOrgRequest(BaseModel):
    name: str


class CreateOrgResponse(BaseModel):
    ok: bool
    org_id: str
    name: str
    message: str


class CreateApiKeyRequest(BaseModel):
    name: str  # Friendly name for the API key


class ApiKeyInfo(BaseModel):
    key_id: str
    name: str
    masked_key: str  # e.g., "ezak_****1234"
    created_at: str
    last_used: Optional[str] = None


class ApiKeyListResponse(BaseModel):
    ok: bool
    api_keys: List[ApiKeyInfo]


@router.post("/create", response_model=CreateOrgResponse)
async def create_organization(
    request: CreateOrgRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth)
):
    """
    Create a new organization (DEPRECATED - use /api/platform/organizations)
    Only admins can create organizations
    """
    from backend.services.production_org import create_organization as db_create_organization
    
    user_role = current_user.get("role", "")
    if user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create organizations"
        )
    
    user_id = current_user.get("user_id") or current_user.get("sub")
    user_id_str = str(user_id) if user_id else None
    
    # Create organization in database
    org = await db_create_organization(
        db=db,
        name=request.name,
        plan="free",
        base_currency="TRY",
        proxy_access=True,
        created_by_user_id=user_id_str
    )
    
    logger.info(f"[Org] Created organization: {request.name} (ID: {org.id})")
    
    return CreateOrgResponse(
        ok=True,
        org_id=str(org.id),
        name=org.name,
        message=f"Organization '{org.name}' created successfully"
    )


@router.post("/{org_id}/api-key/create", response_model=Dict[str, Any])
async def create_api_key(
    org_id: str,
    request: CreateApiKeyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth)
):
    """
    Create API key for organization
    
    Uses database-backed storage.
    """
    user_role = current_user.get("role", "")
    user_id = current_user.get("user_id") or current_user.get("sub")
    user_id_str = str(user_id) if user_id else None
    
    if user_role not in ["admin", "reviewer", "org_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins, reviewers, and org_admins can create API keys"
        )
    
    # Verify organization exists in database
    org = await db_get_organization(db, org_id)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    if org.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Organization is {org.status}"
        )
    
    # Create API key in database
    try:
        result = await db_create_api_key(
            db=db,
            org_id=org_id,
            name=request.name,
            user_id=user_id_str
        )
        logger.info(f"[Org] Created API key for org {org_id}: {request.name}")
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{org_id}/api-keys", response_model=ApiKeyListResponse)
async def list_api_keys(
    org_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth)
):
    """
    List all API keys for an organization (database-backed)
    """
    user_role = current_user.get("role", "")
    if user_role not in ["admin", "reviewer", "auditor", "org_admin"]:
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
    
    # Get API keys from database
    keys = await db_list_api_keys(db, org_id)
    
    org_keys = [
        ApiKeyInfo(
            key_id=key["key_id"],
            name=key["name"],
            masked_key=key["masked_key"],
            created_at=key["created_at"],
            last_used=key["last_used"]
        )
        for key in keys
    ]
    
    return ApiKeyListResponse(ok=True, api_keys=org_keys)


@router.delete("/api-key/{key_id}")
async def delete_api_key(
    key_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth)
):
    """
    Revoke an API key (database-backed)
    """
    from backend.services.production_api_key import revoke_api_key as db_revoke_api_key
    
    user_role = current_user.get("role", "")
    if user_role not in ["admin", "reviewer", "org_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins, reviewers, and org_admins can revoke API keys"
        )
    
    # Revoke key in database
    success = await db_revoke_api_key(db, key_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    logger.info(f"[Org] Revoked API key: {key_id}")
    
    return {
        "ok": True,
        "message": "API key revoked successfully"
    }


# Helper function to validate API key and get org_id (async, database-backed)
async def validate_api_key_and_get_org(api_key: str, db: Optional[AsyncSession] = None) -> Optional[str]:
    """
    Validate API key and return organization ID (database-backed)
    
    Note: db parameter is optional for backward compatibility.
    If not provided, creates a new session (not recommended for production).
    """
    if db is None:
        from backend.core.utils.dependencies import AsyncSessionLocal
        async_db = AsyncSessionLocal()
        try:
            result = await db_validate_api_key(async_db, api_key)
            return result.get("org_id") if result else None
        finally:
            await async_db.close()
    else:
        result = await db_validate_api_key(db, api_key)
        return result.get("org_id") if result else None

