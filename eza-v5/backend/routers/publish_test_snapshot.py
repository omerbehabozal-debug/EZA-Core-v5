# -*- coding: utf-8 -*-
"""
Publish Test Snapshot Router
Protected endpoint for publishing test result snapshots.
Requires x-eza-publish-key header for security.
"""

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from backend.services.publish_test_snapshot import publish_snapshot
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
            detail="PUBLIC_SNAPSHOT_KEY not configured. Cannot publish snapshots."
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


@router.post(
    "/publish",
    summary="Publish Test Snapshot",
    description="Publishes a new test results snapshot. Requires x-eza-publish-key header.",
    response_description="Published snapshot with snapshot_id and metadata"
)
async def publish_test_snapshot_endpoint(
    request: Request,
    period: str = Query(
        default="daily",
        description="Snapshot period: daily, weekly, or monthly",
        regex="^(daily|weekly|monthly)$"
    )
):
    """
    Publish a new test results snapshot.
    
    This endpoint:
    - Gets current comprehensive test results
    - Creates a snapshot with unique ID
    - Stores it for public consumption
    - Requires x-eza-publish-key header
    
    Security:
    - Header: x-eza-publish-key (required)
    - ENV: PUBLIC_SNAPSHOT_KEY must be set
    - Returns 403 if key is missing or invalid
    
    Args:
        period: Snapshot period ("daily", "weekly", "monthly")
    
    Returns:
        JSON: Published snapshot metadata
    
    Raises:
        HTTPException: 403 if key is missing/invalid, 500 on publish failure
    """
    # Verify publish key
    verify_publish_key(request)
    
    # Publish snapshot
    try:
        snapshot = publish_snapshot(period=period)
        return JSONResponse(
            content={
                "status": "published",
                "snapshot_id": snapshot.snapshot_id,
                "period": snapshot.period,
                "generated_at": snapshot.generated_at.isoformat(),
                "test_suites_count": len(snapshot.test_suites),
                "latest_runs_count": len(snapshot.latest_runs)
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to publish snapshot: {str(e)}"
        )

