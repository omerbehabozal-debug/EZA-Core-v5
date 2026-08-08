"""add_mirror_journey_window_identity

Revision ID: add_mirror_journey_window_identity
Revises: add_mirror_journey_identity_pass_closure
Create Date: 2026-08-09

Phase 2 production closure:
- window_index / window_start / window_end on mirror_network_nodes
- source_order on mirror_journey_steps
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "add_mirror_journey_window_identity"
down_revision: Union[str, None] = "add_mirror_journey_identity_pass_closure"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(inspector, table: str, name: str) -> bool:
    return name in {col["name"] for col in inspector.get_columns(table)}


def _table_exists(inspector, table: str) -> bool:
    return table in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if _table_exists(inspector, "mirror_network_nodes"):
        if not _column_exists(inspector, "mirror_network_nodes", "window_index"):
            op.add_column(
                "mirror_network_nodes",
                sa.Column("window_index", sa.Integer(), nullable=True),
            )
        if not _column_exists(inspector, "mirror_network_nodes", "window_start"):
            op.add_column(
                "mirror_network_nodes",
                sa.Column("window_start", sa.Integer(), nullable=True),
            )
        if not _column_exists(inspector, "mirror_network_nodes", "window_end"):
            op.add_column(
                "mirror_network_nodes",
                sa.Column("window_end", sa.Integer(), nullable=True),
            )

    if _table_exists(inspector, "mirror_journey_steps"):
        if not _column_exists(inspector, "mirror_journey_steps", "source_order"):
            op.add_column(
                "mirror_journey_steps",
                sa.Column("source_order", sa.Integer(), nullable=True),
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if _table_exists(inspector, "mirror_journey_steps"):
        if _column_exists(inspector, "mirror_journey_steps", "source_order"):
            op.drop_column("mirror_journey_steps", "source_order")

    if _table_exists(inspector, "mirror_network_nodes"):
        for col in ("window_end", "window_start", "window_index"):
            if _column_exists(inspector, "mirror_network_nodes", col):
                op.drop_column("mirror_network_nodes", col)
