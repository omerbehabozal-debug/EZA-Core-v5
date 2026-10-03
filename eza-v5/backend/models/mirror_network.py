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
    CheckConstraint,
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

    # Deterministic 8-question window identity (Phase 2 production closure).
    window_index = Column(Integer, nullable=True)
    window_start = Column(Integer, nullable=True)
    window_end = Column(Integer, nullable=True)

    # Phase 4 — durable freeze seal (journey_v1 publish boundary).
    freeze_status = Column(
        String(32),
        nullable=False,
        default="non_frozen",
        server_default="non_frozen",
        index=True,
    )
    frozen_at = Column(DateTime(timezone=True), nullable=True)

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
    source_order = Column(Integer, nullable=True)
    source_user_message_id = Column(String(128), nullable=True)
    source_assistant_message_id = Column(String(128), nullable=True)
    public_question = Column(Text, nullable=False)
    public_answer = Column(Text, nullable=False)
    question_hash = Column(String(64), nullable=True)
    answer_hash = Column(String(64), nullable=True)
    sanitization_flags = Column(JSON, nullable=True)
    # Phase 4.2 — immutable interaction-level EZA snapshot for this frozen step.
    eza_snapshot = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class YansiReport(Base):
    """Phase 8.4 — minimal user report of a public/link-accessible Yansı."""

    __tablename__ = "yansi_reports"
    __table_args__ = (
        UniqueConstraint(
            "mirror_slug",
            "reporter_user_id",
            name="uq_yansi_reports_slug_reporter",
        ),
        Index("ix_yansi_reports_slug_created", "mirror_slug", "created_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mirror_slug = Column(String(64), nullable=False, index=True)
    mirror_node_id = Column(
        UUID(as_uuid=True),
        ForeignKey("mirror_network_nodes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reporter_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("production_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reason = Column(String(32), nullable=False)
    status = Column(String(20), nullable=False, default="open", server_default="open")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class MirrorNetworkSave(Base):
    """Slice 5 — account-bound personal Save of a public Yansı (bookmark only)."""

    __tablename__ = "mirror_network_saves"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "mirror_slug",
            name="uq_mirror_network_saves_user_slug",
        ),
        Index(
            "ix_mirror_network_saves_user_created",
            "user_id",
            "created_at",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("production_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    mirror_slug = Column(String(64), nullable=False, index=True)
    mirror_node_id = Column(
        UUID(as_uuid=True),
        ForeignKey("mirror_network_nodes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# Katkılar v1 — one frozen Yansı experience (slug + journeyVersion). Not a step.
KATKI_CONTRIBUTION_TYPES = (
    "verify",
    "correction",
    "additional_information",
    "different_perspective",
)
KATKI_VISIBILITIES = (
    "visible",
    "hidden_by_owner",
    "hidden_by_trust",
    "withdrawn",
)
# Same bounded reasons as YansiReport. A report does not change visibility.
KATKI_REPORT_REASONS = (
    "inappropriate",
    "misleading",
    "privacy",
    "other",
)


class YansiContribution(Base):
    """Knowledge act on one frozen Yansı version. No step or message target."""

    __tablename__ = "yansi_contributions"
    __table_args__ = (
        CheckConstraint(
            "contribution_type IN ('verify', 'correction', "
            "'additional_information', 'different_perspective')",
            name="ck_yansi_contributions_type",
        ),
        CheckConstraint(
            "visibility IN ('visible', 'hidden_by_owner', 'hidden_by_trust', 'withdrawn')",
            name="ck_yansi_contributions_visibility",
        ),
        Index(
            "ix_yansi_contributions_slug_version",
            "slug",
            "journey_version",
        ),
        Index(
            "ix_yansi_contributions_slug_version_visibility",
            "slug",
            "journey_version",
            "visibility",
        ),
        # Withdrawn rows stay stored and do not occupy the active slot.
        Index(
            "uq_yansi_contributions_active_type",
            "contributor_user_id",
            "slug",
            "journey_version",
            "contribution_type",
            unique=True,
            postgresql_where=text("visibility <> 'withdrawn'"),
            sqlite_where=text("visibility <> 'withdrawn'"),
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    public_id = Column(UUID(as_uuid=True), unique=True, nullable=False, default=uuid.uuid4)
    slug = Column(
        String(64),
        ForeignKey("mirror_network_nodes.slug", ondelete="CASCADE"),
        nullable=False,
    )
    journey_version = Column(Integer, nullable=False)
    contribution_type = Column(String(32), nullable=False)
    body = Column(Text, nullable=True)
    source_note = Column(Text, nullable=True)
    contributor_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("production_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    visibility = Column(String(32), nullable=False, default="visible", server_default="visible")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    withdrawn_at = Column(DateTime(timezone=True), nullable=True)
    hidden_at = Column(DateTime(timezone=True), nullable=True)
    hidden_by_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("production_users.id", ondelete="SET NULL"),
        nullable=True,
    )


class YansiContributionReport(Base):
    """One report of one contribution. Does not change contribution visibility."""

    __tablename__ = "yansi_contribution_reports"
    __table_args__ = (
        UniqueConstraint(
            "contribution_id",
            "reporter_user_id",
            name="uq_yansi_contribution_reports_contribution_reporter",
        ),
        CheckConstraint(
            "reason IN ('inappropriate', 'misleading', 'privacy', 'other')",
            name="ck_yansi_contribution_reports_reason",
        ),
        Index(
            "ix_yansi_contribution_reports_contribution",
            "contribution_id",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contribution_id = Column(
        UUID(as_uuid=True),
        ForeignKey("yansi_contributions.id", ondelete="CASCADE"),
        nullable=False,
    )
    reporter_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("production_users.id", ondelete="CASCADE"),
        nullable=False,
    )
    reason = Column(String(32), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
