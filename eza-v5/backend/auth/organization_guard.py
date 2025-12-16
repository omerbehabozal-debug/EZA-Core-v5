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
from backend.services.production_org import get_organization as db_get_organization, check_user_organization_membership as db_check_membership

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
    
    # 2. Validate organization exists (database)
    org = await db_get_organization(db, x_org_id)
    if not org:
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
    
    # 3. Check organization status
    if org.status != "active":
        logger.warning(f"[OrgGuard] Organization not active: {x_org_id} (status: {org.status})")
        await _log_access_denied(
            user_id=None,
            org_id=x_org_id,
            endpoint="unknown",
            reason=f"Organization status: {org.status}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Organization is {org.status}"
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
    user_id_str = str(user_id) if user_id else None
    
    # 6. Check user membership (database)
    user_role = user_info.get("role", "")
    is_admin = user_role in ["admin", "org_admin"]
    
    # Check if user is member of organization (unless admin)
    if not is_admin and user_id_str:
        is_member = await db_check_membership(db, user_id_str, x_org_id)
        if not is_member:
            logger.warning(f"[OrgGuard] User {user_id} not member of org {x_org_id}")
            await _log_access_denied(
                user_id=user_id_str,
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
        "organization": {
            "id": str(org.id),
            "name": org.name,
            "status": org.status,
            "plan": org.plan
        },
    }


async def _log_access_denied(
    user_id: Optional[str],
    org_id: Optional[str],
    endpoint: str,
    reason: str
):
    """
    Log access denied event to audit log (database)
    """
    try:
        from backend.models.production import AuditLog
        from backend.core.utils.dependencies import AsyncSessionLocal
        import uuid
        
        async_db = AsyncSessionLocal()
        try:
            audit_entry = AuditLog(
                org_id=uuid.UUID(org_id) if org_id else None,
                user_id=uuid.UUID(user_id) if user_id else None,
                action="ORG_ACCESS_DENIED",
                context={"endpoint": endpoint, "reason": reason},
                endpoint=endpoint,
                method="UNKNOWN"
            )
            async_db.add(audit_entry)
            await async_db.commit()
            logger.warning(f"[Audit] ORG_ACCESS_DENIED: user={user_id}, org={org_id}, endpoint={endpoint}, reason={reason}")
        except Exception as e:
            await async_db.rollback()
            logger.error(f"[Audit] Failed to log access denied: {e}")
        finally:
            await async_db.close()
    except Exception as e:
        logger.error(f"[Audit] Failed to create audit log entry: {e}")

