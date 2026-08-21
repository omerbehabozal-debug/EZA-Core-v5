"""add_social_auth_attempts_phase872_v1

Revision ID: add_social_auth_attempts_phase872_v1
Revises: add_user_auth_identities_phase871_v1
Create Date: 2026-08-21

Phase 8.7.2 — server-bound Apple social auth attempts (state + nonce hash).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "add_social_auth_attempts_phase872_v1"
down_revision: Union[str, None] = "add_user_auth_identities_phase871_v1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector, table: str) -> bool:
    return table in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _table_exists(inspector, "social_auth_attempts"):
        op.create_table(
            "social_auth_attempts",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("provider", sa.String(length=32), nullable=False),
            sa.Column("state", sa.String(length=128), nullable=False),
            sa.Column("nonce_hash", sa.String(length=64), nullable=False),
            sa.Column("return_path", sa.String(length=512), nullable=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("state", name="uq_social_auth_attempts_state"),
        )
        op.create_index(
            "ix_social_auth_attempts_provider",
            "social_auth_attempts",
            ["provider"],
            unique=False,
        )
        op.create_index(
            "ix_social_auth_attempts_state",
            "social_auth_attempts",
            ["state"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if _table_exists(inspector, "social_auth_attempts"):
        op.drop_index("ix_social_auth_attempts_state", table_name="social_auth_attempts")
        op.drop_index("ix_social_auth_attempts_provider", table_name="social_auth_attempts")
        op.drop_table("social_auth_attempts")
