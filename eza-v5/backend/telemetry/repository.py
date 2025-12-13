# -*- coding: utf-8 -*-
"""
Telemetry Event Repository
Database operations for telemetry events
"""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_
from sqlalchemy.orm import selectinload
import logging

from backend.telemetry.models import TelemetryEvent
from backend.telemetry.schemas import TelemetryEventCreate

logger = logging.getLogger(__name__)


async def create_event(
    session: AsyncSession,
    data: TelemetryEventCreate
) -> TelemetryEvent:
    """
    Create a new telemetry event
    
    Args:
        session: Database session
        data: Telemetry event data
    
    Returns:
        Created TelemetryEvent
    """
    event = TelemetryEvent(
        mode=data.mode,
        source=data.source,
        user_input=data.user_input,
        safe_answer=data.safe_answer,
        eza_score=data.eza_score,
        risk_level=data.risk_level,
        policy_violations=data.policy_violations,
        model_votes=data.model_votes,
        meta=data.meta
    )
    session.add(event)
    await session.commit()
    await session.refresh(event)
    return event


async def get_latest_events(
    session: AsyncSession,
    limit: int = 50,
    mode: Optional[str] = None,
    source: Optional[str] = None
) -> List[TelemetryEvent]:
    """
    Get latest telemetry events with optional filters
    
    Args:
        session: Database session
        limit: Maximum number of events to return
        mode: Optional filter by mode (standalone, proxy, proxy-lite)
        source: Optional filter by source
    
    Returns:
        List of TelemetryEvent objects, ordered by created_at descending
    """
    query = select(TelemetryEvent)
    
    # Apply filters
    if mode:
        query = query.where(TelemetryEvent.mode == mode)
    if source:
        query = query.where(TelemetryEvent.source == source)
    
    # Order by created_at descending and limit
    query = query.order_by(desc(TelemetryEvent.created_at)).limit(limit)
    
    result = await session.execute(query)
    return list(result.scalars().all())


async def get_events_for_regulator(
    session: AsyncSession,
    limit: int = 100
) -> List[TelemetryEvent]:
    """
    Get events for regulator panel
    Filters for standalone/proxy modes and events with policy violations
    
    Args:
        session: Database session
        limit: Maximum number of events to return
    
    Returns:
        List of TelemetryEvent objects relevant for regulator monitoring
    """
    query = select(TelemetryEvent).where(
        or_(
            TelemetryEvent.mode.in_(["standalone", "proxy"]),
            TelemetryEvent.policy_violations.isnot(None),
            TelemetryEvent.risk_level.in_(["high", "medium"])
        )
    ).order_by(desc(TelemetryEvent.created_at)).limit(limit)
    
    result = await session.execute(query)
    return list(result.scalars().all())


async def get_events_for_corporate(
    session: AsyncSession,
    limit: int = 50,
    mode: Optional[str] = None
) -> List[TelemetryEvent]:
    """
    Get events for corporate panel
    
    Args:
        session: Database session
        limit: Maximum number of events to return
        mode: Optional filter by mode
    
    Returns:
        List of TelemetryEvent objects for corporate monitoring
    """
    # For now, same as get_latest_events
    # Can be extended with corporate-specific filters (e.g., institution_id)
    return await get_latest_events(session, limit=limit, mode=mode)

