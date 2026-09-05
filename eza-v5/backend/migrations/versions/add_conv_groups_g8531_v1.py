"""add_conv_groups_g8531_v1

Revision ID: add_conv_groups_g8531_v1
Revises: add_standalone_yansi_prep_g884_v1
Create Date: 2026-09-05

Phase 8.8G-5.3.1 — client_group_id for idempotent authenticated group
migration mapping + unique (user_id, client_group_id).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "add_conv_groups_g8531_v1"
down_revision: Union[str, None] = "add_standalone_yansi_prep_g884_v1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "conversation_groups",
        sa.Column("client_group_id", sa.String(length=64), nullable=True),
    )
    op.create_index(
        "ix_conversation_groups_client_group_id",
        "conversation_groups",
        ["client_group_id"],
        unique=False,
    )
    op.create_index(
        "ix_conversation_groups_user_sort",
        "conversation_groups",
        ["user_id", "sort_order"],
        unique=False,
    )
    # PostgreSQL/SQLite: multiple NULL client_group_id values are allowed.
    op.create_unique_constraint(
        "uq_conversation_groups_user_client_id",
        "conversation_groups",
        ["user_id", "client_group_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_conversation_groups_user_client_id",
        "conversation_groups",
        type_="unique",
    )
    op.drop_index("ix_conversation_groups_user_sort", table_name="conversation_groups")
    op.drop_index(
        "ix_conversation_groups_client_group_id",
        table_name="conversation_groups",
    )
    op.drop_column("conversation_groups", "client_group_id")
