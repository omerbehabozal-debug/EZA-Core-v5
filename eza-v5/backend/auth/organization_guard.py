# -*- coding: utf-8 -*-
"""
Organization Guard Middleware
Enforces organization-level access control for all protected endpoints
"""

from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from backend.auth.jwt import get_user_from_token
from backend.core.utils.dependencies import get_db
from backend.routers.organization import organizations

logger = logging.getLogger(__name__)

security = HTTPBearer()


async def require_organization_access(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_org_id: Optional[str] = Header(None, alias="x-org-id"),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Organization-level access guard
    
    Rules:
    1. x-org-id header is REQUIRED
    2. User must be a member of the organization
    3. Organization must exist and be active
    
    Returns:
        Dict with user info and validated org_id
    """
    # 1. Require x-org-id header
    if not x_org_id:
        logger.warning(f"[OrgGuard] Missing x-org-id header")
        await _log_access_denied(
            user_id=None,
            org_id=None,
            endpoint="unknown",
            reason="Missing x-org-id header"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="x-org-id header is required"
        )
    
    # 2. Validate organization exists
    if x_org_id not in organizations:
        logger.warning(f"[OrgGuard] Organization not found: {x_org_id}")
        await _log_access_denied(
            user_id=None,
            org_id=x_org_id,
            endpoint="unknown",
            reason="Organization not found"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization not found"
        )
    
    org = organizations[x_org_id]
    
    # 3. Check organization status
    if org.get("status") != "active":
        logger.warning(f"[OrgGuard] Organization not active: {x_org_id} (status: {org.get('status')})")
        await _log_access_denied(
            user_id=None,
            org_id=x_org_id,
            endpoint="unknown",
            reason=f"Organization status: {org.get('status')}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Organization is {org.get('status')}"
        )
    
    # 4. Require JWT token
    if not credentials:
        logger.warning(f"[OrgGuard] Missing JWT token for org {x_org_id}")
        await _log_access_denied(
            user_id=None,
            org_id=x_org_id,
            endpoint="unknown",
            reason="Missing JWT token"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="JWT token required (Authorization header)"
        )
    
    # 5. Get user from token
    token = credentials.credentials
    user_info = get_user_from_token(token)
    
    if user_info is None:
        logger.warning(f"[OrgGuard] Invalid token for org {x_org_id}")
        await _log_access_denied(
            user_id=None,
            org_id=x_org_id,
            endpoint="unknown",
            reason="Invalid or expired token"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    user_id = user_info.get("user_id") or user_info.get("sub")
    
    # 6. Check user membership (in production, check database)
    # For now, allow if user is admin or org_admin
    user_role = user_info.get("role", "")
    is_admin = user_role in ["admin", "org_admin"]
    
    # TODO: In production, check organization_users table
    # For now, allow admin/org_admin roles
    if not is_admin:
        # Check if user is member of organization
        # This should query organization_users table in production
        logger.warning(f"[OrgGuard] User {user_id} not member of org {x_org_id}")
        await _log_access_denied(
            user_id=user_id,
            org_id=x_org_id,
            endpoint="unknown",
            reason="User not member of organization"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a member of this organization"
        )
    
    logger.info(f"[OrgGuard] Access granted: user {user_id} -> org {x_org_id}")
    
    return {
        **user_info,
        "org_id": x_org_id,
        "organization": org,
    }


async def _log_access_denied(
    user_id: Optional[str],
    org_id: Optional[str],
    endpoint: str,
    reason: str
):
    """
    Log access denied event to audit log
    """
    try:
        from backend.routers.proxy_audit import audit_store
        
        audit_entry = {
            "action": "ORG_ACCESS_DENIED",
            "user_id": user_id,
            "org_id": org_id,
            "endpoint": endpoint,
            "reason": reason,
            "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
        }
        
        # Store in audit log
        audit_store.append(audit_entry)
        logger.warning(f"[Audit] {audit_entry}")
    except Exception as e:
        logger.error(f"[Audit] Failed to log access denied: {e}")

