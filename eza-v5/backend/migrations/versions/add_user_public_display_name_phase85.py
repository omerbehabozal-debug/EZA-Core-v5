"""add_user_public_display_name_phase85

Revision ID: add_user_public_display_name_phase85
Revises: add_yansi_phase84_visibility_trust
Create Date: 2026-08-20

Phase 8.5 — explicit public_display_name on production_users.
Does NOT backfill from email local-part.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "add_user_public_display_name_phase85"
down_revision: Union[str, None] = "add_yansi_phase84_visibility_trust"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(inspector, table: str, column: str) -> bool:
    if table not in inspector.get_table_names():
        return False
    return column in {c["name"] for c in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if _column_exists(inspector, "production_users", "public_display_name"):
        return
    op.add_column(
        "production_users",
        sa.Column("public_display_name", sa.String(length=48), nullable=True),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not _column_exists(inspector, "production_users", "public_display_name"):
        return
    op.drop_column("production_users", "public_display_name")
