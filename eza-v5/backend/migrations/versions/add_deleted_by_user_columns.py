"""add_deleted_by_user_columns

Revision ID: add_deleted_by_user
Revises: 4c2bee92df6f
Create Date: 2025-12-22 23:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'add_deleted_by_user'
down_revision: Union[str, None] = '4c2bee92df6f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add soft delete columns to production_intent_logs
    op.add_column('production_intent_logs', 
                  sa.Column('deleted_by_user', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('production_intent_logs', 
                  sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('production_intent_logs', 
                  sa.Column('deleted_by_user_id', postgresql.UUID(as_uuid=True), nullable=True))
    
    # Create index on deleted_by_user for faster filtering
    op.create_index('ix_production_intent_logs_deleted_by_user', 
                    'production_intent_logs', ['deleted_by_user'])
    
    # Add foreign key constraint for deleted_by_user_id
    op.create_foreign_key(
        'fk_intent_logs_deleted_by_user',
        'production_intent_logs', 'production_users',
        ['deleted_by_user_id'], ['id'],
        ondelete='SET NULL'
    )
    
    # Add soft delete columns to production_impact_events
    op.add_column('production_impact_events', 
                  sa.Column('deleted_by_user', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('production_impact_events', 
                  sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('production_impact_events', 
                  sa.Column('deleted_by_user_id', postgresql.UUID(as_uuid=True), nullable=True))
    
    # Create index on deleted_by_user for faster filtering
    op.create_index('ix_production_impact_events_deleted_by_user', 
                    'production_impact_events', ['deleted_by_user'])
    
    # Add foreign key constraint for deleted_by_user_id
    op.create_foreign_key(
        'fk_impact_events_deleted_by_user',
        'production_impact_events', 'production_users',
        ['deleted_by_user_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    # Remove foreign keys and indexes first
    op.drop_constraint('fk_impact_events_deleted_by_user', 'production_impact_events', type_='foreignkey')
    op.drop_index('ix_production_impact_events_deleted_by_user', table_name='production_impact_events')
    op.drop_column('production_impact_events', 'deleted_by_user_id')
    op.drop_column('production_impact_events', 'deleted_at')
    op.drop_column('production_impact_events', 'deleted_by_user')
    
    op.drop_constraint('fk_intent_logs_deleted_by_user', 'production_intent_logs', type_='foreignkey')
    op.drop_index('ix_production_intent_logs_deleted_by_user', table_name='production_intent_logs')
    op.drop_column('production_intent_logs', 'deleted_by_user_id')
    op.drop_column('production_intent_logs', 'deleted_at')
    op.drop_column('production_intent_logs', 'deleted_by_user')

