"""Business brand applications; additive; does not grant membership."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
revision = 'add_business_applications_v1'
down_revision = 'add_business_yansi_v1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'business_brand_applications',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('applicant_user_id', UUID(as_uuid=True), sa.ForeignKey('production_users.id'), nullable=False),
        sa.Column('brand_name', sa.String(120), nullable=False),
        sa.Column('brand_name_normalized', sa.String(120), nullable=False),
        sa.Column('contact_name', sa.String(120), nullable=False),
        sa.Column('corporate_email', sa.String(255), nullable=False),
        sa.Column('website', sa.String(500)),
        sa.Column('company_info', sa.String(2000), nullable=False),
        sa.Column('status', sa.String(16), nullable=False),
        sa.Column('reviewer_note', sa.String(1000), nullable=False),
        sa.Column('reviewed_by', UUID(as_uuid=True), sa.ForeignKey('production_users.id')),
        sa.Column('reviewed_at', sa.DateTime(timezone=True)),
        sa.Column('business_id', UUID(as_uuid=True), sa.ForeignKey('business_profiles.id')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "status IN ('received','under_review','approved','rejected')",
            name='ck_business_application_status',
        ),
    )
    op.create_index('ix_business_brand_applications_applicant_user_id', 'business_brand_applications', ['applicant_user_id'])
    op.create_index('ix_business_brand_applications_brand_name_normalized', 'business_brand_applications', ['brand_name_normalized'])
    op.create_table(
        'business_application_events',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('application_id', UUID(as_uuid=True), sa.ForeignKey('business_brand_applications.id'), nullable=False),
        sa.Column('actor_user_id', UUID(as_uuid=True), sa.ForeignKey('production_users.id'), nullable=False),
        sa.Column('action', sa.String(40), nullable=False),
        sa.Column('from_status', sa.String(16)),
        sa.Column('to_status', sa.String(16)),
        sa.Column('detail', JSONB, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_business_application_events_application_id', 'business_application_events', ['application_id'])


def downgrade():
    bind = op.get_bind()
    for name in ('business_application_events', 'business_brand_applications'):
        if bind.execute(sa.text(f'SELECT 1 FROM {name} LIMIT 1')).first():
            raise RuntimeError('Business application downgrade requires empty tables; preserve records')
    op.drop_table('business_application_events')
    op.drop_table('business_brand_applications')
