# -*- coding: utf-8 -*-
"""
Telemetry Event Model
Stores pipeline execution events for live monitoring
"""

from sqlalchemy import Column, String, Float, DateTime, Text, JSON, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from backend.core.utils.dependencies import Base


class TelemetryEvent(Base):
    """Telemetry event model for pipeline monitoring"""
    __tablename__ = "telemetry_events"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    mode = Column(String(32), nullable=False, index=True)  # standalone, proxy, proxy-lite
    source = Column(String(64), nullable=False, index=True)  # standalone-api, proxy-api, etc.
    user_input = Column(Text, nullable=False)
    safe_answer = Column(Text, nullable=True)
    eza_score = Column(Float, nullable=True)
    risk_level = Column(String(32), nullable=True)  # low, medium, high
    policy_violations = Column(JSON, nullable=True)  # List of policy violations
    model_votes = Column(JSON, nullable=True)  # Which provider/model was used
    meta = Column(JSON, nullable=True)  # Additional metadata (alignment, deep_analysis, etc.)
    
    # Indexes for common queries
    __table_args__ = (
        Index('idx_telemetry_mode_created', 'mode', 'created_at'),
        Index('idx_telemetry_source_created', 'source', 'created_at'),
        Index('idx_telemetry_risk_created', 'risk_level', 'created_at'),
    )

