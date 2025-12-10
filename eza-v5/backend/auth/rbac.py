# -*- coding: utf-8 -*-
"""
EZA Proxy - Role-Based Access Control (RBAC)
Admin, Reviewer, Auditor, ReadOnly roles
"""

from typing import List, Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from backend.auth.proxy_auth import require_proxy_auth

# Role definitions
ROLES = {
    "admin": {
        "name": "Admin",
        "permissions": [
            "org.create",
            "org.api_key.create",
            "org.api_key.delete",
            "policy.add",
            "policy.modify",
            "policy.delete",
            "content.analyze",
            "content.rewrite",
            "audit.read",
            "audit.export",
            "dashboard.read",
        ]
    },
    "reviewer": {
        "name": "Reviewer",
        "permissions": [
            "org.api_key.create",
            "content.analyze",
            "content.rewrite",
            "audit.read",
            "dashboard.read",
        ]
    },
    "auditor": {
        "name": "Auditor",
        "permissions": [
            "audit.read",
            "audit.export",
            "dashboard.read",
        ]
    },
    "readonly": {
        "name": "ReadOnly",
        "permissions": [
            "dashboard.read",
        ]
    },
}


def require_permission(permission: str):
    """
    Dependency factory for permission-based access control
    """
    async def permission_checker(
        current_user: Dict[str, Any] = Depends(require_proxy_auth)
    ) -> Dict[str, Any]:
        user_role = current_user.get("role", "")
        
        if user_role not in ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Invalid role: {user_role}"
            )
        
        user_permissions = ROLES[user_role]["permissions"]
        
        if permission not in user_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required: {permission}"
            )
        
        return current_user
    
    return permission_checker


def require_role(allowed_roles: List[str]):
    """
    Dependency factory for role-based access control
    """
    async def role_checker(
        current_user: Dict[str, Any] = Depends(require_proxy_auth)
    ) -> Dict[str, Any]:
        user_role = current_user.get("role", "")
        
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}"
            )
        
        return current_user
    
    return role_checker

