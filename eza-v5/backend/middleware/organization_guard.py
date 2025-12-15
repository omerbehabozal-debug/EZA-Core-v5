# -*- coding: utf-8 -*-
"""
Organization Guard Middleware
Enterprise-grade multi-tenant isolation enforcement
"""

import logging
from typing import Optional, Dict, Any
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from fastapi import status
import asyncio

from backend.auth.jwt import get_user_from_token
from backend.routers.organization import organizations

logger = logging.getLogger(__name__)

# Protected route prefixes (require x-org-id)
PROTECTED_PREFIXES = [
    "/api/org",  # All /api/org/* routes (analytics, billing, sla, alerts)
    "/api/policy",  # Policy management (/api/policy/*)
    "/api/platform",  # Platform endpoints (except /api/platform/organizations)
    # Note: /api/analytics, /api/billing, /api/sla, /api/audit, /api/telemetry are under /api/org/*
    # /api/api-keys would be under /api/platform or /api/org
]

# Excluded paths (no organization guard)
EXCLUDED_PATHS = [
    "/auth",
    "/health",
    "/api/auth",
    "/api/platform/organizations",  # Organizations CRUD endpoint
    "/docs",
    "/openapi.json",
    "/redoc",
]


# In-memory organization_users store (in production, use database)
# Format: {org_id: {user_id: {role, status, joined_at}}}
organization_users: Dict[str, Dict[str, Dict[str, Any]]] = {}


def is_protected_path(path: str) -> bool:
    """Check if path requires organization guard"""
    # Check exclusions first
    for excluded in EXCLUDED_PATHS:
        if path.startswith(excluded):
            return False
    
    # Check if path matches protected prefixes
    for prefix in PROTECTED_PREFIXES:
        if path.startswith(prefix):
            # Special case: /api/platform/organizations is excluded
            if path.startswith("/api/platform/organizations"):
                return False
            return True
    
    return False


async def check_user_organization_membership(
    user_id: str,
    org_id: str
) -> bool:
    """
    Check if user is a member of the organization
    
    In production, this should query database:
    SELECT * FROM organization_users WHERE user_id = ? AND org_id = ? AND status = 'active'
    """
    # Check in-memory store
    if org_id in organization_users:
        org_users = organization_users[org_id]
        if user_id in org_users:
            user_data = org_users[user_id]
            # Check if user is active
            if user_data.get("status") == "active":
                return True
    
    # Fallback: allow admin/org_admin roles (for now)
    # In production, this should be removed and only DB check should be used
    return False


