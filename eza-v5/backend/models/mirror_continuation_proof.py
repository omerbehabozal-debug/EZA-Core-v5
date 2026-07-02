# -*- coding: utf-8 -*-
"""Server-verified mirror continuation proofs (Faz 2.2)."""

import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from backend.core.utils.dependencies import Base


class MirrorContinuationProof(Base):
    """Proof that a guest/auth continuation started from a public mirror slug."""

    __tablename__ = "mirror_continuation_proofs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    source_mirror_slug = Column(String(64), nullable=False, index=True)
    session_id = Column(String(64), nullable=False, index=True)
    actor_hash = Column(String(64), nullable=False, index=True)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("production_users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    conversation_id = Column(String(128), nullable=True, index=True)
    consumed_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
