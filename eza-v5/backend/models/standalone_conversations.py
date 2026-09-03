# -*- coding: utf-8 -*-
"""Durable authenticated standalone conversations — Phase 8.8G-1."""

from __future__ import annotations

import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.sql import func

from backend.core.utils.dependencies import Base

CONVERSATION_TYPE_DIRECT = "direct"
CONVERSATION_TYPE_MIRROR = "mirror"
CONVERSATION_TYPE_MIRROR_BRANCH = "mirror_branch"
CONVERSATION_TYPE_CONTINUATION = "continuation"

CONVERSATION_TYPES = frozenset(
    {
        CONVERSATION_TYPE_DIRECT,
        CONVERSATION_TYPE_MIRROR,
        CONVERSATION_TYPE_MIRROR_BRANCH,
        CONVERSATION_TYPE_CONTINUATION,
    }
)

MESSAGE_ROLE_USER = "user"
MESSAGE_ROLE_ASSISTANT = "assistant"

MESSAGE_ROLES = frozenset({MESSAGE_ROLE_USER, MESSAGE_ROLE_ASSISTANT})


class StandaloneConversation(Base):
    """Server-authoritative authenticated standalone conversation."""

    __tablename__ = "standalone_conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("production_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_conversation_id = Column(String(64), nullable=False)
    title = Column(String(200), nullable=True)
    title_pinned = Column(Boolean, nullable=False, default=False, server_default="false")
    pinned = Column(Boolean, nullable=False, default=False, server_default="false")
    preview = Column(String(500), nullable=True)
    conversation_type = Column(String(32), nullable=False, default=CONVERSATION_TYPE_DIRECT)
    parent_conversation_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    parent_client_conversation_id = Column(String(64), nullable=True)
    source_yansi_slug = Column(String(120), nullable=True, index=True)
    group_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    tree_metadata = Column(JSON, nullable=True)
    conversation_scene_url = Column(Text, nullable=True)
    conversation_scene_source = Column(String(32), nullable=True)
    conversation_scene_slug = Column(String(120), nullable=True)
    message_count = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_message_at = Column(DateTime(timezone=True), nullable=True)
    archived_at = Column(DateTime(timezone=True), nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "client_conversation_id",
            name="uq_standalone_conv_user_client",
        ),
        CheckConstraint(
            "conversation_type IN ('direct', 'mirror', 'mirror_branch', 'continuation')",
            name="ck_standalone_conversations_type",
        ),
        Index("ix_standalone_conv_user_last_msg", "user_id", "last_message_at"),
        Index("ix_standalone_conv_user_updated", "user_id", "updated_at"),
    )


class StandaloneConversationMessage(Base):
    """Ordered message row inside a standalone conversation."""

    __tablename__ = "standalone_conversation_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("standalone_conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_message_id = Column(String(64), nullable=False)
    role = Column(String(16), nullable=False)
    content = Column(Text, nullable=False)
    sequence = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    message_metadata = Column("metadata", JSON, nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "conversation_id",
            "sequence",
            name="uq_standalone_msg_conv_seq",
        ),
        UniqueConstraint(
            "conversation_id",
            "client_message_id",
            name="uq_standalone_msg_conv_client",
        ),
        CheckConstraint(
            "role IN ('user', 'assistant')",
            name="ck_standalone_conversation_messages_role",
        ),
    )


YANSI_PREPARATION_STATUS_READY = "ready"
YANSI_PREPARATION_STATUSES = frozenset({YANSI_PREPARATION_STATUS_READY})


class StandaloneYansiPreparation(Base):
    """Authenticated unpublished Yansı artifact — Phase 8.8G-4.

    Private owner data. Must never be treated as a published network node.
    """

    __tablename__ = "standalone_yansi_preparations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("production_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    conversation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("standalone_conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_identity = Column(String(160), nullable=False)
    journey_id = Column(String(64), nullable=False)
    journey_version = Column(Integer, nullable=False)
    window_index = Column(Integer, nullable=False)
    window_hash = Column(String(128), nullable=False)
    selected_steps_hash = Column(String(128), nullable=False)
    source_block_hash = Column(String(128), nullable=True)
    generation_id = Column(String(128), nullable=False)
    status = Column(String(32), nullable=False, default=YANSI_PREPARATION_STATUS_READY)
    public_title = Column(String(200), nullable=False)
    public_summary = Column(String(2000), nullable=False)
    continuation_context = Column(String(2000), nullable=True)
    scene_image_url = Column(Text, nullable=False)
    scene_asset_id = Column(String(128), nullable=True)
    scene_focal_x = Column(Float, nullable=True)
    scene_focal_y = Column(Float, nullable=True)
    sealed_lineage = Column(JSON, nullable=False)
    sealed_public_landing = Column(JSON, nullable=True)
    published_slug = Column(String(120), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "conversation_id",
            "source_identity",
            name="uq_standalone_yansi_prep_source",
        ),
        UniqueConstraint(
            "published_slug",
            name="uq_standalone_yansi_prep_published_slug",
        ),
        CheckConstraint(
            "status IN ('ready')",
            name="ck_standalone_yansi_prep_status",
        ),
        CheckConstraint(
            "scene_focal_x IS NULL OR (scene_focal_x >= 0 AND scene_focal_x <= 1)",
            name="ck_standalone_yansi_prep_focal_x",
        ),
        CheckConstraint(
            "scene_focal_y IS NULL OR (scene_focal_y >= 0 AND scene_focal_y <= 1)",
            name="ck_standalone_yansi_prep_focal_y",
        ),
        Index("ix_standalone_yansi_prep_user_conv", "user_id", "conversation_id"),
    )
