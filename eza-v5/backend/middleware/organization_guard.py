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
from backend.services.production_org import get_organization as db_get_organization
from backend.services.production_org import check_user_organization_membership as db_check_membership

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


async def log_audit_event_db(
    action: str,
    user_id: Optional[str],
    org_id: Optional[str],
    endpoint: str,
    method: str,
    reason: Optional[str] = None
):
    """
    Log audit event to database (non-blocking)
    """
    try:
        from backend.models.production import AuditLog
        from backend.core.utils.dependencies import AsyncSessionLocal
        import uuid
        
        async_db = AsyncSessionLocal()
        try:
            # Safely convert org_id and user_id to UUID (skip if invalid format)
            org_uuid = None
            if org_id:
                try:
                    org_uuid = uuid.UUID(org_id)
                except (ValueError, TypeError):
                    # Legacy string IDs (e.g., "demo-media-group") are not UUIDs
                    # Store in context instead
                    pass
            
            user_uuid = None
            if user_id:
                try:
                    user_uuid = uuid.UUID(user_id)
                except (ValueError, TypeError):
                    pass
            
            # Include non-UUID org_id/user_id in context for reference
            context_data = {"endpoint": endpoint, "method": method, "reason": reason}
            if org_id and not org_uuid:
                context_data["org_id_legacy"] = org_id
            if user_id and not user_uuid:
                context_data["user_id_legacy"] = user_id
            
            # Create AuditLog without triggering relationship resolution
            # Use direct table insert to avoid User model conflict
            from sqlalchemy import insert
            from backend.models.production import AuditLog
            
            # Insert directly to avoid relationship resolution issues
            stmt = insert(AuditLog).values(
                org_id=org_uuid,
                user_id=user_uuid,
                action=action,
                context=context_data,
                endpoint=endpoint,
                method=method
            )
            await async_db.execute(stmt)
            await async_db.commit()
            logger.warning(f"[Audit] {action}: user={user_id}, org={org_id}, endpoint={endpoint}, reason={reason}")
        except Exception as e:
            await async_db.rollback()
            logger.error(f"[Audit] Failed to log {action}: {e}")
        finally:
            await async_db.close()
    except Exception as e:
        logger.error(f"[Audit] Failed to create audit log entry: {e}")


class OrganizationGuardMiddleware(BaseHTTPMiddleware):
    """
    Organization Guard Middleware
    
    Enforces organization-level access control for all protected endpoints.
    Automatically validates x-org-id header and user-organization membership.
    """
    
    async def dispatch(self, request: Request, call_next):
        # Skip organization guard for OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)
        
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
            asyncio.create_task(log_audit_event_db(
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
            asyncio.create_task(log_audit_event_db(
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
        
        # 2. Validate organization exists (database)
        # Use request-scoped DB session if available, otherwise create new one
        from backend.core.utils.dependencies import AsyncSessionLocal
        async_db = None
        org = None
        
        # Try to get DB from request state (if available from dependency injection)
        if hasattr(request.state, "db"):
            async_db = request.state.db
        else:
            async_db = AsyncSessionLocal()
        
        try:
            org = await db_get_organization(async_db, x_org_id)
            if not org:
                asyncio.create_task(log_audit_event_db(
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
            
            # 3. Check organization status
            if org.status != "active":
                asyncio.create_task(log_audit_event_db(
                    action="ORG_ACCESS_DENIED",
                    user_id=None,
                    org_id=x_org_id,
                    endpoint=request.url.path,
                    method=request.method,
                    reason=f"Organization status: {org.status}"
                ))
                
                logger.warning(f"[OrgGuard] Organization not active: {x_org_id} (status: {org.status})")
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={"error": f"Organization is {org.status}", "detail": "Only active organizations can be accessed"}
                )
        finally:
            # Only close if we created the session
            if not hasattr(request.state, "db") and async_db:
                await async_db.close()
        
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
        
        # 5. Check user-organization membership (database)
        if user_id:
            # Use same DB session
            if async_db is None:
                async_db = AsyncSessionLocal() if not hasattr(request.state, "db") else request.state.db
            
            try:
                is_member = await db_check_membership(async_db, user_id, x_org_id)
                
                # Allow admin/org_admin roles to bypass membership check
                if not is_member and user_role not in ["admin", "org_admin"]:
                    asyncio.create_task(log_audit_event_db(
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
            finally:
                # Only close if we created the session (not from request.state)
                if async_db and not hasattr(request.state, "db"):
                    await async_db.close()
        else:
            # No user ID - allow request but log warning
            logger.warning(f"[OrgGuard] No user ID found for org {x_org_id} on {request.url.path}")
        
        # 6. Add organization context to request state
        request.state.org_id = x_org_id
        request.state.organization = {
            "id": str(org.id),
            "name": org.name,
            "status": org.status,
            "plan": org.plan
        }
        if user_id:
            request.state.user_id = user_id
        
        # 7. Continue with request
        response = await call_next(request)
        
        # Log successful access (optional, for monitoring)
        if user_id:
            logger.debug(f"[OrgGuard] Access granted: user {user_id} -> org {x_org_id} -> {request.url.path}")
        
        return response


# Legacy function removed - use database queries instead
# Use backend.services.production_org.check_user_organization_membership

