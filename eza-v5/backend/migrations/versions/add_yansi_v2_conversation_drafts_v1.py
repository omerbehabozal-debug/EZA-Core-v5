"""Yansı V2 Stage 01 — conversation draft table for flexible 1–8 frozen Q/A.

Additive only. Does not alter business_yansi_drafts (V1 eight-step Studio).
Does not convert existing image-only V2 publications.

DO NOT apply to production until Stage 01 services are reviewed.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision = "add_yansi_v2_conversation_drafts_v1"
down_revision = "add_yansi_knowledge_bundles_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "yansi_v2_conversation_drafts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("business_id", UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("summary", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("turns", JSONB, nullable=False),
        sa.Column("knowledge_source_pins", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("knowledge_notes", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("cover_asset_id", UUID(as_uuid=True), nullable=True),
        sa.Column("cover_asset_revision", sa.Integer(), nullable=True),
        sa.Column("content_digest", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="draft"),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_by", UUID(as_uuid=True), nullable=False),
        sa.Column("approved_by", UUID(as_uuid=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_revision", sa.Integer(), nullable=True),
        sa.Column("approved_content_digest", sa.String(length=64), nullable=True),
        sa.Column("approval_note", sa.Text(), nullable=True),
        sa.Column("published_node_id", UUID(as_uuid=True), nullable=True),
        sa.Column("published_version", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["business_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["production_users.id"]),
        sa.ForeignKeyConstraint(["approved_by"], ["production_users.id"]),
        sa.ForeignKeyConstraint(["cover_asset_id"], ["business_brand_assets.id"]),
        sa.ForeignKeyConstraint(
            ["published_node_id"],
            ["mirror_network_nodes.id"],
            ondelete="SET NULL",
        ),
        sa.CheckConstraint(
            "status IN ('draft','review','approved','published','archived')",
            name="ck_yansi_v2_conversation_draft_status",
        ),
        sa.CheckConstraint(
            "revision >= 1",
            name="ck_yansi_v2_conversation_draft_revision",
        ),
        sa.UniqueConstraint(
            "id",
            "business_id",
            name="uq_yansi_v2_conversation_draft_tenant",
        ),
    )
    op.create_index(
        "ix_yansi_v2_conversation_drafts_business",
        "yansi_v2_conversation_drafts",
        ["business_id"],
    )
    op.create_index(
        "ix_yansi_v2_conversation_drafts_status",
        "yansi_v2_conversation_drafts",
        ["business_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_yansi_v2_conversation_drafts_status", table_name="yansi_v2_conversation_drafts")
    op.drop_index("ix_yansi_v2_conversation_drafts_business", table_name="yansi_v2_conversation_drafts")
    op.drop_table("yansi_v2_conversation_drafts")
