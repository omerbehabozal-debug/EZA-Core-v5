"""Yansı V2 Stage 1 fix — versioned publication history (additive).

Creates yansi_publication_versions_v2 as the authoritative per-version store and
adds MirrorNetworkNode.current_v2_publication_version as a non-authoritative
cache/pointer only.

Does not backfill or convert V1 frozen publications.
DO NOT apply to production until Stage 2 writers are ready and reviewed.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision = "add_yansi_publication_versions_v2"
down_revision = "add_business_cover_ai_proposals_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "yansi_publication_versions_v2",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("node_id", UUID(as_uuid=True), nullable=False),
        sa.Column("publication_version", sa.Integer(), nullable=False),
        sa.Column("contract_version", sa.String(length=64), nullable=False),
        sa.Column("response_policy", sa.String(length=16), nullable=False),
        sa.Column("content_kind", sa.String(length=16), nullable=False),
        sa.Column("content_manifest", JSONB(), nullable=False),
        sa.Column("manifest_hash", sa.String(length=64), nullable=False),
        sa.Column("contract_hash", sa.String(length=64), nullable=False),
        sa.Column("knowledge_bundle_version_ref", sa.String(length=128), nullable=True),
        sa.Column("approval_metadata", JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["node_id"],
            ["mirror_network_nodes.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "node_id",
            "publication_version",
            name="uq_yansi_publication_versions_v2_node_version",
        ),
        sa.CheckConstraint(
            "response_policy IN ('open', 'grounded')",
            name="ck_yansi_publication_versions_v2_policy",
        ),
        sa.CheckConstraint(
            "content_kind IN ('conversation', 'image', 'video', 'mixed')",
            name="ck_yansi_publication_versions_v2_kind",
        ),
        sa.CheckConstraint(
            "publication_version >= 1",
            name="ck_yansi_publication_versions_v2_version",
        ),
    )
    op.create_index(
        "ix_yansi_publication_versions_v2_node_id",
        "yansi_publication_versions_v2",
        ["node_id"],
    )
    op.create_index(
        "ix_yansi_publication_versions_v2_node_created",
        "yansi_publication_versions_v2",
        ["node_id", "created_at"],
    )

    op.add_column(
        "mirror_network_nodes",
        sa.Column("current_v2_publication_version", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("mirror_network_nodes", "current_v2_publication_version")
    op.drop_index(
        "ix_yansi_publication_versions_v2_node_created",
        table_name="yansi_publication_versions_v2",
    )
    op.drop_index(
        "ix_yansi_publication_versions_v2_node_id",
        table_name="yansi_publication_versions_v2",
    )
    op.drop_table("yansi_publication_versions_v2")
