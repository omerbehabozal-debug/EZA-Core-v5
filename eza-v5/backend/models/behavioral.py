# -*- coding: utf-8 -*-
"""SQLAlchemy models for Safe Mode behavioral calibration tables."""

import uuid
from sqlalchemy import (
    Column,
    String,
    Float,
    Integer,
    Boolean,
    DateTime,
    Text,
    CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from backend.core.utils.dependencies import Base


class BehavioralLog(Base):
    __tablename__ = "behavioral_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(255), nullable=False, index=True)
    session_id = Column(String(255), nullable=False, index=True)
    org_id = Column(String(255), nullable=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    eza_score = Column(Float, nullable=True)
    input_risk = Column(Float, nullable=True)
    output_risk = Column(Float, nullable=True)
    alignment_score = Column(Float, nullable=True)
    asymmetry_index = Column(Float, nullable=True)
    reliance_signal = Column(Float, nullable=True)
    confidence_score = Column(Float, nullable=True)
    data_quality = Column(Float, nullable=True)
    mode = Column(String(50), nullable=True)
    schema_version = Column(Integer, default=1)
    case_snapshot = Column(JSONB, nullable=True)


class BehavioralBaseline(Base):
    __tablename__ = "behavioral_baselines"

    user_id = Column(String(255), primary_key=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    sample_count = Column(Integer, default=0)
    eza_mean = Column(Float, nullable=True)
    eza_std = Column(Float, nullable=True)
    eza_slope_7d = Column(Float, nullable=True)
    eza_slope_30d = Column(Float, nullable=True)
    asymmetry_mean = Column(Float, nullable=True)
    asymmetry_std = Column(Float, nullable=True)
    reliance_mean = Column(Float, nullable=True)
    reliance_std = Column(Float, nullable=True)
    baseline_quality = Column(Float, nullable=True)
    is_stable = Column(Boolean, default=False)
    last_calibrated = Column(DateTime(timezone=True), nullable=True)


class BehavioralFeedback(Base):
    __tablename__ = "behavioral_feedback"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(255), nullable=False, index=True)
    org_id = Column(String(255), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    analysis_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    event_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    feedback_type = Column(String(50), nullable=False)
    metric_name = Column(String(100), nullable=True)
    original_label = Column(String(100), nullable=True)
    corrected_label = Column(String(100), nullable=True)
    original_score = Column(Float, nullable=True)
    corrected_score = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    reviewed_by = Column(String(255), nullable=True)
    is_reviewed = Column(Boolean, default=False)
