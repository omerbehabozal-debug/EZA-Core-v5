# -*- coding: utf-8 -*-
"""
Tenancy Permissions - Permission checks for multi-tenant operations
"""

from fastapi import HTTPException, status
from backend.tenancy.resolver import TenantContext


def require_institution_admin(ctx: TenantContext) -> None:
    """Require institution admin role"""
    if "admin" not in ctx.roles and "eza_internal" not in ctx.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Institution admin access required"
        )


def require_auditor(ctx: TenantContext) -> None:
    """Require auditor role"""
    allowed_roles = ["institution_auditor", "admin", "eza_internal"]
    if not any(role in ctx.roles for role in allowed_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Auditor access required"
        )


def require_internal(ctx: TenantContext) -> None:
    """Require EZA internal role"""
    if "eza_internal" not in ctx.roles and "admin" not in ctx.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="EZA internal access required"
        )


def require_institution_access(ctx: TenantContext, institution_id: int) -> None:
    """Require access to specific institution"""
    if ctx.institution_id != institution_id:
        if "eza_internal" not in ctx.roles and "admin" not in ctx.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this institution"
            )

