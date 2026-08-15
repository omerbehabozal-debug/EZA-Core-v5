"""add_yansi_phase64_signals

Revision ID: add_yansi_phase64_signals
Revises: add_yansi_experience_events
Create Date: 2026-08-15

Phase 6.4 durable exposure + own-continuation precursor events.
Additive only — does not alter yansi_experience_events or Journey tables.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "add_yansi_phase64_signals"
down_revision: Union[str, None] = "add_yansi_experience_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector, name: str) -> bool:
    return name in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not _table_exists(inspector, "yansi_exposure_events"):
        op.create_table(
            "yansi_exposure_events",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("event_id", sa.String(length=36), nullable=False),
            sa.Column("exposure_session_id", sa.String(length=36), nullable=False),
            sa.Column("mirror_slug", sa.String(length=128), nullable=False),
            sa.Column("journey_version", sa.Integer(), nullable=False),
            sa.Column("context", sa.String(length=32), nullable=False),
            sa.Column("viewer_user_id", sa.String(length=64), nullable=True),
            sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "received_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("event_id", name="uq_yansi_exposure_events_event_id"),
            sa.UniqueConstraint(
                "exposure_session_id",
                "mirror_slug",
                "journey_version",
                "context",
                name="uq_yansi_exposure_session_target_context",
            ),
        )
        op.create_index(
            "ix_yansi_exposure_events_slug_version",
            "yansi_exposure_events",
            ["mirror_slug", "journey_version"],
        )
        op.create_index(
            "ix_yansi_exposure_events_context",
            "yansi_exposure_events",
            ["mirror_slug", "context"],
        )

    if not _table_exists(inspector, "yansi_own_continuation_events"):
        op.create_table(
            "yansi_own_continuation_events",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("event_id", sa.String(length=36), nullable=False),
            sa.Column("continuation_session_id", sa.String(length=64), nullable=False),
            sa.Column("origin_mirror_slug", sa.String(length=128), nullable=False),
            sa.Column("origin_journey_version", sa.Integer(), nullable=True),
            sa.Column("viewer_user_id", sa.String(length=64), nullable=True),
            sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "received_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "event_id", name="uq_yansi_own_continuation_event_id"
            ),
            sa.UniqueConstraint(
                "continuation_session_id",
                name="uq_yansi_own_continuation_session",
            ),
        )
        op.create_index(
            "ix_yansi_own_continuation_origin",
            "yansi_own_continuation_events",
            ["origin_mirror_slug"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if _table_exists(inspector, "yansi_own_continuation_events"):
        op.drop_table("yansi_own_continuation_events")
    if _table_exists(inspector, "yansi_exposure_events"):
        op.drop_table("yansi_exposure_events")
