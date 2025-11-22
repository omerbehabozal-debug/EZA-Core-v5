# -*- coding: utf-8 -*-
"""
Case Service
Handles case creation and retrieval using EZA engines
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from backend.models.case import Case
from backend.core.engines.eza_risk_engine import compute_risk
import json


async def create_case(
    db: AsyncSession,
    text: str,
    source: str = "rtuk",
    metadata: Optional[Dict[str, Any]] = None
) -> Case:
    """
    Create a new case with risk analysis
    
    Args:
        db: Database session
        text: Text content to analyze
        source: Source identifier (rtuk, btk, corporate, eu-ai, platform)
        metadata: Optional metadata dictionary
    
    Returns:
        Created Case object
    """
    # Use EZA Risk Engine to compute risk
    risk_result = compute_risk(text)
    
    # Create case record
    case = Case(
        text=text,
        risk_score=risk_result["risk_score"],
        risk_level=risk_result["risk_level"],
        source=source,
        meta_data=json.dumps(metadata) if metadata else None
    )
    
    db.add(case)
    await db.commit()
    await db.refresh(case)
    
    return case


async def list_cases(
    db: AsyncSession,
    source: Optional[str] = None,
    risk_level: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
) -> List[Case]:
    """
    List cases with optional filtering
    
    Args:
        db: Database session
        source: Filter by source
        risk_level: Filter by risk level
        limit: Maximum number of cases to return
        offset: Offset for pagination
    
    Returns:
        List of Case objects
    """
    query = select(Case)
    
    if source:
        query = query.where(Case.source == source)
    
    if risk_level:
        query = query.where(Case.risk_level == risk_level)
    
    query = query.order_by(desc(Case.created_at)).limit(limit).offset(offset)
    
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_case_by_id(db: AsyncSession, case_id: int) -> Optional[Case]:
    """Get a case by ID"""
    result = await db.execute(select(Case).where(Case.id == case_id))
    return result.scalar_one_or_none()

