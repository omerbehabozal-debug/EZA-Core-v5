"""add_mirror_journey_phase42_eza_snapshot

Revision ID: add_mirror_journey_phase42_eza_snapshot
Revises: add_mirror_journey_phase4_freeze
Create Date: 2026-08-11

Phase 4.2 — durable per-step frozen EZA interaction snapshot on mirror_journey_steps.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "add_mirror_journey_phase42_eza_snapshot"
down_revision: Union[str, None] = "add_mirror_journey_phase4_freeze"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(inspector, table: str, name: str) -> bool:
    return name in {col["name"] for col in inspector.get_columns(table)}


def _table_exists(inspector, table: str) -> bool:
    return table in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not _table_exists(inspector, "mirror_journey_steps"):
        return
    if not _column_exists(inspector, "mirror_journey_steps", "eza_snapshot"):
        op.add_column(
            "mirror_journey_steps",
            sa.Column("eza_snapshot", sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not _table_exists(inspector, "mirror_journey_steps"):
        return
    if _column_exists(inspector, "mirror_journey_steps", "eza_snapshot"):
        op.drop_column("mirror_journey_steps", "eza_snapshot")
