# -*- coding: utf-8 -*-
"""
Ethical Case Model (PASİF DATASET)
Normalized ethical cases from cases + telemetry_events for future training.

🔒 ALTIN KURAL:
- ❌ Eğitim pipeline'ı burayı kullanmayacak (LEARNING_PIPELINE_ENABLED=false)
- ❌ Hiçbir inference bu tabloyu okumayacak
- ✅ Sadece dataset olarak hazırlanacak
- ✅ is_trainable=false default
"""

from sqlalchemy import Column, String, Float, DateTime, Text, Boolean, Index
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.sql import func
import uuid
from backend.core.utils.dependencies import Base


class EthicalCase(Base):
    """
    Ethical Case Model (PASİF DATASET)
    
    Normalized ethical cases from cases + telemetry_events tables.
    Prepared for future training, but NEVER used in inference.
    
    Feature flag: LEARNING_PIPELINE_ENABLED (default: false)
    """
    __tablename__ = "ethical_cases"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    original_case_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # FK to cases.id or telemetry_events.id
    
    # Anonymized text (PII removed)
    anonymized_text = Column(Text, nullable=False)
    
    # Risk and policy information
    risk_level = Column(String(50), nullable=False, index=True)  # low, medium, high, critical
    triggered_policies = Column(JSON, nullable=True)  # List of policy IDs that triggered
    
    # Embedding reference (optional)
    embedding_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # FK to ethical_embeddings.id
    
    # Training flag (default: false - NOT trainable)
    is_trainable = Column(Boolean, default=False, nullable=False, index=True)
    
    # Source information
    source_type = Column(String(50), nullable=True)  # case, telemetry_event
    source_id = Column(String(100), nullable=True)  # Original source identifier
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Indexes for dataset queries (read-only)
    __table_args__ = (
        Index('idx_ethical_case_risk_level', 'risk_level'),
        Index('idx_ethical_case_trainable', 'is_trainable'),
        Index('idx_ethical_case_created', 'created_at'),
    )

