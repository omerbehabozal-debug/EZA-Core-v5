# -*- coding: utf-8 -*-
"""
EZA Proxy - Production Authentication
Enterprise-grade, regulator-ready authorization
NO environment-based bypasses, NO frontend API key handling
"""

from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.requests import Request
from sqlalchemy.ext.asyncio import AsyncSession
import logging
import uuid

from backend.auth.deps import get_current_user
from backend.core.utils.dependencies import get_db
from backend.services.production_api_key import resolve_api_key_for_organization
from backend.services.production_org import check_user_organization_membership

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=True)  # Require JWT token (no bypass)


async def require_proxy_auth_production(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    x_org_id: Optional[str] = Header(None, alias="x-org-id"),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Production-grade Proxy authentication.
    
    Requirements:
    1. JWT token (mandatory, no bypass)
    2. organization_id (from x-org-id header, mandatory)
    3. User must be member of organization
    4. Organization must have active API key (resolved internally)
    
    Returns:
        Dict with user info, org_id, resolved_api_key_id (masked)
    
    Raises:
        401: Missing or invalid JWT token
        403: Missing organization_id, user not member, or no active API key
    """
    # 1. Validate JWT token (mandatory, no bypass)
    from backend.auth.jwt import get_user_from_token
    token = credentials.credentials
    user_info = get_user_from_token(token)
    
    if user_info is None:
        logger.warning("[ProxyAuth] Invalid or expired JWT token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz veya süresi dolmuş oturum. Lütfen tekrar giriş yapın."
        )
    
    user_id = user_info.get("user_id") or user_info.get("sub")
    user_role = user_info.get("role", "")
    
    # Regulator roles: REGULATOR_READONLY, REGULATOR_AUDITOR, REGULATOR_RTUK, REGULATOR_MEDIA_AUDITOR, REGULATOR_SANAYI, REGULATOR_TECH_AUDITOR
    # These users have NO organization_id and can ONLY access read-only endpoints
    regulator_roles = ["REGULATOR_READONLY", "REGULATOR_AUDITOR", "REGULATOR_RTUK", "REGULATOR_MEDIA_AUDITOR", "REGULATOR_SANAYI", "REGULATOR_TECH_AUDITOR"]
    is_regulator = user_role in regulator_roles
    is_rtuk = user_role in ["REGULATOR_RTUK", "REGULATOR_MEDIA_AUDITOR"]
    is_sanayi = user_role in ["REGULATOR_SANAYI", "REGULATOR_TECH_AUDITOR"]
    
    if is_regulator:
        # Regulators: NO organization_id required, NO API key required
        # They can ONLY access GET endpoints (enforced by frontend API client)
        logger.info(
            f"[ProxyAuth] Regulator access: user_id={user_id}, role={user_role}, "
            f"endpoint={request.url.path}, method={request.method}"
        )
        
        # Block non-GET methods for regulators
        if request.method not in ["GET", "OPTIONS"]:
            logger.warning(f"[ProxyAuth] Regulator attempted {request.method} on {request.url.path}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Regulator panel is READ-ONLY. Only GET requests are allowed."
            )
        
        # Return regulator context (no org_id, no API key)
        return {
            **user_info,
            "org_id": None,  # Regulators have no organization
            "is_regulator": True,
            "is_rtuk": is_rtuk,  # RTÜK-specific flag
            "is_sanayi": is_sanayi,  # Sanayi Bakanlığı-specific flag
            "api_key_resolved": False,  # No API key for regulators
        }
    
    # Non-regulator users: Require organization_id
    # 2. Validate organization_id (mandatory for non-regulators)
    if not x_org_id:
        logger.warning(f"[ProxyAuth] Missing organization_id header. user_id={user_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organizasyon bağlamı gerekli. Lütfen geçerli bir organizasyon seçin."
        )
    
    # Validate UUID format
    try:
        org_uuid = uuid.UUID(x_org_id)
    except ValueError:
        logger.warning(f"[ProxyAuth] Invalid organization_id format: {x_org_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Geçersiz organizasyon kimliği formatı."
        )
    
    # 3. Verify user is member of organization
    is_member = await check_user_organization_membership(db, str(user_id), str(org_uuid))
    if not is_member:
        logger.warning(f"[ProxyAuth] User {user_id} is not a member of organization {x_org_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu organizasyona erişim yetkiniz bulunmamaktadır."
        )
    
    # 4. Resolve API key internally (backend-only, never exposed to frontend)
    api_key_info = await resolve_api_key_for_organization(db, x_org_id)
    if not api_key_info:
        logger.warning(f"[ProxyAuth] No active API key found for organization {x_org_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu organizasyon için aktif bir API anahtarı bulunamadı. Platform panelinden (platform.ezacore.ai) oluşturulmalıdır."
        )
    
    # 5. Validate role (Proxy roles only)
    proxy_roles = ["admin", "reviewer", "auditor", "readonly", "proxy_user"]
    platform_roles = ["admin", "org_admin", "ops", "finance", "auditor"]  # Platform roles can also access Proxy
    legacy_roles = ["corp_user", "dev", "corporate", "regulator"]  # Backward compatibility
    
    allowed_roles = set(proxy_roles + platform_roles + legacy_roles)
    if user_role not in allowed_roles:
        logger.warning(f"[ProxyAuth] Access denied for role: {user_role}, user_id={user_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Erişim reddedildi. İzin verilen roller: {', '.join(sorted(allowed_roles))}"
        )
    
    # 6. Audit log (mandatory, identical in dev and prod)
    resolved_api_key_id = api_key_info.get("api_key_id", "unknown")
    logger.info(
        f"[ProxyAuth] Authorized: user_id={user_id}, role={user_role}, "
        f"org_id={x_org_id}, api_key_id={resolved_api_key_id[:8]}... "
        f"endpoint={request.url.path}, method={request.method}"
    )
    
    # Return user context with resolved API key info (masked)
    return {
        **user_info,
        "org_id": x_org_id,
        "company_id": x_org_id,  # Alias for backward compatibility
        "resolved_api_key_id": resolved_api_key_id,  # Masked internal ID only
        "api_key_resolved": True,  # Flag indicating API key was resolved internally
    }

