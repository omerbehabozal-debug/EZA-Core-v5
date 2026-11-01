"""Queue silent cover preparation without rewriting stored videos.

Existing assets gain a nullable source link and an audio fact. Both stay
null. This revision does not invent measurements and does not encode.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "add_business_video_cover_jobs_v1"
down_revision = "add_business_video_cover_facts_v1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("business_brand_assets", sa.Column("verified_has_audio", sa.Boolean(), nullable=True))
    op.add_column(
        "business_brand_assets",
        sa.Column("source_asset_id", UUID(as_uuid=True), sa.ForeignKey("business_brand_assets.id"), nullable=True),
    )
    op.create_table(
        "business_video_cover_jobs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("business_id", UUID(as_uuid=True), nullable=False),
        sa.Column("source_asset_id", UUID(as_uuid=True), nullable=False),
        sa.Column("idempotency_key", sa.String(length=64), nullable=False),
        sa.Column("strategy", sa.String(length=32), nullable=False),
        sa.Column("start_ticks", sa.BigInteger(), nullable=False),
        sa.Column("end_ticks", sa.BigInteger(), nullable=False),
        sa.Column("encoder_profile", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("deadline_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("claim_token", sa.String(length=64), nullable=True),
        sa.Column("result_asset_id", UUID(as_uuid=True), nullable=True),
        sa.Column("error_code", sa.String(length=80), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["business_profiles.id"], name="fk_business_video_cover_job_business"),
        sa.ForeignKeyConstraint(["created_by"], ["production_users.id"], name="fk_business_video_cover_job_actor"),
        sa.ForeignKeyConstraint(
            ["source_asset_id", "business_id"],
            ["business_brand_assets.id", "business_brand_assets.business_id"],
            name="fk_business_video_cover_job_source",
        ),
        sa.ForeignKeyConstraint(
            ["result_asset_id", "business_id"],
            ["business_brand_assets.id", "business_brand_assets.business_id"],
            name="fk_business_video_cover_job_result",
        ),
        sa.UniqueConstraint("business_id", "idempotency_key", name="uq_business_video_cover_job"),
        sa.CheckConstraint(
            "status IN ('queued','running','ready','awaiting_encode','failed')",
            name="ck_business_video_cover_job_status",
        ),
        sa.CheckConstraint(
            "attempts >= 0 AND attempts <= max_attempts AND max_attempts > 0",
            name="ck_business_video_cover_job_attempts",
        ),
        sa.CheckConstraint("start_ticks >= 0 AND end_ticks > start_ticks", name="ck_business_video_cover_job_window"),
    )


def downgrade():
    op.drop_table("business_video_cover_jobs")
    op.drop_column("business_brand_assets", "source_asset_id")
    op.drop_column("business_brand_assets", "verified_has_audio")
