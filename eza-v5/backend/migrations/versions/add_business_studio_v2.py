"""Add Stage 2 execution provenance without rewriting Stage 1 admissions."""
from alembic import op
import sqlalchemy as sa

revision = 'add_business_studio_v2'
down_revision = 'add_business_studio_v1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('business_studio_generations', sa.Column('execution', sa.JSON(), nullable=True))
    op.add_column('business_studio_usage', sa.Column('estimated', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    bind = op.get_bind()
    if bind.execute(sa.text('SELECT 1 FROM business_studio_generations WHERE execution IS NOT NULL LIMIT 1')).first():
        raise RuntimeError('Never discard Studio execution provenance; downgrade requires no Stage 2 jobs')
    op.drop_column('business_studio_usage', 'estimated')
    op.drop_column('business_studio_generations', 'execution')
