"""Yansı V2 Stage 2A — versioned Knowledge Bundle persistence.

Bundle versions become immutable once sealed (and when referenced by a
publication contract). Node publication history remains in
yansi_publication_versions_v2; this module owns knowledge provenance only.
"""
from __future__ import annotations

import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from backend.core.utils.dependencies import Base


class YansiKnowledgeBundle(Base):
    """Tenant-owned bundle identity. Versions live in yansi_knowledge_bundle_versions."""

    __tablename__ = "yansi_knowledge_bundles"
    __table_args__ = (
        CheckConstraint(
            "access_scope IN ('private', 'business', 'publication_bound')",
            name="ck_yansi_knowledge_bundles_access_scope",
        ),
        Index("ix_yansi_knowledge_bundles_business", "business_id"),
        Index("ix_yansi_knowledge_bundles_owner", "owner_user_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("business_profiles.id", ondelete="CASCADE"),
        nullable=True,
    )
    owner_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("production_users.id", ondelete="CASCADE"),
        nullable=False,
    )
    title = Column(String(200), nullable=False, default="")
    access_scope = Column(String(32), nullable=False, default="private", server_default="private")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class YansiKnowledgeBundleVersion(Base):
    """Immutable sealed knowledge snapshot. New facts require a new version row."""

    __tablename__ = "yansi_knowledge_bundle_versions"
    __table_args__ = (
        UniqueConstraint(
            "bundle_id",
            "version",
            name="uq_yansi_knowledge_bundle_versions_bundle_version",
        ),
        CheckConstraint(
            "status IN ('draft', 'sealed')",
            name="ck_yansi_knowledge_bundle_versions_status",
        ),
        CheckConstraint("version >= 1", name="ck_yansi_knowledge_bundle_versions_version"),
        Index("ix_yansi_knowledge_bundle_versions_bundle", "bundle_id"),
        Index("ix_yansi_knowledge_bundle_versions_status", "status"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bundle_id = Column(
        UUID(as_uuid=True),
        ForeignKey("yansi_knowledge_bundles.id", ondelete="CASCADE"),
        nullable=False,
    )
    version = Column(Integer, nullable=False)
    status = Column(String(16), nullable=False, default="draft", server_default="draft")
    # Canonical ordered items + digests (no private storage locators in public DTO path).
    items_manifest = Column(JSON, nullable=False, default=list)
    bundle_hash = Column(String(64), nullable=False)
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("production_users.id", ondelete="CASCADE"),
        nullable=False,
    )
    approved_by = Column(UUID(as_uuid=True), ForeignKey("production_users.id"), nullable=True)
    approval_note = Column(String(500), nullable=True)
    sealed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
