"""add_conversation_groups

Revision ID: add_conversation_groups
Revises: add_mirror_network_nodes
Create Date: 2026-06-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "add_conversation_groups"
down_revision: Union[str, None] = "add_mirror_network_nodes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "conversation_groups",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("guest_token", sa.String(length=128), nullable=True),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False, server_default="manual"),
        sa.Column("parent_group_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["production_users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_conversation_groups_user_id", "conversation_groups", ["user_id"], unique=False)
    op.create_index("ix_conversation_groups_guest_token", "conversation_groups", ["guest_token"], unique=False)
    op.create_index("ix_conversation_groups_source", "conversation_groups", ["source"], unique=False)
    op.create_index("ix_conversation_groups_parent_group_id", "conversation_groups", ["parent_group_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_conversation_groups_parent_group_id", table_name="conversation_groups")
    op.drop_index("ix_conversation_groups_source", table_name="conversation_groups")
    op.drop_index("ix_conversation_groups_guest_token", table_name="conversation_groups")
    op.drop_index("ix_conversation_groups_user_id", table_name="conversation_groups")
    op.drop_table("conversation_groups")
