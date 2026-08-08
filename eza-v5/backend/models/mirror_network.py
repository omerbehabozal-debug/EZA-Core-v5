# -*- coding: utf-8 -*-
"""
Mirror Network — persisted share nodes (Stage 1).

Public API returns only `public_payload`. `private_payload` is never exposed.

Phase 1 journey identity:
- artifact_kind: legacy_landing | journey_v1
- journey_version: bumps on explicit journey update (option A)
- slug remains the public journeyId
- legacy concurrency: partial unique (user_id, conversation_id) for legacy_landing only
- mirror_journey_steps keyed by (journey_slug, journey_version, step_index)
"""

import uuid
from sqlalchemy import (
    Column,
    String,
    DateTime,
    ForeignKey,
    JSON,
    Text,
    Integer,
    UniqueConstraint,
    Index,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from backend.core.utils.dependencies import Base

ARTIFACT_KIND_LEGACY_LANDING = "legacy_landing"
ARTIFACT_KIND_JOURNEY_V1 = "journey_v1"


class MirrorNetworkNode(Base):
    """A shareable Mirror artifact in the SAINA Mirror Network."""

    __tablename__ = "mirror_network_nodes"
    __table_args__ = (
        # Legacy path: at most one legacy_landing per (user, conversation).
        # journey_v1 rows are excluded so one conversation may own N journeys.
        Index(
            "uq_mirror_network_nodes_legacy_user_conversation",
            "user_id",
            "conversation_id",
            unique=True,
            postgresql_where=text(
                "artifact_kind = 'legacy_landing' AND conversation_id IS NOT NULL"
            ),
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    slug = Column(String(64), unique=True, nullable=False, index=True)

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("production_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Provenance only — not globally unique (one conversation may yield N journeys).
    # Legacy concurrency is enforced by partial unique index (legacy_landing only).
    conversation_id = Column(String(128), nullable=True, index=True)

    visibility = Column(String(20), nullable=False, default="public", index=True)
    safety_status = Column(String(20), nullable=False, default="open", index=True)

    card_title = Column(String(200), nullable=False)
    card_date = Column(String(10), nullable=False)
    scene_image_url = Column(Text, nullable=True)

    public_payload = Column(JSON, nullable=False)
    private_payload = Column(JSON, nullable=False)

    parent_slug = Column(String(64), nullable=True, index=True)

    artifact_kind = Column(
        String(32),
        nullable=False,
        default=ARTIFACT_KIND_LEGACY_LANDING,
        server_default=ARTIFACT_KIND_LEGACY_LANDING,
        index=True,
    )
    journey_version = Column(Integer, nullable=False, default=1, server_default="1")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    published_at = Column(DateTime(timezone=True), nullable=True)


class MirrorJourneyStep(Base):
    """Frozen Q/A step for journey_v1 (populated in later phases; table ready in Phase 1).

    Option A: same journey_slug may have versions 1,2,3… — each version keeps its own
    immutable 8 steps attributable via journey_version.
    """

    __tablename__ = "mirror_journey_steps"
    __table_args__ = (
        UniqueConstraint(
            "journey_slug",
            "journey_version",
            "step_index",
            name="uq_mirror_journey_steps_slug_version_index",
        ),
        Index(
            "ix_mirror_journey_steps_slug_version",
            "journey_slug",
            "journey_version",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    journey_slug = Column(
        String(64),
        ForeignKey("mirror_network_nodes.slug", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    journey_version = Column(Integer, nullable=False, default=1, server_default="1")
    step_index = Column(Integer, nullable=False)
    source_user_message_id = Column(String(128), nullable=True)
    source_assistant_message_id = Column(String(128), nullable=True)
    public_question = Column(Text, nullable=False)
    public_answer = Column(Text, nullable=False)
    question_hash = Column(String(64), nullable=True)
    answer_hash = Column(String(64), nullable=True)
    sanitization_flags = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
