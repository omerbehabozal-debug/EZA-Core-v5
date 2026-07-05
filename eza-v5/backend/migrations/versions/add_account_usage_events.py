"""add_account_usage_events

Revision ID: add_account_usage_events
Revises: add_mirror_continuation_proofs
Create Date: 2026-07-05

SAINA account tier quota usage events.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "add_account_usage_events"
down_revision: Union[str, None] = "add_mirror_continuation_proofs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector, name: str) -> bool:
    return name in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if _table_exists(inspector, "account_usage_events"):
        return

    op.create_table(
        "account_usage_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(255), nullable=True),
        sa.Column("guest_fingerprint", sa.String(32), nullable=True),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("source_id", sa.String(255), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )
    op.create_index(
        "idx_account_usage_events_user_type_created",
        "account_usage_events",
        ["user_id", "event_type", "created_at"],
    )
    op.create_index(
        "idx_account_usage_events_guest_type_created",
        "account_usage_events",
        ["guest_fingerprint", "event_type", "created_at"],
    )
    op.create_index(
        "idx_account_usage_events_created_at",
        "account_usage_events",
        ["created_at"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _table_exists(inspector, "account_usage_events"):
        return

    op.drop_index("idx_account_usage_events_created_at", table_name="account_usage_events")
    op.drop_index(
        "idx_account_usage_events_guest_type_created",
        table_name="account_usage_events",
    )
    op.drop_index(
        "idx_account_usage_events_user_type_created",
        table_name="account_usage_events",
    )
    op.drop_table("account_usage_events")
