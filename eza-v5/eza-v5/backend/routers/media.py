# -*- coding: utf-8 -*-
"""
Media Monitor Router
TODO: Implement media monitoring endpoints
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/status")
async def media_monitor_status():
    """Media monitor status endpoint"""
    return {
        "status": "not_implemented",
        "message": "Media monitoring is not yet implemented"
    }

