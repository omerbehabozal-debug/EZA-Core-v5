"""add_user_public_avatar_url_v1

Revision ID: add_user_public_avatar_url_v1
Revises: add_user_public_honorific_v1
Create Date: 2026-08-29

Public profile avatar URL on production_users (durable asset path).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "add_user_public_avatar_url_v1"
down_revision: Union[str, None] = "add_user_public_honorific_v1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(inspector, table: str, column: str) -> bool:
    if table not in inspector.get_table_names():
        return False
    return column in {c["name"] for c in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if _column_exists(inspector, "production_users", "public_avatar_url"):
        return
    op.add_column(
        "production_users",
        sa.Column("public_avatar_url", sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not _column_exists(inspector, "production_users", "public_avatar_url"):
        return
    op.drop_column("production_users", "public_avatar_url")
