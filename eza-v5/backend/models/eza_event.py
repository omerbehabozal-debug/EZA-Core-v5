# -*- coding: utf-8 -*-
"""SQLAlchemy model for Universal Event backbone (eza_events)."""

import uuid
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from backend.core.utils.dependencies import Base


class EzaEvent(Base):
    __tablename__ = "eza_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_mode = Column(String(64), nullable=False, index=True)
    entity_type = Column(String(64), nullable=False, index=True)
    entity_id = Column(String(255), nullable=False, index=True)
    event_type = Column(String(64), nullable=False, index=True)
    calibration_scope = Column(String(64), nullable=False)
    regulation_scope = Column(String(64), nullable=False, default="none", index=True)

    user_id = Column(String(255), nullable=True, index=True)
    org_id = Column(String(255), nullable=True, index=True)
    session_id = Column(String(255), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    score_vector = Column(JSONB, nullable=True)
    engine_votes = Column(JSONB, nullable=True)
    decision_trace = Column(JSONB, nullable=True)
    event_metadata = Column("metadata", JSONB, nullable=True)

    risk_label = Column(String(64), nullable=True)
    risk_score = Column(Float, nullable=True)
    confidence_score = Column(Float, nullable=True)
    reliability_score = Column(Float, nullable=True)
    can_interpret = Column(Boolean, default=False)

    case_snapshot = Column(JSONB, nullable=True)
    schema_version = Column(Integer, nullable=False, default=1)
