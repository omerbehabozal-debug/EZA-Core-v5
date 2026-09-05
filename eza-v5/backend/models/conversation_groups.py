# -*- coding: utf-8 -*-
"""Conversation groups — SAINA Conversation Tree (Stage 3 + 8.8G-5.3.1)."""

import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from backend.core.utils.dependencies import Base


class ConversationGroup(Base):
    """User or guest curiosity heading that organizes standalone conversations."""

    __tablename__ = "conversation_groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("production_users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    guest_token = Column(String(128), nullable=True, index=True)
    # Local group-* mapping for authenticated migration (G5.3.1). Nullable.
    client_group_id = Column(String(64), nullable=True, index=True)
    title = Column(String(120), nullable=False)
    source = Column(String(20), nullable=False, default="manual", index=True)
    parent_group_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "client_group_id",
            name="uq_conversation_groups_user_client_id",
        ),
        Index("ix_conversation_groups_user_sort", "user_id", "sort_order"),
    )
