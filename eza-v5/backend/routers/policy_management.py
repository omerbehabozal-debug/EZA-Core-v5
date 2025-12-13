# -*- coding: utf-8 -*-
"""
EZA Proxy - Policy Management
Custom policy packs per organization
"""

import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.utils.dependencies import get_db
from backend.auth.proxy_auth import require_proxy_auth

router = APIRouter()
logger = logging.getLogger(__name__)

# Global default policies
GLOBAL_POLICIES = {
    "TRT": {
        "id": "TRT",
        "name": "RTÜK Kuralları",
        "description": "Tarafsızlık, doğruluk, çeşitlilik",
        "categories": ["media", "broadcast"],
        "enabled": True,
        "weight": 1.0,
        "is_global": True,
    },
    "FINTECH": {
        "id": "FINTECH",
        "name": "Fintech Kuralları",
        "description": "Yatırım tavsiyesi yasağı, risk uyarıları",
        "categories": ["finance"],
        "enabled": True,
        "weight": 1.0,
        "is_global": True,
    },
    "HEALTH": {
        "id": "HEALTH",
        "name": "Sağlık Kuralları",
        "description": "Tıbbi iddia yasağı, bilimsel kanıt gerekliliği",
        "categories": ["health"],
        "enabled": True,
        "weight": 1.0,
        "is_global": True,
    },
}

# Organization-specific policy overrides
org_policies: Dict[str, Dict[str, Dict[str, Any]]] = {}  # org_id -> policy_id -> policy_data


class PolicyInfo(BaseModel):
    id: str
    name: str
    description: str
    categories: List[str]
    enabled: bool
    weight: float
    is_global: bool
    is_custom: bool = False


class PolicyListResponse(BaseModel):
    ok: bool
    policies: List[PolicyInfo]
    global_policies: List[PolicyInfo]
    custom_policies: List[PolicyInfo]


class AddPolicyRequest(BaseModel):
    name: str
    description: str
    categories: List[str]
    enabled: bool = True
    weight: float = 1.0


class UpdatePolicyRequest(BaseModel):
    enabled: Optional[bool] = None
    weight: Optional[float] = None


@router.get("/list", response_model=PolicyListResponse)
async def list_global_policies(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth)
):
    """
    List all global default policies
    """
    policies = [
        PolicyInfo(**policy_data)
        for policy_data in GLOBAL_POLICIES.values()
    ]
    
    return PolicyListResponse(
        ok=True,
        policies=policies,
        global_policies=policies,
        custom_policies=[]
    )


@router.get("/org/{org_id}/policy", response_model=PolicyListResponse)
async def list_org_policies(
    org_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth)
):
    """
    List policies for an organization (global + custom)
    """
    user_role = current_user.get("role", "")
    if user_role not in ["admin", "reviewer", "auditor", "readonly"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    # Get global policies
    global_policies = [
        PolicyInfo(**policy_data)
        for policy_data in GLOBAL_POLICIES.values()
    ]
    
    # Get custom policies for this org
    custom_policies_data = org_policies.get(org_id, {})
    custom_policies = [
        PolicyInfo(**policy_data, is_custom=True)
        for policy_data in custom_policies_data.values()
    ]
    
    # Merge: custom overrides global if exists
    all_policies = []
    policy_ids_seen = set()
    
    # Add custom policies first
    for custom in custom_policies:
        all_policies.append(custom)
        policy_ids_seen.add(custom.id)
    
    # Add global policies that aren't overridden
    for global_policy in global_policies:
        if global_policy.id not in policy_ids_seen:
            # Check if org has override
            if org_id in org_policies and global_policy.id in org_policies[org_id]:
                override = org_policies[org_id][global_policy.id]
                all_policies.append(PolicyInfo(
                    **GLOBAL_POLICIES[global_policy.id],
                    enabled=override.get("enabled", global_policy.enabled),
                    weight=override.get("weight", global_policy.weight),
                    is_custom=False
                ))
            else:
                all_policies.append(global_policy)
            policy_ids_seen.add(global_policy.id)
    
    return PolicyListResponse(
        ok=True,
        policies=all_policies,
        global_policies=global_policies,
        custom_policies=custom_policies
    )


@router.post("/org/{org_id}/policy/add")
async def add_custom_policy(
    org_id: str,
    request: AddPolicyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth)
):
    """
    Add custom policy for organization
    Only admins can add policies
    """
    user_role = current_user.get("role", "")
    if user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can add custom policies"
        )
    
    import uuid
    policy_id = f"CUSTOM_{uuid.uuid4().hex[:8].upper()}"
    
    if org_id not in org_policies:
        org_policies[org_id] = {}
    
    org_policies[org_id][policy_id] = {
        "id": policy_id,
        "name": request.name,
        "description": request.description,
        "categories": request.categories,
        "enabled": request.enabled,
        "weight": request.weight,
        "is_global": False,
        "created_at": datetime.utcnow().isoformat(),
    }
    
    logger.info(f"[Policy] Added custom policy {policy_id} for org {org_id}")
    
    return {
        "ok": True,
        "policy_id": policy_id,
        "message": f"Custom policy '{request.name}' added"
    }


