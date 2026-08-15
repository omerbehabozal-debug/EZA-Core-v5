# -*- coding: utf-8 -*-
"""Phase 6.0 — durable Yansı experience events (internal measurement only)."""

from sqlalchemy import Column, DateTime, Index, Integer, String, UniqueConstraint, text
from sqlalchemy.sql import func

from backend.core.utils.dependencies import Base

YANSI_EXPERIENCE_STARTED = "yansi_experience_started"
YANSI_EXPERIENCE_COMPLETED = "yansi_experience_completed"
YANSI_EXPERIENCE_SKIPPED = "yansi_experience_skipped"

YANSI_EXPERIENCE_EVENT_TYPES = frozenset(
    {
        YANSI_EXPERIENCE_STARTED,
        YANSI_EXPERIENCE_COMPLETED,
        YANSI_EXPERIENCE_SKIPPED,
    }
)


class YansiExperienceEvent(Base):
    """Durable started/completed/skipped rows. No Q/A, EZA, tokens, IP, or UA."""

    __tablename__ = "yansi_experience_events"
    __table_args__ = (
        UniqueConstraint("event_id", name="uq_yansi_experience_events_event_id"),
        Index(
            "uq_yansi_experience_started_session",
            "experience_session_id",
            unique=True,
            postgresql_where=text("event_type = 'yansi_experience_started'"),
            sqlite_where=text("event_type = 'yansi_experience_started'"),
        ),
        Index(
            "uq_yansi_experience_completed_session",
            "experience_session_id",
            unique=True,
            postgresql_where=text("event_type = 'yansi_experience_completed'"),
            sqlite_where=text("event_type = 'yansi_experience_completed'"),
        ),
        Index(
            "uq_yansi_experience_skip_transition",
            "experience_session_id",
            "completed_step_count",
            "destination_slug",
            unique=True,
            postgresql_where=text("event_type = 'yansi_experience_skipped'"),
            sqlite_where=text("event_type = 'yansi_experience_skipped'"),
        ),
        Index("ix_yansi_experience_events_slug_version", "mirror_slug", "journey_version"),
        Index("ix_yansi_experience_events_session", "experience_session_id"),
        Index("ix_yansi_experience_events_received_at", "received_at"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(String(36), nullable=False)
    experience_session_id = Column(String(36), nullable=False)
    event_type = Column(String(64), nullable=False)

    mirror_slug = Column(String(128), nullable=False)
    journey_version = Column(Integer, nullable=False)

    viewer_user_id = Column(String(64), nullable=True)

    completed_step_count = Column(Integer, nullable=True)
    destination_slug = Column(String(128), nullable=True)

    occurred_at = Column(DateTime(timezone=True), nullable=True)
    received_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
