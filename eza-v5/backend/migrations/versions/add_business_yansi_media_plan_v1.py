"""Store Yansı media choices apart from question and answer text.

The plan holds asset ids only. A null plan is an older text Yansı.
This revision stays local until a later production approval.
"""
from alembic import op
import sqlalchemy as sa


revision = "add_business_yansi_media_plan_v1"
down_revision = "add_business_brand_assets_v1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("business_yansi_drafts", sa.Column("media_plan", sa.JSON(), nullable=True))
    op.add_column("business_publications", sa.Column("media_plan", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("business_publications", "media_plan")
    op.drop_column("business_yansi_drafts", "media_plan")
