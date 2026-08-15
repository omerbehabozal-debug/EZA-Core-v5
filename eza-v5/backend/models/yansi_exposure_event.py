# -*- coding: utf-8 -*-
"""Phase 6.4 — durable Yansı exposure (meaningful visibility, not experience)."""

from sqlalchemy import Column, DateTime, Index, Integer, String, UniqueConstraint
from sqlalchemy.sql import func

from backend.core.utils.dependencies import Base

YANSI_EXPOSURE_CONTEXTS = frozenset(
    {"discover", "public_profile", "landing", "chain"}
)


class YansiExposureEvent(Base):
    """One row per exposure session × slug × version × context. No Q/A, EZA, IP, UA."""

    __tablename__ = "yansi_exposure_events"
    __table_args__ = (
        UniqueConstraint(
            "exposure_session_id",
            "mirror_slug",
            "journey_version",
            "context",
            name="uq_yansi_exposure_session_target_context",
        ),
        UniqueConstraint("event_id", name="uq_yansi_exposure_events_event_id"),
        Index("ix_yansi_exposure_events_slug_version", "mirror_slug", "journey_version"),
        Index("ix_yansi_exposure_events_context", "mirror_slug", "context"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(String(36), nullable=False)
    exposure_session_id = Column(String(36), nullable=False)
    mirror_slug = Column(String(128), nullable=False)
    journey_version = Column(Integer, nullable=False)
    context = Column(String(32), nullable=False)
    viewer_user_id = Column(String(64), nullable=True)
    occurred_at = Column(DateTime(timezone=True), nullable=True)
    received_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
