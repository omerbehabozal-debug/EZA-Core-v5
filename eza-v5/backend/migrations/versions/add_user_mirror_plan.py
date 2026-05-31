"""add_user_mirror_plan

Revision ID: add_user_mirror_plan
Revises: 20260516_governance
Create Date: 2026-05-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "add_user_mirror_plan"
down_revision: Union[str, None] = "20260516_governance"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "production_users",
        sa.Column("mirror_plan", sa.String(length=20), nullable=False, server_default="free"),
    )
    op.create_index(
        "ix_production_users_mirror_plan",
        "production_users",
        ["mirror_plan"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_production_users_mirror_plan", table_name="production_users")
    op.drop_column("production_users", "mirror_plan")
