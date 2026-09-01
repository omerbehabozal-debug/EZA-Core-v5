"""add_standalone_conversations_g881_v1

Revision ID: add_standalone_conversations_g881_v1
Revises: add_user_public_avatar_revision_v1
Create Date: 2026-09-01

Phase 8.8G-1 — durable authenticated standalone conversations + messages.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "add_standalone_conversations_g881_v1"
down_revision: Union[str, None] = "add_user_public_avatar_revision_v1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "standalone_conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_conversation_id", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column("title_pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("preview", sa.String(length=500), nullable=True),
        sa.Column(
            "conversation_type",
            sa.String(length=32),
            nullable=False,
            server_default="direct",
        ),
        sa.Column("parent_conversation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("parent_client_conversation_id", sa.String(length=64), nullable=True),
        sa.Column("source_yansi_slug", sa.String(length=120), nullable=True),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("tree_metadata", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("conversation_scene_url", sa.Text(), nullable=True),
        sa.Column("conversation_scene_source", sa.String(length=32), nullable=True),
        sa.Column("conversation_scene_slug", sa.String(length=120), nullable=True),
        sa.Column("message_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["production_users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "user_id",
            "client_conversation_id",
            name="uq_standalone_conv_user_client",
        ),
    )
    op.create_index(
        "ix_standalone_conversations_user_id",
        "standalone_conversations",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_standalone_conv_user_last_msg",
        "standalone_conversations",
        ["user_id", "last_message_at"],
        unique=False,
    )
    op.create_index(
        "ix_standalone_conv_user_updated",
        "standalone_conversations",
        ["user_id", "updated_at"],
        unique=False,
    )
    op.create_index(
        "ix_standalone_conversations_parent_conversation_id",
        "standalone_conversations",
        ["parent_conversation_id"],
        unique=False,
    )
    op.create_index(
        "ix_standalone_conversations_source_yansi_slug",
        "standalone_conversations",
        ["source_yansi_slug"],
        unique=False,
    )
    op.create_index(
        "ix_standalone_conversations_group_id",
        "standalone_conversations",
        ["group_id"],
        unique=False,
    )

    op.create_table(
        "standalone_conversation_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_message_id", sa.String(length=64), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("metadata", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["standalone_conversations.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "conversation_id",
            "sequence",
            name="uq_standalone_msg_conv_seq",
        ),
        sa.UniqueConstraint(
            "conversation_id",
            "client_message_id",
            name="uq_standalone_msg_conv_client",
        ),
    )
    op.create_index(
        "ix_standalone_conversation_messages_conversation_id",
        "standalone_conversation_messages",
        ["conversation_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_standalone_conversation_messages_conversation_id",
        table_name="standalone_conversation_messages",
    )
    op.drop_table("standalone_conversation_messages")
    op.drop_index("ix_standalone_conversations_group_id", table_name="standalone_conversations")
    op.drop_index(
        "ix_standalone_conversations_source_yansi_slug",
        table_name="standalone_conversations",
    )
    op.drop_index(
        "ix_standalone_conversations_parent_conversation_id",
        table_name="standalone_conversations",
    )
    op.drop_index("ix_standalone_conv_user_updated", table_name="standalone_conversations")
    op.drop_index("ix_standalone_conv_user_last_msg", table_name="standalone_conversations")
    op.drop_index("ix_standalone_conversations_user_id", table_name="standalone_conversations")
    op.drop_table("standalone_conversations")
