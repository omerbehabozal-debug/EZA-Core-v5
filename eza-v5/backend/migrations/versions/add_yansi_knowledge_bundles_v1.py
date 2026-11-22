"""Yansı V2 Stage 2A — versioned Knowledge Bundle tables (additive).

Creates bundle identity + immutable version rows and links publication versions
to a sealed bundle version id. Does not convert V1 data.

DO NOT apply to production until Stage 2 writers are reviewed.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision = "add_yansi_knowledge_bundles_v1"
down_revision = "add_yansi_publication_versions_v2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "yansi_knowledge_bundles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("business_id", UUID(as_uuid=True), nullable=True),
        sa.Column("owner_user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("access_scope", sa.String(length=32), nullable=False, server_default="private"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["business_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_user_id"], ["production_users.id"], ondelete="CASCADE"),
        sa.CheckConstraint(
            "access_scope IN ('private', 'business', 'publication_bound')",
            name="ck_yansi_knowledge_bundles_access_scope",
        ),
    )
    op.create_index("ix_yansi_knowledge_bundles_business", "yansi_knowledge_bundles", ["business_id"])
    op.create_index("ix_yansi_knowledge_bundles_owner", "yansi_knowledge_bundles", ["owner_user_id"])

    op.create_table(
        "yansi_knowledge_bundle_versions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("bundle_id", UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="draft"),
        sa.Column("items_manifest", JSONB(), nullable=False),
        sa.Column("bundle_hash", sa.String(length=64), nullable=False),
        sa.Column("created_by", UUID(as_uuid=True), nullable=False),
        sa.Column("approved_by", UUID(as_uuid=True), nullable=True),
        sa.Column("approval_note", sa.String(length=500), nullable=True),
        sa.Column("sealed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["bundle_id"], ["yansi_knowledge_bundles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["production_users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["approved_by"], ["production_users.id"]),
        sa.UniqueConstraint(
            "bundle_id",
            "version",
            name="uq_yansi_knowledge_bundle_versions_bundle_version",
        ),
        sa.CheckConstraint("status IN ('draft', 'sealed')", name="ck_yansi_knowledge_bundle_versions_status"),
        sa.CheckConstraint("version >= 1", name="ck_yansi_knowledge_bundle_versions_version"),
    )
    op.create_index(
        "ix_yansi_knowledge_bundle_versions_bundle",
        "yansi_knowledge_bundle_versions",
        ["bundle_id"],
    )
    op.create_index(
        "ix_yansi_knowledge_bundle_versions_status",
        "yansi_knowledge_bundle_versions",
        ["status"],
    )

    op.add_column(
        "yansi_publication_versions_v2",
        sa.Column("knowledge_bundle_version_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_yansi_publication_versions_v2_bundle_version",
        "yansi_publication_versions_v2",
        "yansi_knowledge_bundle_versions",
        ["knowledge_bundle_version_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_yansi_publication_versions_v2_knowledge_bundle_version_id",
        "yansi_publication_versions_v2",
        ["knowledge_bundle_version_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_yansi_publication_versions_v2_knowledge_bundle_version_id",
        table_name="yansi_publication_versions_v2",
    )
    op.drop_constraint(
        "fk_yansi_publication_versions_v2_bundle_version",
        "yansi_publication_versions_v2",
        type_="foreignkey",
    )
    op.drop_column("yansi_publication_versions_v2", "knowledge_bundle_version_id")
    op.drop_index("ix_yansi_knowledge_bundle_versions_status", table_name="yansi_knowledge_bundle_versions")
    op.drop_index("ix_yansi_knowledge_bundle_versions_bundle", table_name="yansi_knowledge_bundle_versions")
    op.drop_table("yansi_knowledge_bundle_versions")
    op.drop_index("ix_yansi_knowledge_bundles_owner", table_name="yansi_knowledge_bundles")
    op.drop_index("ix_yansi_knowledge_bundles_business", table_name="yansi_knowledge_bundles")
    op.drop_table("yansi_knowledge_bundles")
