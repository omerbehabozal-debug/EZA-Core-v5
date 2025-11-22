# -*- coding: utf-8 -*-
"""
Case Model
Stores regulatory cases with risk analysis
"""

from sqlalchemy import Column, Integer, String, Float, Text, DateTime, Index
from sqlalchemy.sql import func
from backend.core.utils.dependencies import Base


class Case(Base):
    __tablename__ = "cases"
    
    id = Column(Integer, primary_key=True, index=True)
    text = Column(Text, nullable=False)
    risk_score = Column(Float, nullable=False, default=0.0)
    risk_level = Column(String(50), nullable=False, default="low")  # low, medium, high, critical
    source = Column(String(50), nullable=False, index=True)  # rtuk, btk, corporate, eu-ai, platform
    meta_data = Column(Text, nullable=True)  # JSON string for additional data (renamed from metadata to avoid SQLAlchemy conflict)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Indexes for common queries
    __table_args__ = (
        Index('idx_cases_source_risk', 'source', 'risk_level'),
        Index('idx_cases_created_at', 'created_at'),
    )

