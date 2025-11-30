# -*- coding: utf-8 -*-
"""
Monitor API Router
Live telemetry feed endpoints for corporate and regulator panels
"""

from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from backend.core.utils.dependencies import get_db
from backend.telemetry.repository import (
    get_latest_events,
    get_events_for_regulator,
    get_events_for_corporate
)
from backend.telemetry.schemas import TelemetryEventRead, TelemetryListResponse
from backend.core.utils.dependencies import require_internal  # For future auth

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/live-feed", response_model=TelemetryListResponse)
async def get_live_feed(
    limit: int = Query(50, ge=1, le=500, description="Maximum number of events to return"),
    mode: Optional[str] = Query(None, description="Filter by mode: standalone, proxy, proxy-lite"),
    db: AsyncSession = Depends(get_db)
    # TODO: Add authentication when ready
    # current_user = Depends(require_internal())
):
    """
    Get live telemetry feed
    
    Returns latest pipeline execution events for general monitoring.
    Can be filtered by mode.
    """
    try:
        events = await get_latest_events(
            session=db,
            limit=limit,
            mode=mode
        )
        
        # Convert to Pydantic models
        event_reads = [
            TelemetryEventRead(
                id=event.id,
                timestamp=event.created_at,
                mode=event.mode,
                source=event.source,
                user_input=event.user_input,
                safe_answer=event.safe_answer,
                eza_score=event.eza_score,
                risk_level=event.risk_level,
                policy_violations=event.policy_violations,
                model_votes=event.model_votes,
                meta=event.meta
            )
            for event in events
        ]
        
        newest_timestamp = event_reads[0].timestamp if event_reads else None
        
        return TelemetryListResponse(
            items=event_reads,
            total=len(event_reads),
            newest_timestamp=newest_timestamp
        )
    except Exception as e:
        logger.error(f"Error fetching live feed: {str(e)}")
        return TelemetryListResponse(
            items=[],
            total=0,
            newest_timestamp=None
        )


@router.get("/corporate-feed", response_model=TelemetryListResponse)
async def get_corporate_feed(
    limit: int = Query(50, ge=1, le=500, description="Maximum number of events to return"),
    mode: Optional[str] = Query(None, description="Filter by mode: standalone, proxy, proxy-lite"),
    db: AsyncSession = Depends(get_db)
    # TODO: Add corporate authentication when ready
    # current_user = Depends(require_corporate_user())
):
    """
    Get corporate telemetry feed
    
    Returns latest pipeline execution events for corporate panel monitoring.
    Can be filtered by mode.
    """
    try:
        events = await get_events_for_corporate(
            session=db,
            limit=limit,
            mode=mode
        )
        
        # Convert to Pydantic models
        event_reads = [
            TelemetryEventRead(
                id=event.id,
                timestamp=event.created_at,
                mode=event.mode,
                source=event.source,
                user_input=event.user_input,
                safe_answer=event.safe_answer,
                eza_score=event.eza_score,
                risk_level=event.risk_level,
                policy_violations=event.policy_violations,
                model_votes=event.model_votes,
                meta=event.meta
            )
            for event in events
        ]
        
        newest_timestamp = event_reads[0].timestamp if event_reads else None
        
        return TelemetryListResponse(
            items=event_reads,
            total=len(event_reads),
            newest_timestamp=newest_timestamp
        )
    except Exception as e:
        logger.error(f"Error fetching corporate feed: {str(e)}")
        return TelemetryListResponse(
            items=[],
            total=0,
            newest_timestamp=None
        )


@router.get("/regulator-feed", response_model=TelemetryListResponse)
async def get_regulator_feed(
    limit: int = Query(100, ge=1, le=500, description="Maximum number of events to return"),
    db: AsyncSession = Depends(get_db)
    # TODO: Add regulator authentication when ready
    # current_user = Depends(require_regulator_user())
):
    """
    Get regulator telemetry feed
    
    Returns pipeline execution events relevant for regulator monitoring (RTÜK, etc.).
    Filters for:
    - standalone and proxy modes
    - Events with policy violations
    - High/medium risk events
    """
    try:
        events = await get_events_for_regulator(
            session=db,
            limit=limit
        )
        
        # Convert to Pydantic models
        event_reads = [
            TelemetryEventRead(
                id=event.id,
                timestamp=event.created_at,
                mode=event.mode,
                source=event.source,
                user_input=event.user_input,
                safe_answer=event.safe_answer,
                eza_score=event.eza_score,
                risk_level=event.risk_level,
                policy_violations=event.policy_violations,
                model_votes=event.model_votes,
                meta=event.meta
            )
            for event in events
        ]
        
        newest_timestamp = event_reads[0].timestamp if event_reads else None
        
        return TelemetryListResponse(
            items=event_reads,
            total=len(event_reads),
            newest_timestamp=newest_timestamp
        )
    except Exception as e:
        logger.error(f"Error fetching regulator feed: {str(e)}")
        return TelemetryListResponse(
            items=[],
            total=0,
            newest_timestamp=None
        )

