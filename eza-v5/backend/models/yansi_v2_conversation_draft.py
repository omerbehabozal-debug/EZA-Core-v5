"""Yansı V2 conversation draft — flexible 1–8 Q/A lifecycle (not V1 BusinessYansiDraft).

V1 drafts remain on business_yansi_drafts with mandatory eight Studio steps.
This table is V2-only and must not reuse the V1 eight-step validation.
"""
from __future__ import annotations

import uuid

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from backend.core.utils.dependencies import Base


class YansiV2ConversationDraft(Base):
    """Mutable draft for a Business V2 frozen conversation Yansı.

    Approval binds to (revision, content_digest). Publish seals a new immutable
    YansiPublicationVersionV2; editing after publish requires a new draft cycle.
    """

    __tablename__ = "yansi_v2_conversation_drafts"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft','review','approved','published','archived')",
            name="ck_yansi_v2_conversation_draft_status",
        ),
        CheckConstraint(
            "revision >= 1",
            name="ck_yansi_v2_conversation_draft_revision",
        ),
        UniqueConstraint(
            "id",
            "business_id",
            name="uq_yansi_v2_conversation_draft_tenant",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("business_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(200), nullable=False)
    summary = Column(String(500), nullable=False, default="")
    # Ordered list of {stepIndex, question, answer, media:[{type,assetId,assetRevision,...}]}
    turns = Column(JSON, nullable=False)
    knowledge_source_pins = Column(JSON, nullable=False, default=list)
    knowledge_notes = Column(JSON, nullable=False, default=list)
    # Optional cover image pin (asset id + expected revision) for mixed manifests.
    cover_asset_id = Column(UUID(as_uuid=True), ForeignKey("business_brand_assets.id"), nullable=True)
    cover_asset_revision = Column(Integer, nullable=True)
    content_digest = Column(String(64), nullable=False)
    status = Column(String(16), nullable=False, default="draft")
    revision = Column(Integer, nullable=False, default=1)
    created_by = Column(UUID(as_uuid=True), ForeignKey("production_users.id"), nullable=False)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("production_users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    # Snapshot of the revision/digest that received brand approval.
    approved_revision = Column(Integer, nullable=True)
    approved_content_digest = Column(String(64), nullable=True)
    approval_note = Column(Text, nullable=True)
    published_node_id = Column(
        UUID(as_uuid=True),
        ForeignKey("mirror_network_nodes.id", ondelete="SET NULL"),
        nullable=True,
    )
    published_version = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
