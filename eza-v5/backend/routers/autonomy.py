# -*- coding: utf-8 -*-
"""
Autonomy Monitor Router
TODO: Implement autonomy monitoring endpoints
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/status")
async def autonomy_monitor_status():
    """Autonomy monitor status endpoint"""
    return {
        "status": "not_implemented",
        "message": "Autonomy monitoring is not yet implemented"
    }

