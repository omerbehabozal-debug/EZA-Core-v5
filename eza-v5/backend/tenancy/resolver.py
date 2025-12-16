# -*- coding: utf-8 -*-
"""
Tenancy Resolver - Extract institution context from requests
"""

from fastapi import Request, Header
from pydantic import BaseModel
from typing import Optional
from backend.core.utils.dependencies import get_current_user
from backend.models.user import LegacyUser as User


class TenantContext(BaseModel):
    """Tenant context extracted from request"""
    institution_id: Optional[int] = None
    application_id: Optional[int] = None
    user_id: Optional[int] = None
    roles: list[str] = []


async def resolve_tenant(
    request: Request,
    x_institution_id: Optional[int] = Header(None, alias="X-Institution-Id"),
    x_api_key: Optional[str] = Header(None, alias="X-Api-Key"),
) -> TenantContext:
    """
    Resolve tenant context from request headers and JWT
    """
    ctx = TenantContext()
    
    # Try to get user from JWT
    try:
        # This will work if authentication is enabled
        # For now, we'll handle it gracefully
        user: Optional[User] = None
        # user = await get_current_user(...)  # TODO: Wire properly when auth is enabled
    except:
        user = None
    
    if user:
        ctx.user_id = user.id
        ctx.institution_id = user.institution_id if hasattr(user, 'institution_id') else None
        if user.role:
            ctx.roles = [user.role.name]
    
    # Override with header if present
    if x_institution_id:
        ctx.institution_id = x_institution_id
    
    # TODO: Resolve application_id from X-Api-Key if provided
    # This would require looking up the API key in the database
    
    return ctx

