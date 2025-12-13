# -*- coding: utf-8 -*-
"""
Pattern Store - Store and retrieve patterns of high-risk or rejected content
"""

from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, Text
from sqlalchemy.sql import func
from backend.core.utils.dependencies import Base
from backend.telemetry.logger import setup_logger

logger = setup_logger("eza.pattern_store")


class Pattern(Base):
    """Pattern model for learning"""
    __tablename__ = "patterns"
    
    id = Column(Integer, primary_key=True, index=True)
    pattern_type = Column(String, nullable=False, index=True)  # "high_risk", "blocked", "deception", etc.
    input_hash = Column(String, nullable=False, index=True)  # Hash of input (no PII)
    risk_score = Column(Float, nullable=False)
    eza_score = Column(Float, nullable=True)
    features = Column(JSON, nullable=True)  # Extracted features
    tags = Column(JSON, nullable=True)  # Tags for categorization
    meta_data = Column("metadata", JSON, nullable=True)  # Renamed to avoid conflict
    created_at = Column(DateTime(timezone=True), server_default=func.now())


async def store_pattern(
    db: AsyncSession,
    pattern_type: str,
    input_hash: str,
    risk_score: float,
    eza_score: Optional[float] = None,
    features: Optional[Dict[str, Any]] = None,
    tags: Optional[List[str]] = None,
    meta_data: Optional[Dict[str, Any]] = None,
) -> Pattern:
    """Store a pattern"""
    try:
        pattern = Pattern(
            pattern_type=pattern_type,
            input_hash=input_hash,
            risk_score=risk_score,
            eza_score=eza_score,
            features=features,
            tags=tags or [],
            meta_data=meta_data
        )
        db.add(pattern)
        await db.commit()
        await db.refresh(pattern)
        return pattern
    except Exception as e:
        logger.error(f"Failed to store pattern: {e}")
        await db.rollback()
        raise


async def get_similar_patterns(
    db: AsyncSession,
    input_hash: str,
    pattern_type: Optional[str] = None,
    limit: int = 10,
) -> List[Pattern]:
    """Get similar patterns by input hash"""
    from sqlalchemy import select
    
    query = select(Pattern).where(Pattern.input_hash == input_hash)
    
    if pattern_type:
        query = query.where(Pattern.pattern_type == pattern_type)
    
    query = query.order_by(Pattern.created_at.desc()).limit(limit)
    
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_patterns_by_risk(
    db: AsyncSession,
    min_risk_score: float = 0.7,
    pattern_type: Optional[str] = None,
    limit: int = 100,
) -> List[Pattern]:
    """Get patterns by risk score threshold"""
    from sqlalchemy import select
    
    query = select(Pattern).where(Pattern.risk_score >= min_risk_score)
    
    if pattern_type:
        query = query.where(Pattern.pattern_type == pattern_type)
    
    query = query.order_by(Pattern.risk_score.desc()).limit(limit)
    
    result = await db.execute(query)
    return list(result.scalars().all())

