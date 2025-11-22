# -*- coding: utf-8 -*-
"""
Report Service
Handles report generation using EZA Report Engine
"""

from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.case import Case
from backend.core.engines.eza_report_engine import generate_report
from sqlalchemy import select
import json


async def generate_rtuk_report(
    db: AsyncSession,
    format: str = "json"
) -> Dict[str, Any]:
    """
    Generate RTÜK regulatory report
    
    Args:
        db: Database session
        format: Report format (json or pdf)
    
    Returns:
        Report dictionary
    """
    # Fetch RTÜK cases
    query = select(Case).where(Case.source == "rtuk")
    result = await db.execute(query)
    cases = result.scalars().all()
    
    # Convert to dictionary format
    cases_data = [
        {
            "id": case.id,
            "text": case.text,
            "risk_score": case.risk_score,
            "risk_level": case.risk_level,
            "source": case.source,
            "metadata": json.loads(case.meta_data) if case.meta_data else {},
            "created_at": case.created_at.isoformat() if case.created_at else None
        }
        for case in cases
    ]
    
    # Use EZA Report Engine to generate report
    return generate_report(cases_data, report_type="rtuk", format=format)

