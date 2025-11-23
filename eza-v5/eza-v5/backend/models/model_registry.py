# -*- coding: utf-8 -*-
"""
Model Registry Model
Stores AI model registrations for EU AI Act compliance
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Index
from sqlalchemy.sql import func
from backend.core.utils.dependencies import Base


class ModelRegistry(Base):
    __tablename__ = "model_registry"
    
    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String(255), nullable=False, index=True)
    version = Column(String(100), nullable=False)
    risk_profile = Column(Text, nullable=True)  # JSON string for risk profile data
    provider = Column(String(255), nullable=True)  # Model provider name
    compliance_status = Column(String(50), nullable=True, default="pending")  # pending, approved, rejected
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Unique constraint on model_name + version
    __table_args__ = (
        Index('idx_model_name_version', 'model_name', 'version', unique=True),
    )

