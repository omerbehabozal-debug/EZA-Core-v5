"""Additive Studio admission/usage tables. Local QA only; inspect production drift first."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'add_business_studio_v1'
down_revision = 'add_user_capabilities_v1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('business_studio_generations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', UUID(as_uuid=True), sa.ForeignKey('business_profiles.id'), nullable=False),
        sa.Column('actor_id', UUID(as_uuid=True), sa.ForeignKey('production_users.id'), nullable=False),
        sa.Column('idempotency_key', sa.String(128), nullable=False),
        sa.Column('request_hash', sa.String(64), nullable=False),
        sa.Column('request_payload', sa.JSON(), nullable=False),
        sa.Column('kind', sa.String(12), nullable=False),
        sa.Column('source_snapshot', sa.JSON(), nullable=False),
        sa.Column('snapshot_hash', sa.String(64), nullable=False),
        sa.Column('status', sa.String(16), nullable=False),
        sa.Column('model', sa.String(120)),
        sa.Column('prompt_version', sa.String(80), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('max_attempts', sa.Integer(), nullable=False),
        sa.Column('reserved_input_tokens', sa.Integer(), nullable=False),
        sa.Column('reserved_output_tokens', sa.Integer(), nullable=False),
        sa.Column('input_tokens', sa.Integer(), nullable=False),
        sa.Column('output_tokens', sa.Integer(), nullable=False),
        sa.Column('cost_usd', sa.Numeric(18, 8), nullable=False),
        sa.Column('cost_limit_usd', sa.Numeric(18, 8), nullable=False),
        sa.Column('quota_day', sa.Date(), nullable=False),
        sa.Column('error_code', sa.String(80)),
        sa.Column('draft_id', UUID(as_uuid=True), sa.ForeignKey('business_yansi_drafts.id')),
        sa.Column('deadline_at', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('business_id', 'idempotency_key', name='uq_business_studio_idempotency'),
        sa.CheckConstraint("kind IN ('topics','draft')", name='ck_studio_kind'),
        sa.CheckConstraint("status IN ('blocked','pending','running','validated','succeeded','failed','cancelled','expired')", name='ck_studio_status'),
        sa.CheckConstraint('attempts >= 0 AND attempts <= max_attempts AND max_attempts > 0', name='ck_studio_attempts'),
        sa.CheckConstraint('input_tokens >= 0 AND input_tokens <= reserved_input_tokens AND output_tokens >= 0 AND output_tokens <= reserved_output_tokens', name='ck_studio_tokens'),
        sa.CheckConstraint('cost_usd >= 0 AND cost_usd <= cost_limit_usd', name='ck_studio_cost'))
    op.create_index('ix_business_studio_generations_business_id', 'business_studio_generations', ['business_id'])
    op.create_table('business_studio_usage',
        sa.Column('generation_id', UUID(as_uuid=True), sa.ForeignKey('business_studio_generations.id'), primary_key=True),
        sa.Column('attempt', sa.Integer(), primary_key=True),
        sa.Column('settlement_hash', sa.String(64), nullable=False),
        sa.Column('input_tokens', sa.Integer(), nullable=False),
        sa.Column('output_tokens', sa.Integer(), nullable=False),
        sa.Column('cost_usd', sa.Numeric(18, 8), nullable=False),
        sa.Column('outcome', sa.String(16), nullable=False),
        sa.Column('error_code', sa.String(80)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint('attempt > 0 AND input_tokens >= 0 AND output_tokens >= 0 AND cost_usd >= 0', name='ck_studio_usage_nonnegative'),
        sa.CheckConstraint("outcome IN ('validated','failed','expired')", name='ck_studio_usage_outcome'))


def downgrade():
    bind = op.get_bind()
    if any(bind.execute(sa.text('SELECT 1 FROM ' + name + ' LIMIT 1')).first()
           for name in ('business_studio_usage', 'business_studio_generations')):
        raise RuntimeError('Studio downgrade requires empty tables; never discard usage/provenance')
    op.drop_table('business_studio_usage')
    op.drop_index('ix_business_studio_generations_business_id', table_name='business_studio_generations')
    op.drop_table('business_studio_generations')
