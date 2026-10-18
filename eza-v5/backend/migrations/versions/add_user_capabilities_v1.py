"""Product-scoped user capabilities (BiligN platform admin independent of EZA role).

Additive only. Does not alter production_users.role or grant capabilities.
Idempotent: skips create when table already exists.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import inspect

revision = 'add_user_capabilities_v1'
down_revision = 'add_business_applications_v1'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if inspect(bind).has_table('user_capabilities'):
        return
    op.create_table(
        'user_capabilities',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('production_users.id'), nullable=False),
        sa.Column('capability', sa.String(64), nullable=False),
        sa.Column('granted_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('granted_by', UUID(as_uuid=True), sa.ForeignKey('production_users.id'), nullable=True),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked_by', UUID(as_uuid=True), sa.ForeignKey('production_users.id'), nullable=True),
        sa.CheckConstraint(
            "capability IN ('bilign.platform_admin')",
            name='ck_user_capabilities_known',
        ),
        sa.CheckConstraint(
            '(revoked_at IS NULL AND revoked_by IS NULL) OR (revoked_at IS NOT NULL)',
            name='ck_user_capabilities_revoke_pair',
        ),
    )
    op.create_index('ix_user_capabilities_user_id', 'user_capabilities', ['user_id'])
    op.create_index('ix_user_capabilities_capability', 'user_capabilities', ['capability'])
    # One active grant per (user, capability); history rows keep revoked_at set.
    op.execute(
        """
        CREATE UNIQUE INDEX uq_user_capabilities_active
        ON user_capabilities (user_id, capability)
        WHERE revoked_at IS NULL
        """
    )


def downgrade():
    bind = op.get_bind()
    if not inspect(bind).has_table('user_capabilities'):
        return
    op.execute('DROP INDEX IF EXISTS uq_user_capabilities_active')
    op.drop_index('ix_user_capabilities_capability', table_name='user_capabilities')
    op.drop_index('ix_user_capabilities_user_id', table_name='user_capabilities')
    op.drop_table('user_capabilities')
