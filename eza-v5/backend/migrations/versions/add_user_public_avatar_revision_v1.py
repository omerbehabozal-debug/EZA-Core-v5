"""add_user_public_avatar_revision_v1

Revision ID: add_user_public_avatar_revision_v1
Revises: add_user_public_avatar_blob_v1
Create Date: 2026-08-30

Server-authoritative monotonic avatar revision for cache busting.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "add_user_public_avatar_revision_v1"
down_revision: Union[str, None] = "add_user_public_avatar_blob_v1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(inspector, table: str, column: str) -> bool:
    if table not in inspector.get_table_names():
        return False
    return column in {c["name"] for c in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not _column_exists(inspector, "production_users", "public_avatar_revision"):
        op.add_column(
            "production_users",
            sa.Column(
                "public_avatar_revision",
                sa.BigInteger(),
                nullable=False,
                server_default="0",
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if _column_exists(inspector, "production_users", "public_avatar_revision"):
        op.drop_column("production_users", "public_avatar_revision")
