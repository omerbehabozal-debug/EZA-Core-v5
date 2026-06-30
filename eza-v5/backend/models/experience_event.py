# -*- coding: utf-8 -*-
"""SQLAlchemy model for EZA Observation — experience_events (product-agnostic)."""

import uuid
from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from backend.core.utils.dependencies import Base


class ExperienceEvent(Base):
    """Short-lived behavioral experience events. EZA observes; products decide UX."""

    __tablename__ = "experience_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(String(64), nullable=False, index=True)
    product_version = Column(String(64), nullable=True)
    tenant_id = Column(String(255), nullable=True, index=True)
    environment = Column(String(32), nullable=False)

    event_type = Column(String(96), nullable=False, index=True)
    universal_event_type = Column(String(96), nullable=True, index=True)

    user_id = Column(String(255), nullable=True, index=True)
    guest_token_hash = Column(String(128), nullable=True, index=True)
    session_id = Column(String(255), nullable=True)

    conversation_id = Column(String(255), nullable=True, index=True)
    mirror_id = Column(String(255), nullable=True, index=True)
    root_mirror_id = Column(String(255), nullable=True)
    parent_mirror_id = Column(String(255), nullable=True)

    context_json = Column(JSONB, nullable=True)
    metrics_json = Column(JSONB, nullable=True)
    privacy_json = Column(JSONB, nullable=True)

    schema_version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
