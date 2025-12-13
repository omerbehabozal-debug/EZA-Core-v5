# -*- coding: utf-8 -*-
"""
Risk Service
Handles risk matrix computation using EZA Risk Engine
"""

from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.case import Case
from backend.core.engines.eza_risk_engine import compute_risk_matrix
from sqlalchemy import select


async def compute_risk_matrix_from_db(
    db: AsyncSession,
    source: str = None
) -> Dict[str, Any]:
    """
    Compute 3x3 risk matrix from database cases
    
    Args:
        db: Database session
        source: Optional source filter
    
    Returns:
        3x3 risk matrix dictionary
    """
    # Fetch cases from database
    query = select(Case)
    if source:
        query = query.where(Case.source == source)
    
    result = await db.execute(query)
    cases = result.scalars().all()
    
    # Convert to dictionary format for risk engine
    cases_data = [
        {
            "id": case.id,
            "risk_score": case.risk_score,
            "risk_level": case.risk_level,
            "source": case.source
        }
        for case in cases
    ]
    
    # Use EZA Risk Engine to compute matrix
    return compute_risk_matrix(cases_data)

