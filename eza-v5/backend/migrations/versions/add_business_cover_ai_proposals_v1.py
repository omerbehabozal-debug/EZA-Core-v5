"""Store cover AI proposals separately from Studio generations and cover jobs.

The charge row is written before the provider call. Downgrade drops only
these two tables.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "add_business_cover_ai_proposals_v1"
down_revision = "add_observation_usage_v1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "business_cover_ai_proposals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("business_id", UUID(as_uuid=True), nullable=False),
        sa.Column("actor_id", UUID(as_uuid=True), nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("request_payload", sa.JSON(), nullable=False),
        sa.Column("result_payload", sa.JSON(), nullable=True),
        sa.Column("provider_model", sa.String(length=120), nullable=True),
        sa.Column("error_code", sa.String(length=80), nullable=True),
        sa.Column("reserved_cost_usd", sa.Numeric(18, 8), nullable=False),
        sa.Column("cost_usd", sa.Numeric(18, 8), nullable=False, server_default="0"),
        sa.Column("cost_known", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("cost_limit_usd", sa.Numeric(18, 8), nullable=False),
        sa.Column("quota_day", sa.Date(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("deadline_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["business_profiles.id"], name="fk_business_cover_ai_proposal_business"),
        sa.ForeignKeyConstraint(["actor_id"], ["production_users.id"], name="fk_business_cover_ai_proposal_actor"),
        sa.UniqueConstraint("business_id", "idempotency_key", name="uq_business_cover_ai_proposal"),
        sa.CheckConstraint("kind IN ('video_intervals','image_cover')", name="ck_business_cover_ai_kind"),
        sa.CheckConstraint(
            "status IN ('reserved','running','succeeded','failed','expired')",
            name="ck_business_cover_ai_status",
        ),
        sa.CheckConstraint(
            "attempts >= 0 AND attempts <= max_attempts AND max_attempts = 1",
            name="ck_business_cover_ai_attempts",
        ),
        sa.CheckConstraint(
            "reserved_cost_usd > 0 AND reserved_cost_usd <= cost_limit_usd AND cost_usd >= 0",
            name="ck_business_cover_ai_cost",
        ),
    )
    op.create_table(
        "business_cover_ai_usage",
        sa.Column("proposal_id", UUID(as_uuid=True), primary_key=True),
        sa.Column("business_id", UUID(as_uuid=True), nullable=False),
        sa.Column("quota_day", sa.Date(), nullable=False),
        sa.Column("cost_usd", sa.Numeric(18, 8), nullable=False),
        sa.Column("outcome", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["proposal_id"], ["business_cover_ai_proposals.id"], name="fk_business_cover_ai_usage_proposal"),
        sa.ForeignKeyConstraint(["business_id"], ["business_profiles.id"], name="fk_business_cover_ai_usage_business"),
        sa.CheckConstraint("cost_usd > 0", name="ck_business_cover_ai_usage_cost"),
        sa.CheckConstraint(
            "outcome IN ('reserved','succeeded','failed','released','uncertain')",
            name="ck_business_cover_ai_usage_outcome",
        ),
    )
    op.create_index("ix_business_cover_ai_usage_day", "business_cover_ai_usage", ["business_id", "quota_day"])


def downgrade():
    op.drop_index("ix_business_cover_ai_usage_day", table_name="business_cover_ai_usage")
    op.drop_table("business_cover_ai_usage")
    op.drop_table("business_cover_ai_proposals")
