# -*- coding: utf-8 -*-
"""SQLAlchemy model for SAINA account usage quota events."""

import uuid

from sqlalchemy import Column, DateTime, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from backend.core.utils.dependencies import Base


class AccountUsageEvent(Base):
    """Per-action usage events for tier quota enforcement."""

    __tablename__ = "account_usage_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(255), nullable=True, index=True)
    guest_fingerprint = Column(String(32), nullable=True, index=True)
    event_type = Column(String(64), nullable=False, index=True)
    source_id = Column(String(255), nullable=True)
    event_metadata = Column("metadata", JSONB, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
