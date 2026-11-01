"""Store server-measured video duration and size.

Existing rows stay null. Cover selection fails closed for those stored
videos. This revision does not invent historical measurements.
"""
from alembic import op
import sqlalchemy as sa


revision = "add_business_video_cover_facts_v1"
down_revision = "add_business_yansi_media_plan_v1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("business_brand_assets", sa.Column("verified_duration", sa.BigInteger(), nullable=True))
    op.add_column("business_brand_assets", sa.Column("verified_timescale", sa.BigInteger(), nullable=True))
    op.add_column("business_brand_assets", sa.Column("verified_size_bytes", sa.BigInteger(), nullable=True))


def downgrade():
    op.drop_column("business_brand_assets", "verified_size_bytes")
    op.drop_column("business_brand_assets", "verified_timescale")
    op.drop_column("business_brand_assets", "verified_duration")
