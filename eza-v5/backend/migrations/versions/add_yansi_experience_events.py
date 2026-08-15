"""add_yansi_experience_events

Revision ID: add_yansi_experience_events
Revises: add_mirror_journey_phase42_eza_snapshot
Create Date: 2026-08-15

Phase 6.0 durable Yansı started/completed/skipped events.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "add_yansi_experience_events"
down_revision: Union[str, None] = "add_mirror_journey_phase42_eza_snapshot"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector, name: str) -> bool:
    return name in inspector.get_table_names()


def _index_exists(inspector, table: str, name: str) -> bool:
    if not _table_exists(inspector, table):
        return False
    return name in {idx["name"] for idx in inspector.get_indexes(table)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if _table_exists(inspector, "yansi_experience_events"):
        return

    op.create_table(
        "yansi_experience_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("event_id", sa.String(length=36), nullable=False),
        sa.Column("experience_session_id", sa.String(length=36), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("mirror_slug", sa.String(length=128), nullable=False),
        sa.Column("journey_version", sa.Integer(), nullable=False),
        sa.Column("viewer_user_id", sa.String(length=64), nullable=True),
        sa.Column("completed_step_count", sa.Integer(), nullable=True),
        sa.Column("destination_slug", sa.String(length=128), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "received_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", name="uq_yansi_experience_events_event_id"),
    )
    op.create_index(
        "ix_yansi_experience_events_slug_version",
        "yansi_experience_events",
        ["mirror_slug", "journey_version"],
    )
    op.create_index(
        "ix_yansi_experience_events_session",
        "yansi_experience_events",
        ["experience_session_id"],
    )
    op.create_index(
        "ix_yansi_experience_events_received_at",
        "yansi_experience_events",
        ["received_at"],
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_yansi_experience_started_session
        ON yansi_experience_events (experience_session_id)
        WHERE event_type = 'yansi_experience_started'
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_yansi_experience_completed_session
        ON yansi_experience_events (experience_session_id)
        WHERE event_type = 'yansi_experience_completed'
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_yansi_experience_skip_transition
        ON yansi_experience_events (
            experience_session_id, completed_step_count, destination_slug
        )
        WHERE event_type = 'yansi_experience_skipped'
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not _table_exists(inspector, "yansi_experience_events"):
        return
    op.execute("DROP INDEX IF EXISTS uq_yansi_experience_skip_transition")
    op.execute("DROP INDEX IF EXISTS uq_yansi_experience_completed_session")
    op.execute("DROP INDEX IF EXISTS uq_yansi_experience_started_session")
    if _index_exists(inspector, "yansi_experience_events", "ix_yansi_experience_events_received_at"):
        op.drop_index(
            "ix_yansi_experience_events_received_at",
            table_name="yansi_experience_events",
        )
    if _index_exists(inspector, "yansi_experience_events", "ix_yansi_experience_events_session"):
        op.drop_index(
            "ix_yansi_experience_events_session",
            table_name="yansi_experience_events",
        )
    if _index_exists(
        inspector, "yansi_experience_events", "ix_yansi_experience_events_slug_version"
    ):
        op.drop_index(
            "ix_yansi_experience_events_slug_version",
            table_name="yansi_experience_events",
        )
    op.drop_table("yansi_experience_events")
