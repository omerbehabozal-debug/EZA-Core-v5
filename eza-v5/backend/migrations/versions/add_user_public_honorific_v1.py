"""add_user_public_honorific_v1

Revision ID: add_user_public_honorific_v1
Revises: add_social_auth_attempts_phase872_v1
Create Date: 2026-08-22

Public honorific on production_users (curious | bilgin).
NULL means default curious via resolver — no backfill.
Does not copy plan, role, or email.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "add_user_public_honorific_v1"
down_revision: Union[str, None] = "add_social_auth_attempts_phase872_v1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(inspector, table: str, column: str) -> bool:
    if table not in inspector.get_table_names():
        return False
    return column in {c["name"] for c in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if _column_exists(inspector, "production_users", "public_honorific"):
        return
    op.add_column(
        "production_users",
        sa.Column("public_honorific", sa.String(length=16), nullable=True),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not _column_exists(inspector, "production_users", "public_honorific"):
        return
    op.drop_column("production_users", "public_honorific")
