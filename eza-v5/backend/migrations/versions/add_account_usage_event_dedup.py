"""add_account_usage_event_dedup

Revision ID: add_account_usage_event_dedup
Revises: add_user_account_tier
Create Date: 2026-07-05

Idempotent quota consume — unique (subject, event_type, source_id).
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect

revision: str = "add_account_usage_event_dedup"
down_revision: Union[str, None] = "add_user_account_tier"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _index_exists(inspector, table: str, name: str) -> bool:
    return name in {idx["name"] for idx in inspector.get_indexes(table)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _index_exists(inspector, "account_usage_events", "uq_account_usage_user_event_source"):
        op.create_index(
            "uq_account_usage_user_event_source",
            "account_usage_events",
            ["user_id", "event_type", "source_id"],
            unique=True,
            postgresql_where="user_id IS NOT NULL AND source_id IS NOT NULL",
        )

    if not _index_exists(inspector, "account_usage_events", "uq_account_usage_guest_event_source"):
        op.create_index(
            "uq_account_usage_guest_event_source",
            "account_usage_events",
            ["guest_fingerprint", "event_type", "source_id"],
            unique=True,
            postgresql_where="guest_fingerprint IS NOT NULL AND source_id IS NOT NULL",
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if _index_exists(inspector, "account_usage_events", "uq_account_usage_guest_event_source"):
        op.drop_index(
            "uq_account_usage_guest_event_source",
            table_name="account_usage_events",
        )

    if _index_exists(inspector, "account_usage_events", "uq_account_usage_user_event_source"):
        op.drop_index(
            "uq_account_usage_user_event_source",
            table_name="account_usage_events",
        )
