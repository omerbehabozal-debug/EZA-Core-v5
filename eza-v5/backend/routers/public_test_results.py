# -*- coding: utf-8 -*-
"""
Public Test Results Router
Protected read-only endpoint for test safety benchmarks.
Uses snapshot-based publishing model for efficient caching.
Requires x-eza-publish-key header for security.
"""

from fastapi import APIRouter, HTTPException, Query, Header, Request
from fastapi.responses import JSONResponse
from typing import Optional
from backend.services.publish_test_snapshot import get_latest_snapshot
from backend.config import get_settings

router = APIRouter()


def verify_publish_key(request: Request) -> None:
    """
    Verify x-eza-publish-key header.
    Raises 403 if key is missing or invalid.
    """
    settings = get_settings()
    required_key = settings.PUBLIC_SNAPSHOT_KEY
    
    if not required_key:
        raise HTTPException(
            status_code=500,
            detail="PUBLIC_SNAPSHOT_KEY not configured. Access denied."
        )
    
    provided_key = request.headers.get("x-eza-publish-key") or request.headers.get("X-Eza-Publish-Key")
    
    if not provided_key:
        raise HTTPException(
            status_code=403,
            detail="Missing x-eza-publish-key header"
        )
    
    if provided_key != required_key:
        raise HTTPException(
            status_code=403,
            detail="Invalid x-eza-publish-key"
        )


@router.get(
    "/test-safety-benchmarks",
    summary="Get Test Safety Benchmarks Snapshot",
    description="Returns published test results snapshot. Requires x-eza-publish-key header. Cached for 24 hours.",
    response_description="Published test results snapshot with comprehensive statistics"
)
async def read_public_test_snapshot(
    request: Request,
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
    - Requires x-eza-publish-key header for security
    - Has aggressive caching (24 hours)
    - Reduces backend load significantly
    
    Security:
    - Header: x-eza-publish-key (required)
    - ENV: PUBLIC_SNAPSHOT_KEY must be set
    - Returns 403 if key is missing or invalid
    
    Args:
        period: Snapshot period ("daily", "weekly", "monthly")
    
    Returns:
        JSON: Published test results snapshot
    
    Raises:
        HTTPException: 403 if key is missing/invalid, 404 if no snapshot available
    """
    # Verify publish key
    verify_publish_key(request)
    
    # Get snapshot (no test calculation - just read from storage)
    snapshot = get_latest_snapshot(period)
    
    if not snapshot:
        raise HTTPException(
            status_code=404,
            detail=f"No published snapshot available for period: {period}"
        )
    
    # Return snapshot with cache headers
    response_data = snapshot.model_dump()
    
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

