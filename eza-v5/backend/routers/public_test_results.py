# -*- coding: utf-8 -*-
"""
Public Test Results Router
Public read-only endpoint for test safety benchmarks.
Uses snapshot-based publishing model for efficient caching.
No authentication required - public access.
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from backend.services.publish_test_snapshot import get_latest_snapshot

router = APIRouter()


@router.get(
    "/test-safety-benchmarks",
    summary="Get Test Safety Benchmarks Snapshot",
    description="Returns published test results snapshot. Public endpoint, no authentication required. Cached for 24 hours.",
    response_description="Published test results snapshot with comprehensive statistics"
)
async def read_public_test_snapshot(
    period: str = Query(
        default="daily",
        description="Snapshot period: daily, weekly, or monthly",
        regex="^(daily|weekly|monthly)$"
    )
):
    """
    Get test safety benchmarks snapshot.
    
    This endpoint:
    - Returns published snapshot (NOT live calculation - no test runner triggered)
    - Public access (no authentication required)
    - Has aggressive caching (24 hours)
    - Reduces backend load significantly
    
    Args:
        period: Snapshot period ("daily", "weekly", "monthly")
    
    Returns:
        JSON: Published test results snapshot
    
    Raises:
        HTTPException: 404 if no snapshot available
    """
    # Get snapshot (no test calculation - just read from storage)
    snapshot = get_latest_snapshot(period)
    
    if not snapshot:
        raise HTTPException(
            status_code=404,
            detail=f"No published snapshot available for period: {period}"
        )
    
    # Return snapshot with cache headers
    response_data = snapshot.model_dump(mode="json")
    
    # Set aggressive cache headers for CDN/Vercel/Cloudflare
    # Cache for 24 hours, allow stale content for 1 hour while revalidating
    headers = {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
        "CDN-Cache-Control": "public, max-age=86400",
        "Vercel-CDN-Cache-Control": "public, max-age=86400"
    }
    
    return JSONResponse(
        content=response_data,
        headers=headers
    )

