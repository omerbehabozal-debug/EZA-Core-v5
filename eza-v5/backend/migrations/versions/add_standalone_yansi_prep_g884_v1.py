"""add_standalone_yansi_prep_g884_v1

Revision ID: add_standalone_yansi_prep_g884_v1
Revises: add_standalone_conversations_g8811_v1
Create Date: 2026-09-03

Phase 8.8G-4 — durable authenticated unpublished Yansı preparations.
Private owner data. Not a published mirror_network_nodes row.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "add_standalone_yansi_prep_g884_v1"
down_revision: Union[str, None] = "add_standalone_conversations_g8811_v1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "standalone_yansi_preparations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_identity", sa.String(length=160), nullable=False),
        sa.Column("journey_id", sa.String(length=64), nullable=False),
        sa.Column("journey_version", sa.Integer(), nullable=False),
        sa.Column("window_index", sa.Integer(), nullable=False),
        sa.Column("window_hash", sa.String(length=128), nullable=False),
        sa.Column("selected_steps_hash", sa.String(length=128), nullable=False),
        sa.Column("source_block_hash", sa.String(length=128), nullable=True),
        sa.Column("generation_id", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="ready"),
        sa.Column("public_title", sa.String(length=200), nullable=False),
        sa.Column("public_summary", sa.String(length=2000), nullable=False),
        sa.Column("continuation_context", sa.String(length=2000), nullable=True),
        sa.Column("scene_image_url", sa.Text(), nullable=False),
        sa.Column("scene_asset_id", sa.String(length=128), nullable=True),
        sa.Column("scene_focal_x", sa.Float(), nullable=True),
        sa.Column("scene_focal_y", sa.Float(), nullable=True),
        sa.Column("sealed_lineage", postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column("sealed_public_landing", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("published_slug", sa.String(length=120), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["production_users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["standalone_conversations.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "user_id",
            "conversation_id",
            "source_identity",
            name="uq_standalone_yansi_prep_source",
        ),
        sa.UniqueConstraint(
            "published_slug",
            name="uq_standalone_yansi_prep_published_slug",
        ),
        sa.CheckConstraint("status IN ('ready')", name="ck_standalone_yansi_prep_status"),
        sa.CheckConstraint(
            "scene_focal_x IS NULL OR (scene_focal_x >= 0 AND scene_focal_x <= 1)",
            name="ck_standalone_yansi_prep_focal_x",
        ),
        sa.CheckConstraint(
            "scene_focal_y IS NULL OR (scene_focal_y >= 0 AND scene_focal_y <= 1)",
            name="ck_standalone_yansi_prep_focal_y",
        ),
    )
    op.create_index(
        "ix_standalone_yansi_preparations_user_id",
        "standalone_yansi_preparations",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_standalone_yansi_preparations_conversation_id",
        "standalone_yansi_preparations",
        ["conversation_id"],
        unique=False,
    )
    op.create_index(
        "ix_standalone_yansi_prep_user_conv",
        "standalone_yansi_preparations",
        ["user_id", "conversation_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_standalone_yansi_prep_user_conv", table_name="standalone_yansi_preparations")
    op.drop_index(
        "ix_standalone_yansi_preparations_conversation_id",
        table_name="standalone_yansi_preparations",
    )
    op.drop_index(
        "ix_standalone_yansi_preparations_user_id",
        table_name="standalone_yansi_preparations",
    )
    op.drop_table("standalone_yansi_preparations")
