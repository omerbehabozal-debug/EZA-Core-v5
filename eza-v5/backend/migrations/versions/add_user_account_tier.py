"""add_user_account_tier

Revision ID: add_user_account_tier
Revises: add_account_usage_events
Create Date: 2026-07-05

SAINA account tier storage (mini/standard) alongside legacy mirror_plan.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "add_user_account_tier"
down_revision: Union[str, None] = "add_account_usage_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(inspector, table: str, column: str) -> bool:
    return column in {col["name"] for col in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _column_exists(inspector, "production_users", "account_tier"):
        op.add_column(
            "production_users",
            sa.Column("account_tier", sa.String(length=20), nullable=True),
        )
        op.create_index(
            "ix_production_users_account_tier",
            "production_users",
            ["account_tier"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if _column_exists(inspector, "production_users", "account_tier"):
        op.drop_index("ix_production_users_account_tier", table_name="production_users")
        op.drop_column("production_users", "account_tier")
