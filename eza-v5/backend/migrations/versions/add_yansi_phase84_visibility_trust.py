"""add_yansi_phase84_visibility_trust

Revision ID: add_yansi_phase84_visibility_trust
Revises: add_yansi_phase64_signals
Create Date: 2026-08-20

Phase 8.4 — yansi_reports table for minimal user report flow.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "add_yansi_phase84_visibility_trust"
down_revision: Union[str, None] = "add_yansi_phase64_signals"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector, name: str) -> bool:
    return name in inspector.get_table_names()


def _index_exists(inspector, table: str, name: str) -> bool:
    if not _table_exists(inspector, table):
        return False
    return name in {idx["name"] for idx in inspector.get_indexes(table)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if _table_exists(inspector, "yansi_reports"):
        return

    op.create_table(
        "yansi_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("mirror_slug", sa.String(length=64), nullable=False),
        sa.Column("mirror_node_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reporter_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reason", sa.String(length=32), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default="open",
            nullable=False,
        ),
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
            ["reporter_user_id"],
            ["production_users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "mirror_slug",
            "reporter_user_id",
            name="uq_yansi_reports_slug_reporter",
        ),
    )
    op.create_index("ix_yansi_reports_mirror_slug", "yansi_reports", ["mirror_slug"])
    op.create_index(
        "ix_yansi_reports_mirror_node_id", "yansi_reports", ["mirror_node_id"]
    )
    op.create_index(
        "ix_yansi_reports_reporter_user_id", "yansi_reports", ["reporter_user_id"]
    )
    if not _index_exists(inspector, "yansi_reports", "ix_yansi_reports_slug_created"):
        op.create_index(
            "ix_yansi_reports_slug_created",
            "yansi_reports",
            ["mirror_slug", "created_at"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not _table_exists(inspector, "yansi_reports"):
        return
    op.drop_table("yansi_reports")