@router.patch("/org/{org_id}/policy/{policy_id}/weight")
async def update_policy_weight(
    org_id: str,
    policy_id: str,
    request: UpdatePolicyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth)
):
    """
    Update policy weight (severity multiplier)
    Only admins can modify weights
    """
    user_role = current_user.get("role", "")
    if user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can modify policy weights"
        )
    
    if request.weight is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="weight is required"
        )
    
    # Check if global policy
    if policy_id in GLOBAL_POLICIES:
        # Create org override
        if org_id not in org_policies:
            org_policies[org_id] = {}
        if policy_id not in org_policies[org_id]:
            org_policies[org_id][policy_id] = {}
        org_policies[org_id][policy_id]["weight"] = request.weight
    elif org_id in org_policies and policy_id in org_policies[org_id]:
        # Update custom policy
        org_policies[org_id][policy_id]["weight"] = request.weight
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Policy not found"
        )
    
    return {
        "ok": True,
        "message": f"Policy weight updated to {request.weight}"
    }


@router.patch("/org/{org_id}/policy/{policy_id}/enable")
async def toggle_policy(
    org_id: str,
    policy_id: str,
    request: UpdatePolicyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth)
):
    """
    Enable/disable policy for organization
    Only admins can toggle policies
    """
    user_role = current_user.get("role", "")
    if user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can toggle policies"
        )
    
    if request.enabled is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="enabled is required"
        )
    
    # Check if global policy
    if policy_id in GLOBAL_POLICIES:
        # Create org override
        if org_id not in org_policies:
            org_policies[org_id] = {}
        if policy_id not in org_policies[org_id]:
            org_policies[org_id][policy_id] = {}
        org_policies[org_id][policy_id]["enabled"] = request.enabled
    elif org_id in org_policies and policy_id in org_policies[org_id]:
        # Update custom policy
        org_policies[org_id][policy_id]["enabled"] = request.enabled
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Policy not found"
        )
    
    return {
        "ok": True,
        "enabled": request.enabled,
        "message": f"Policy {'enabled' if request.enabled else 'disabled'}"
    }


@router.delete("/org/{org_id}/policy/{policy_id}")
async def delete_custom_policy(
    org_id: str,
    policy_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth)
):
    """
    Delete custom policy (cannot delete global policies)
    Only admins can delete policies
    """
    user_role = current_user.get("role", "")
    if user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete policies"
        )
    
    # Cannot delete global policies
    if policy_id in GLOBAL_POLICIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete global policies"
        )
    
    if org_id not in org_policies or policy_id not in org_policies[org_id]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Custom policy not found"
        )
    
    del org_policies[org_id][policy_id]
    
    return {
        "ok": True,
        "message": "Custom policy deleted"
    }


# Helper function to get enabled policies for org
def get_enabled_policies_for_org(org_id: str) -> List[str]:
    """Get list of enabled policy IDs for an organization"""
    enabled = []
    
    # Check global policies
    for policy_id, policy_data in GLOBAL_POLICIES.items():
        # Check if org has override
        if org_id in org_policies and policy_id in org_policies[org_id]:
            if org_policies[org_id][policy_id].get("enabled", True):
                enabled.append(policy_id)
        elif policy_data.get("enabled", True):
            enabled.append(policy_id)
    
    # Add custom policies
    if org_id in org_policies:
        for policy_id, policy_data in org_policies[org_id].items():
            if policy_id.startswith("CUSTOM_") and policy_data.get("enabled", True):
                enabled.append(policy_id)
    
    return enabled

