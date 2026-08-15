# -*- coding: utf-8 -*-
"""Phase 6.4 — first NEW live user question after a verified Yansı continuation."""

from sqlalchemy import Column, DateTime, Index, Integer, String, UniqueConstraint
from sqlalchemy.sql import func

from backend.core.utils.dependencies import Base


class YansiOwnContinuationEvent(Base):
    """Slug-level precursor. Unique per continuation session. No message text/EZA/IP/UA/proof token."""

    __tablename__ = "yansi_own_continuation_events"
    __table_args__ = (
        UniqueConstraint(
            "continuation_session_id",
            name="uq_yansi_own_continuation_session",
        ),
        UniqueConstraint("event_id", name="uq_yansi_own_continuation_event_id"),
        Index("ix_yansi_own_continuation_origin", "origin_mirror_slug"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(String(36), nullable=False)
    continuation_session_id = Column(String(64), nullable=False)
    origin_mirror_slug = Column(String(128), nullable=False)
    origin_journey_version = Column(Integer, nullable=True)
    viewer_user_id = Column(String(64), nullable=True)
    occurred_at = Column(DateTime(timezone=True), nullable=True)
    received_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
