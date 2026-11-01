"""Queue visual observations without describing any file.

The tables are empty. No analyzer runs, and no Yansı is rewritten.
Downgrade removes only these tables.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "add_media_observations_v1"
down_revision = "add_business_video_cover_jobs_v1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "business_media_observations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("business_id", UUID(as_uuid=True), nullable=False),
        sa.Column("asset_id", UUID(as_uuid=True), nullable=False),
        sa.Column("content_sha256", sa.String(length=64), nullable=False),
        sa.Column("analyzer_profile", sa.String(length=64), nullable=False),
        sa.Column("idempotency_key", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default=sa.text("'queued'")),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("deadline_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("claim_token", sa.String(length=64), nullable=True),
        sa.Column("error_code", sa.String(length=80), nullable=True),
        sa.Column("summary", sa.String(length=400), nullable=True),
        sa.Column("visible_text", sa.String(length=200), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("origin", sa.String(length=16), nullable=False, server_default=sa.text("'upload'")),
        sa.Column("created_by", UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["business_profiles.id"], name="fk_business_media_observation_business"),
        sa.ForeignKeyConstraint(["created_by"], ["production_users.id"], name="fk_business_media_observation_actor"),
        sa.ForeignKeyConstraint(
            ["asset_id", "business_id"],
            ["business_brand_assets.id", "business_brand_assets.business_id"],
            name="fk_business_media_observation_asset",
        ),
        sa.UniqueConstraint("id", "business_id", name="uq_business_media_observation_tenant"),
        sa.UniqueConstraint("business_id", "idempotency_key", name="uq_business_media_observation_key"),
        sa.UniqueConstraint(
            "business_id", "analyzer_profile", "content_sha256",
            name="uq_business_media_observation_bytes",
        ),
        sa.CheckConstraint(
            "status IN ('queued','running','ready','failed')",
            name="ck_business_media_observation_status",
        ),
        sa.CheckConstraint(
            "attempts >= 0 AND attempts <= max_attempts AND max_attempts > 0",
            name="ck_business_media_observation_attempts",
        ),
        sa.CheckConstraint("length(content_sha256) = 64", name="ck_business_media_observation_sha"),
        sa.CheckConstraint("length(idempotency_key) = 64", name="ck_business_media_observation_idem"),
        sa.CheckConstraint("origin IN ('upload','generated')", name="ck_business_media_observation_origin"),
    )
    op.create_index(
        "ix_business_media_observation_claim",
        "business_media_observations",
        ["status", "created_at", "id"],
    )
    op.create_table(
        "business_media_observation_frames",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("observation_id", UUID(as_uuid=True), nullable=False),
        sa.Column("business_id", UUID(as_uuid=True), nullable=False),
        sa.Column("timestamp_ms", sa.Integer(), nullable=False),
        sa.Column("note", sa.String(length=160), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["business_profiles.id"], name="fk_business_media_observation_frame_business"),
        sa.ForeignKeyConstraint(
            ["observation_id", "business_id"],
            ["business_media_observations.id", "business_media_observations.business_id"],
            name="fk_business_media_observation_frame",
        ),
        sa.UniqueConstraint("observation_id", "timestamp_ms", name="uq_business_media_observation_frame"),
        sa.CheckConstraint("timestamp_ms >= 0", name="ck_business_media_observation_frame_time"),
    )
    op.create_index(
        "ix_business_media_observation_frame_brand",
        "business_media_observation_frames",
        ["business_id"],
    )


def downgrade():
    op.drop_index("ix_business_media_observation_frame_brand", table_name="business_media_observation_frames")
    op.drop_table("business_media_observation_frames")
    op.drop_index("ix_business_media_observation_claim", table_name="business_media_observations")
    op.drop_table("business_media_observations")
