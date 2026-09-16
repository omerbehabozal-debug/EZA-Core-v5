"""add_mirror_network_saves_slice5_v1

Revision ID: add_mirror_network_saves_slice5_v1
Revises: add_yansi_identity_gen_g885_v1
Create Date: 2026-09-15

Slice 5 — durable account-bound Save (Merakıma ekle / Meraklarım).
Personal bookmark only: user_id + mirror_slug. No clone, no conversation.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "add_mirror_network_saves_slice5_v1"
down_revision: Union[str, None] = "add_yansi_identity_gen_g885_v1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mirror_network_saves",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("mirror_slug", sa.String(length=64), nullable=False),
        sa.Column("mirror_node_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["mirror_node_id"],
            ["mirror_network_nodes.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["production_users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "mirror_slug",
            name="uq_mirror_network_saves_user_slug",
        ),
    )
    op.create_index(
        "ix_mirror_network_saves_user_id",
        "mirror_network_saves",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_mirror_network_saves_mirror_slug",
        "mirror_network_saves",
        ["mirror_slug"],
        unique=False,
    )
    op.create_index(
        "ix_mirror_network_saves_mirror_node_id",
        "mirror_network_saves",
        ["mirror_node_id"],
        unique=False,
    )
    op.create_index(
        "ix_mirror_network_saves_user_created",
        "mirror_network_saves",
        ["user_id", "created_at"],
        unique=False,
        postgresql_ops={"created_at": "DESC"},
    )


def downgrade() -> None:
    op.drop_index(
        "ix_mirror_network_saves_user_created",
        table_name="mirror_network_saves",
    )
    op.drop_index(
        "ix_mirror_network_saves_mirror_node_id",
        table_name="mirror_network_saves",
    )
    op.drop_index(
        "ix_mirror_network_saves_mirror_slug",
        table_name="mirror_network_saves",
    )
    op.drop_index(
        "ix_mirror_network_saves_user_id",
        table_name="mirror_network_saves",
    )
    op.drop_table("mirror_network_saves")
