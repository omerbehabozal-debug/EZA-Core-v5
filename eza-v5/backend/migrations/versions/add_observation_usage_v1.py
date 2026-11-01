"""Record measured vision-token counts. Descriptions stay off the Yansı seal.

Null counts mean the provider did not return usage. Downgrade drops only
these columns.
"""
from alembic import op
import sqlalchemy as sa


revision = "add_observation_usage_v1"
down_revision = "add_media_observations_v1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("business_media_observations", sa.Column("provider_model", sa.String(length=64), nullable=True))
    op.add_column("business_media_observations", sa.Column("input_tokens", sa.Integer(), nullable=True))
    op.add_column("business_media_observations", sa.Column("output_tokens", sa.Integer(), nullable=True))
    op.create_check_constraint(
        "ck_business_media_observation_input_tokens",
        "business_media_observations",
        "input_tokens IS NULL OR input_tokens >= 0",
    )
    op.create_check_constraint(
        "ck_business_media_observation_output_tokens",
        "business_media_observations",
        "output_tokens IS NULL OR output_tokens >= 0",
    )


def downgrade():
    op.drop_constraint("ck_business_media_observation_output_tokens", "business_media_observations", type_="check")
    op.drop_constraint("ck_business_media_observation_input_tokens", "business_media_observations", type_="check")
    op.drop_column("business_media_observations", "output_tokens")
    op.drop_column("business_media_observations", "input_tokens")
    op.drop_column("business_media_observations", "provider_model")
