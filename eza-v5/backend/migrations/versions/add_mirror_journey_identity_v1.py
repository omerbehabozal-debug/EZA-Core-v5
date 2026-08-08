"""add_mirror_journey_identity_v1

Revision ID: add_mirror_journey_identity_v1
Revises: add_account_usage_event_dedup
Create Date: 2026-08-08

Phase 1 — Journey identity (RFC):
- artifact_kind + journey_version on mirror_network_nodes
- mirror_journey_steps table (empty until Review 8)
- drop unique (user_id, conversation_id) so one conversation may own N journeys
- non-unique provenance index on (user_id, conversation_id)
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "add_mirror_journey_identity_v1"
down_revision: Union[str, None] = "add_account_usage_event_dedup"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _index_exists(inspector, table: str, name: str) -> bool:
    return name in {idx["name"] for idx in inspector.get_indexes(table)}


def _column_exists(inspector, table: str, name: str) -> bool:
    return name in {col["name"] for col in inspector.get_columns(table)}


def _table_exists(inspector, table: str) -> bool:
    return table in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if _table_exists(inspector, "mirror_network_nodes"):
        if not _column_exists(inspector, "mirror_network_nodes", "artifact_kind"):
            op.add_column(
                "mirror_network_nodes",
                sa.Column(
                    "artifact_kind",
                    sa.String(32),
                    nullable=False,
                    server_default="legacy_landing",
                ),
            )
        if not _column_exists(inspector, "mirror_network_nodes", "journey_version"):
            op.add_column(
                "mirror_network_nodes",
                sa.Column(
                    "journey_version",
                    sa.Integer(),
                    nullable=False,
                    server_default="1",
                ),
            )
        if not _index_exists(inspector, "mirror_network_nodes", "ix_mirror_network_nodes_artifact_kind"):
            op.create_index(
                "ix_mirror_network_nodes_artifact_kind",
                "mirror_network_nodes",
                ["artifact_kind"],
            )

        # Drop conversation uniqueness — journeyId is the publish identity.
        if _index_exists(inspector, "mirror_network_nodes", "uq_mirror_network_nodes_user_conversation"):
            op.drop_index(
                "uq_mirror_network_nodes_user_conversation",
                table_name="mirror_network_nodes",
            )

        if not _index_exists(inspector, "mirror_network_nodes", "ix_mirror_network_nodes_user_conversation"):
            op.create_index(
                "ix_mirror_network_nodes_user_conversation",
                "mirror_network_nodes",
                ["user_id", "conversation_id"],
            )

    if not _table_exists(inspector, "mirror_journey_steps"):
        op.create_table(
            "mirror_journey_steps",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("journey_slug", sa.String(length=64), nullable=False),
            sa.Column("step_index", sa.Integer(), nullable=False),
            sa.Column("source_user_message_id", sa.String(length=128), nullable=True),
            sa.Column("source_assistant_message_id", sa.String(length=128), nullable=True),
            sa.Column("public_question", sa.Text(), nullable=False),
            sa.Column("public_answer", sa.Text(), nullable=False),
            sa.Column("question_hash", sa.String(length=64), nullable=True),
            sa.Column("answer_hash", sa.String(length=64), nullable=True),
            sa.Column("sanitization_flags", sa.JSON(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(
                ["journey_slug"],
                ["mirror_network_nodes.slug"],
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "journey_slug",
                "step_index",
                name="uq_mirror_journey_steps_slug_index",
            ),
        )
        op.create_index(
            "ix_mirror_journey_steps_journey_slug",
            "mirror_journey_steps",
            ["journey_slug"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if _table_exists(inspector, "mirror_journey_steps"):
        op.drop_table("mirror_journey_steps")

    if _table_exists(inspector, "mirror_network_nodes"):
        if _index_exists(inspector, "mirror_network_nodes", "ix_mirror_network_nodes_user_conversation"):
            op.drop_index(
                "ix_mirror_network_nodes_user_conversation",
                table_name="mirror_network_nodes",
            )
        # Recreate unique constraint only if no duplicates exist.
        duplicates = bind.execute(
            sa.text(
                """
                SELECT user_id, conversation_id, COUNT(*) AS row_count
                FROM mirror_network_nodes
                WHERE conversation_id IS NOT NULL
                GROUP BY user_id, conversation_id
                HAVING COUNT(*) > 1
                """
            )
        ).fetchall()
        if not duplicates and not _index_exists(
            inspector, "mirror_network_nodes", "uq_mirror_network_nodes_user_conversation"
        ):
            op.create_index(
                "uq_mirror_network_nodes_user_conversation",
                "mirror_network_nodes",
                ["user_id", "conversation_id"],
                unique=True,
                postgresql_where=sa.text("conversation_id IS NOT NULL"),
            )

        if _index_exists(inspector, "mirror_network_nodes", "ix_mirror_network_nodes_artifact_kind"):
            op.drop_index(
                "ix_mirror_network_nodes_artifact_kind",
                table_name="mirror_network_nodes",
            )
        if _column_exists(inspector, "mirror_network_nodes", "journey_version"):
            op.drop_column("mirror_network_nodes", "journey_version")
        if _column_exists(inspector, "mirror_network_nodes", "artifact_kind"):
            op.drop_column("mirror_network_nodes", "artifact_kind")
