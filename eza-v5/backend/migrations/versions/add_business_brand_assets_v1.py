"""Independent brand assets and optional knowledge confirmations.

Assets are not children of one knowledge version. A link records which
published version an editor confirmed. This revision is local until a later
production approval. Downgrade drops only these two empty-capable tables.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "add_business_brand_assets_v1"
down_revision = "add_business_knowledge_chunks_fts_v1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "business_brand_assets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("business_id", UUID(as_uuid=True), nullable=False),
        sa.Column("asset_type", sa.String(length=16), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("caption", sa.String(length=500), nullable=True),
        sa.Column("locator_kind", sa.String(length=16), nullable=True),
        sa.Column("locator", sa.String(length=1000), nullable=True),
        sa.Column("latitude", sa.Numeric(8, 6), nullable=True),
        sa.Column("longitude", sa.Numeric(9, 6), nullable=True),
        sa.Column("public_allowed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="draft"),
        sa.Column("created_by", UUID(as_uuid=True), nullable=False),
        sa.Column("approved_by", UUID(as_uuid=True), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["business_profiles.id"], name="fk_business_brand_asset_business"),
        sa.ForeignKeyConstraint(["created_by"], ["production_users.id"], name="fk_business_brand_asset_creator"),
        sa.ForeignKeyConstraint(["approved_by"], ["production_users.id"], name="fk_business_brand_asset_approver"),
        sa.UniqueConstraint("id", "business_id", name="uq_business_brand_asset_tenant"),
        sa.CheckConstraint("asset_type IN ('image','video','place','link')", name="ck_business_brand_asset_type"),
        sa.CheckConstraint(
            "status IN ('draft','review','approved','published','archived')",
            name="ck_business_brand_asset_status",
        ),
        sa.CheckConstraint(
            "("
            "asset_type = 'place' AND latitude IS NOT NULL AND longitude IS NOT NULL "
            "AND latitude >= -90 AND latitude <= 90 AND longitude >= -180 AND longitude <= 180 "
            "AND locator IS NULL AND locator_kind IS NULL"
            ") OR ("
            "asset_type = 'link' AND locator IS NOT NULL AND locator_kind = 'https' "
            "AND latitude IS NULL AND longitude IS NULL"
            ") OR ("
            "asset_type IN ('image','video') AND locator IS NOT NULL "
            "AND locator_kind IN ('https','storage') AND latitude IS NULL AND longitude IS NULL"
            ")",
            name="ck_business_brand_asset_payload",
        ),
    )
    op.create_index("ix_business_brand_assets_business_id", "business_brand_assets", ["business_id"])
    op.create_table(
        "business_knowledge_asset_links",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("business_id", UUID(as_uuid=True), nullable=False),
        sa.Column("asset_id", UUID(as_uuid=True), nullable=False),
        sa.Column("item_id", UUID(as_uuid=True), nullable=False),
        sa.Column("confirmed_version_id", UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["business_profiles.id"], name="fk_business_asset_link_business"),
        sa.ForeignKeyConstraint(
            ["asset_id", "business_id"],
            ["business_brand_assets.id", "business_brand_assets.business_id"],
            name="fk_business_asset_link_asset",
        ),
        sa.ForeignKeyConstraint(
            ["confirmed_version_id", "business_id", "item_id"],
            [
                "business_knowledge_versions.id",
                "business_knowledge_versions.business_id",
                "business_knowledge_versions.item_id",
            ],
            name="fk_business_asset_link_version",
        ),
        sa.UniqueConstraint("asset_id", "item_id", name="uq_business_knowledge_asset_item"),
        sa.CheckConstraint("status IN ('active','retired')", name="ck_business_knowledge_asset_link_status"),
    )
    op.create_index("ix_business_knowledge_asset_links_business_id", "business_knowledge_asset_links", ["business_id"])
    op.create_index("ix_business_knowledge_asset_links_asset_id", "business_knowledge_asset_links", ["asset_id"])
    op.create_index("ix_business_knowledge_asset_links_item_id", "business_knowledge_asset_links", ["item_id"])


def downgrade():
    op.drop_index("ix_business_knowledge_asset_links_item_id", table_name="business_knowledge_asset_links")
    op.drop_index("ix_business_knowledge_asset_links_asset_id", table_name="business_knowledge_asset_links")
    op.drop_index("ix_business_knowledge_asset_links_business_id", table_name="business_knowledge_asset_links")
    op.drop_table("business_knowledge_asset_links")
    op.drop_index("ix_business_brand_assets_business_id", table_name="business_brand_assets")
    op.drop_table("business_brand_assets")
