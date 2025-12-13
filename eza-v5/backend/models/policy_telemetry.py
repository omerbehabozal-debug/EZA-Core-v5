# -*- coding: utf-8 -*-
"""
Policy Telemetry Model (READ-ONLY)
Tracks how policies perform, but NEVER automatically updates policy weights/thresholds.

🔒 ALTIN KURAL:
- ❌ Policy ağırlıkları otomatik güncellenmeyecek
- ❌ Threshold'lar otomatik değişmeyecek
- ✅ Sadece dashboard ve raporlamada kullanılacak
"""

from sqlalchemy import Column, String, Integer, Float, DateTime, Index
from sqlalchemy.sql import func
from backend.core.utils.dependencies import Base


class PolicyTelemetry(Base):
    """
    Policy Telemetry Model (READ-ONLY)
    
    Tracks policy performance metrics for analytics and reporting.
    NEVER used to automatically update policy weights or thresholds.
    """
    __tablename__ = "policy_telemetry"
    
    id = Column(Integer, primary_key=True, index=True)
    policy_id = Column(String(100), nullable=False, index=True)  # Policy identifier (e.g., "N1", "F2", "Z3")
    
    # Trigger metrics
    times_triggered = Column(Integer, default=0, nullable=False)
    false_positive = Column(Integer, default=0, nullable=False)  # Triggered but shouldn't have
    false_negative = Column(Integer, default=0, nullable=False)  # Should have triggered but didn't
    
    # Suggested metrics (READ-ONLY - for human review only)
    suggested_threshold = Column(Float, nullable=True)  # Suggested threshold (NOT auto-applied)
    confidence_score = Column(Float, nullable=True)  # Confidence in suggestion
    
    # Timestamps
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Indexes for analytics queries
    __table_args__ = (
        Index('idx_policy_telemetry_policy_id', 'policy_id'),
        Index('idx_policy_telemetry_updated', 'updated_at'),
    )

