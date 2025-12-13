# -*- coding: utf-8 -*-
"""
Admin Router
Admin panel endpoints
"""

from fastapi import APIRouter, Depends
from backend.core.utils.dependencies import require_role

router = APIRouter()


@router.get("/dashboard")
async def admin_dashboard(
    current_user = Depends(require_role(["admin"]))
):
    """Admin dashboard endpoint"""
    return {
        "status": "ok",
        "message": "Admin dashboard",
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "role": current_user.role.name
        }
    }


@router.get("/users")
async def list_users(
    current_user = Depends(require_role(["admin"]))
):
    """List all users (admin only)"""
    # TODO: Implement user listing
    return {"users": []}


@router.get("/stats")
async def admin_stats(
    current_user = Depends(require_role(["admin"]))
):
    """Admin statistics endpoint"""
    # TODO: Implement statistics
    return {
        "total_users": 0,
        "total_requests": 0,
        "risk_distribution": {}
    }

