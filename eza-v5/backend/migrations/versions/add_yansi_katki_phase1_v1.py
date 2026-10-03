"""add_yansi_katki_phase1_v1

Revision ID: add_yansi_katki_phase1_v1
Revises: add_mirror_network_saves_slice5_v1
Create Date: 2026-10-03

Katkılar Phase 1 — contribution and contribution-report persistence.
Target identity is slug + journey_version. No step binding.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "add_yansi_katki_phase1_v1"
down_revision: Union[str, None] = "add_mirror_network_saves_slice5_v1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "yansi_contributions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("journey_version", sa.Integer(), nullable=False),
        sa.Column("contribution_type", sa.String(length=32), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("source_note", sa.Text(), nullable=True),
        sa.Column("contributor_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "visibility",
            sa.String(length=32),
            server_default="visible",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("withdrawn_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("hidden_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("hidden_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.CheckConstraint(
            "contribution_type IN ('verify', 'correction', "
            "'additional_information', 'different_perspective')",
            name="ck_yansi_contributions_type",
        ),
        sa.CheckConstraint(
            "visibility IN ('visible', 'hidden_by_owner', 'hidden_by_trust', 'withdrawn')",
            name="ck_yansi_contributions_visibility",
        ),
        sa.ForeignKeyConstraint(
            ["slug"],
            ["mirror_network_nodes.slug"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["contributor_user_id"],
            ["production_users.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["hidden_by_user_id"],
            ["production_users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("public_id", name="uq_yansi_contributions_public_id"),
    )
    op.create_index(
        "ix_yansi_contributions_contributor_user_id",
        "yansi_contributions",
        ["contributor_user_id"],
    )
    op.create_index(
        "ix_yansi_contributions_slug_version",
        "yansi_contributions",
        ["slug", "journey_version"],
    )
    op.create_index(
        "ix_yansi_contributions_slug_version_visibility",
        "yansi_contributions",
        ["slug", "journey_version", "visibility"],
    )
    op.create_index(
        "uq_yansi_contributions_active_type",
        "yansi_contributions",
        ["contributor_user_id", "slug", "journey_version", "contribution_type"],
        unique=True,
        postgresql_where=sa.text("visibility <> 'withdrawn'"),
    )
    op.create_table(
        "yansi_contribution_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("contribution_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reporter_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reason", sa.String(length=32), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "reason IN ('inappropriate', 'misleading', 'privacy', 'other')",
            name="ck_yansi_contribution_reports_reason",
        ),
        sa.ForeignKeyConstraint(
            ["contribution_id"],
            ["yansi_contributions.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["reporter_user_id"],
            ["production_users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "contribution_id",
            "reporter_user_id",
            name="uq_yansi_contribution_reports_contribution_reporter",
        ),
    )
    op.create_index(
        "ix_yansi_contribution_reports_contribution",
        "yansi_contribution_reports",
        ["contribution_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_yansi_contribution_reports_contribution",
        table_name="yansi_contribution_reports",
    )
    op.drop_table("yansi_contribution_reports")
    op.drop_index(
        "uq_yansi_contributions_active_type",
        table_name="yansi_contributions",
    )
    op.drop_index(
        "ix_yansi_contributions_slug_version_visibility",
        table_name="yansi_contributions",
    )
    op.drop_index(
        "ix_yansi_contributions_slug_version",
        table_name="yansi_contributions",
    )
    op.drop_index(
        "ix_yansi_contributions_contributor_user_id",
        table_name="yansi_contributions",
    )
    op.drop_table("yansi_contributions")
