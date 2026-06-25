# -*- coding: utf-8 -*-
"""
Mirror Network — persisted share nodes (Stage 1).

Public API returns only `public_payload`. `private_payload` is never exposed.
"""

import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from backend.core.utils.dependencies import Base


class MirrorNetworkNode(Base):
    """A shareable Mirror artifact in the SAINA Mirror Network."""

    __tablename__ = "mirror_network_nodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    slug = Column(String(64), unique=True, nullable=False, index=True)

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("production_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    conversation_id = Column(String(128), nullable=True, index=True)

    visibility = Column(String(20), nullable=False, default="public", index=True)
    safety_status = Column(String(20), nullable=False, default="open", index=True)

    card_title = Column(String(200), nullable=False)
    card_date = Column(String(10), nullable=False)
    scene_image_url = Column(Text, nullable=True)

    public_payload = Column(JSON, nullable=False)
    private_payload = Column(JSON, nullable=False)

    parent_slug = Column(String(64), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    published_at = Column(DateTime(timezone=True), nullable=True)
