"""add_user_auth_identities_phase871_v1

Revision ID: add_user_auth_identities_phase871_v1
Revises: add_user_public_display_name_phase85
Create Date: 2026-08-21

Phase 8.7.1 — social auth identities + nullable password_hash for social-only users.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "add_user_auth_identities_phase871_v1"
down_revision: Union[str, None] = "add_user_public_display_name_phase85"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector, table: str) -> bool:
    return table in inspector.get_table_names()


def _column_nullable(inspector, table: str, column: str) -> bool | None:
    if table not in inspector.get_table_names():
        return None
    for col in inspector.get_columns(table):
        if col["name"] == column:
            return bool(col.get("nullable"))
    return None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    nullable = _column_nullable(inspector, "production_users", "password_hash")
    if nullable is False:
        op.alter_column(
            "production_users",
            "password_hash",
            existing_type=sa.String(length=255),
            nullable=True,
        )

    if not _table_exists(inspector, "user_auth_identities"):
        op.create_table(
            "user_auth_identities",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("user_id", sa.UUID(), nullable=False),
            sa.Column("provider", sa.String(length=32), nullable=False),
            sa.Column("provider_subject", sa.String(length=255), nullable=False),
            sa.Column("email_at_link", sa.String(length=255), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(
                ["user_id"],
                ["production_users.id"],
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "provider",
                "provider_subject",
                name="uq_user_auth_identities_provider_subject",
            ),
        )
        op.create_index(
            "ix_user_auth_identities_user_id",
            "user_auth_identities",
            ["user_id"],
            unique=False,
        )
        op.create_index(
            "ix_user_auth_identities_provider",
            "user_auth_identities",
            ["provider"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if _table_exists(inspector, "user_auth_identities"):
        op.drop_index("ix_user_auth_identities_provider", table_name="user_auth_identities")
        op.drop_index("ix_user_auth_identities_user_id", table_name="user_auth_identities")
        op.drop_table("user_auth_identities")
    # Do not force password_hash NOT NULL on downgrade (may have social-only rows).