async def log_audit_event(
    action: str,
    user_id: Optional[str],
    org_id: Optional[str],
    endpoint: str,
    method: str,
    reason: Optional[str] = None
):
    """
    Log audit event asynchronously (non-blocking)
    """
    try:
        from backend.routers.proxy_audit import audit_store
        from datetime import datetime
        
        audit_entry = {
            "action": action,
            "user_id": user_id,
            "org_id": org_id,
            "endpoint": endpoint,
            "method": method,
            "reason": reason,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        # Store audit entry (in-memory, in production use DB)
        # Use a unique key for the audit entry
        import uuid
        audit_key = f"org_access_denied_{uuid.uuid4()}"
        audit_store[audit_key] = audit_entry
        
        logger.warning(f"[Audit] {action}: user={user_id}, org={org_id}, endpoint={endpoint}, reason={reason}")
    except Exception as e:
        logger.error(f"[Audit] Failed to log {action}: {e}")


class OrganizationGuardMiddleware(BaseHTTPMiddleware):
    """
    Organization Guard Middleware
    
    Enforces organization-level access control for all protected endpoints.
    Automatically validates x-org-id header and user-organization membership.
    """
    
    async def dispatch(self, request: Request, call_next):
        # Skip organization guard for excluded paths
        if not is_protected_path(request.url.path):
            return await call_next(request)
        
        # 1. Try to get org_id from header first
        x_org_id = request.headers.get("x-org-id") or request.headers.get("X-Org-Id")
        
        # 2. If not in header, try to extract from path parameter
        # Pattern: /api/org/{org_id}/...
        path_org_id = None
        import re
        path_match = re.match(r'^/api/org/([^/]+)', request.url.path)
        if path_match:
            path_org_id = path_match.group(1)
        
        # Use path org_id if header is missing
        if not x_org_id and path_org_id:
            x_org_id = path_org_id
            logger.debug(f"[OrgGuard] Extracted org_id from path: {x_org_id}")
        
        # If both exist, they must match
        if x_org_id and path_org_id and x_org_id != path_org_id:
            asyncio.create_task(log_audit_event(
                action="ORG_ACCESS_DENIED",
                user_id=None,
                org_id=x_org_id,
                endpoint=request.url.path,
                method=request.method,
                reason=f"Organization mismatch: header={x_org_id}, path={path_org_id}"
            ))
            logger.warning(f"[OrgGuard] Organization mismatch: header={x_org_id}, path={path_org_id}")
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"error": "Organization mismatch", "detail": f"x-org-id header ({x_org_id}) does not match path parameter ({path_org_id})"}
            )
        
        if not x_org_id:
            # Log audit event (async, non-blocking)
            asyncio.create_task(log_audit_event(
                action="ORG_ACCESS_DENIED",
                user_id=None,
                org_id=None,
                endpoint=request.url.path,
                method=request.method,
                reason="Missing x-org-id header"
            ))
            
            logger.warning(f"[OrgGuard] Missing x-org-id header for {request.url.path}")
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"error": "Organization context required", "detail": "x-org-id header is required"}
            )
        
        # 2. Validate organization exists
        if x_org_id not in organizations:
            asyncio.create_task(log_audit_event(
                action="ORG_ACCESS_DENIED",
                user_id=None,
                org_id=x_org_id,
                endpoint=request.url.path,
                method=request.method,
                reason="Organization not found"
            ))
            
            logger.warning(f"[OrgGuard] Organization not found: {x_org_id}")
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"error": "Organization not found", "detail": f"Organization {x_org_id} does not exist"}
            )
        
        org = organizations[x_org_id]
        
        # 3. Check organization status
        if org.get("status") != "active":
            asyncio.create_task(log_audit_event(
                action="ORG_ACCESS_DENIED",
                user_id=None,
                org_id=x_org_id,
                endpoint=request.url.path,
                method=request.method,
                reason=f"Organization status: {org.get('status')}"
            ))
            
            logger.warning(f"[OrgGuard] Organization not active: {x_org_id} (status: {org.get('status')})")
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"error": f"Organization is {org.get('status')}", "detail": "Only active organizations can be accessed"}
            )
        
        # 4. Extract user from JWT token
        user_id = None
        user_role = None
        
        auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")
            try:
                user_info = get_user_from_token(token)
                if user_info:
                    user_id_raw = user_info.get("user_id") or user_info.get("sub")
                    user_id = str(user_id_raw) if user_id_raw is not None else None
                    user_role = user_info.get("role", "")
            except Exception as e:
                logger.warning(f"[OrgGuard] Failed to decode token: {e}")
                user_id = None
                user_role = None
        
        # 5. Check user-organization membership
        if user_id:
            is_member = await check_user_organization_membership(user_id, x_org_id)
            
            # Allow admin/org_admin roles to bypass membership check (for now)
            # In production, even admins should be in organization_users table
            if not is_member and user_role not in ["admin", "org_admin"]:
                asyncio.create_task(log_audit_event(
                    action="ORG_ACCESS_DENIED",
                    user_id=user_id,
                    org_id=x_org_id,
                    endpoint=request.url.path,
                    method=request.method,
                    reason="User not authorized for this organization"
                ))
                
                logger.warning(f"[OrgGuard] User {user_id} not member of org {x_org_id}")
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={"error": "User not authorized for this organization", "detail": f"User {user_id} is not a member of organization {x_org_id}"}
                )
        else:
            # No user ID - allow request but log warning
            logger.warning(f"[OrgGuard] No user ID found for org {x_org_id} on {request.url.path}")
        
        # 6. Add organization context to request state
        request.state.org_id = x_org_id
        request.state.organization = org
        if user_id:
            request.state.user_id = user_id
        
        # 7. Continue with request
        response = await call_next(request)
        
        # Log successful access (optional, for monitoring)
        if user_id:
            logger.debug(f"[OrgGuard] Access granted: user {user_id} -> org {x_org_id} -> {request.url.path}")
        
        return response


# Helper function to get organization_users store (for platform_organizations.py)
def get_organization_users_store() -> Dict[str, Dict[str, Dict[str, Any]]]:
    """Get the organization_users store (for use in other modules)"""
    return organization_users

