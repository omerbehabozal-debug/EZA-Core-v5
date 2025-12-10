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

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory store (in production, use database)
organizations: Dict[str, Dict[str, Any]] = {}
api_keys: Dict[str, Dict[str, Any]] = {}  # key -> {org_id, created_at, name, last_used}


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
    Create a new organization
    Only admins can create organizations
    """
    user_role = current_user.get("role", "")
    if user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create organizations"
        )
    
    import uuid
    org_id = str(uuid.uuid4())
    
    organizations[org_id] = {
        "id": org_id,
        "name": request.name,
        "created_at": datetime.utcnow().isoformat(),
        "created_by": current_user.get("user_id"),
    }
    
    logger.info(f"[Org] Created organization: {request.name} (ID: {org_id})")
    
    return CreateOrgResponse(
        ok=True,
        org_id=org_id,
        name=request.name,
        message=f"Organization '{request.name}' created successfully"
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
    """
    user_role = current_user.get("role", "")
    if user_role not in ["admin", "reviewer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and reviewers can create API keys"
        )
    
    if org_id not in organizations:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Generate API key
    key_prefix = "ezak_"
    random_part = secrets.token_urlsafe(32)
    api_key = f"{key_prefix}{random_part}"
    
    # Hash for storage
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    key_id = key_hash[:16]
    
    api_keys[key_hash] = {
        "key_id": key_id,
        "org_id": org_id,
        "name": request.name,
        "key_hash": key_hash,
        "created_at": datetime.utcnow().isoformat(),
        "created_by": current_user.get("user_id"),
        "last_used": None,
    }
    
    logger.info(f"[Org] Created API key for org {org_id}: {request.name}")
    
    return {
        "ok": True,
        "api_key": api_key,  # Only shown once
        "key_id": key_id,
        "name": request.name,
        "message": "API key created. Save it securely - it won't be shown again."
    }


@router.get("/{org_id}/api-keys", response_model=ApiKeyListResponse)
async def list_api_keys(
    org_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth)
):
    """
    List all API keys for an organization
    """
    user_role = current_user.get("role", "")
    if user_role not in ["admin", "reviewer", "auditor"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    org_keys = [
        ApiKeyInfo(
            key_id=key_data["key_id"],
            name=key_data["name"],
            masked_key=f"ezak_****{key_data['key_id'][-4:]}",
            created_at=key_data["created_at"],
            last_used=key_data.get("last_used")
        )
        for key_hash, key_data in api_keys.items()
        if key_data["org_id"] == org_id
    ]
    
    return ApiKeyListResponse(ok=True, api_keys=org_keys)


@router.delete("/api-key/{key_id}")
async def delete_api_key(
    key_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth)
):
    """
    Delete an API key
    """
    user_role = current_user.get("role", "")
    if user_role not in ["admin", "reviewer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and reviewers can delete API keys"
        )
    
    # Find and delete key
    key_to_delete = None
    for key_hash, key_data in api_keys.items():
        if key_data["key_id"] == key_id:
            key_to_delete = key_hash
            break
    
    if not key_to_delete:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    del api_keys[key_to_delete]
    logger.info(f"[Org] Deleted API key: {key_id}")
    
    return {
        "ok": True,
        "message": "API key deleted successfully"
    }


# Helper function to validate API key and get org_id
def validate_api_key_and_get_org(api_key: str) -> Optional[str]:
    """Validate API key and return organization ID"""
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    
    if key_hash in api_keys:
        key_data = api_keys[key_hash]
        # Update last_used
        key_data["last_used"] = datetime.utcnow().isoformat()
        return key_data["org_id"]
    
    return None

