"""add_mirror_journey_phase4_freeze

Revision ID: add_mirror_journey_phase4_freeze
Revises: add_mirror_journey_window_identity
Create Date: 2026-08-11

Phase 4 durable freeze:
- freeze_status / frozen_at on mirror_network_nodes
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "add_mirror_journey_phase4_freeze"
down_revision: Union[str, None] = "add_mirror_journey_window_identity"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(inspector, table: str, name: str) -> bool:
    return name in {col["name"] for col in inspector.get_columns(table)}


def _table_exists(inspector, table: str) -> bool:
    return table in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _table_exists(inspector, "mirror_network_nodes"):
        return

    if not _column_exists(inspector, "mirror_network_nodes", "freeze_status"):
        op.add_column(
            "mirror_network_nodes",
            sa.Column(
                "freeze_status",
                sa.String(length=32),
                nullable=False,
                server_default="non_frozen",
            ),
        )
        op.create_index(
            "ix_mirror_network_nodes_freeze_status",
            "mirror_network_nodes",
            ["freeze_status"],
        )

    if not _column_exists(inspector, "mirror_network_nodes", "frozen_at"):
        op.add_column(
            "mirror_network_nodes",
            sa.Column("frozen_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _table_exists(inspector, "mirror_network_nodes"):
        return

    if _column_exists(inspector, "mirror_network_nodes", "frozen_at"):
        op.drop_column("mirror_network_nodes", "frozen_at")

    if _column_exists(inspector, "mirror_network_nodes", "freeze_status"):
        try:
            op.drop_index(
                "ix_mirror_network_nodes_freeze_status",
                table_name="mirror_network_nodes",
            )
        except Exception:
            pass
        op.drop_column("mirror_network_nodes", "freeze_status")
