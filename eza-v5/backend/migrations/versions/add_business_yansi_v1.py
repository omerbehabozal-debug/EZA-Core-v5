"""Business tenant extension; opt-in deployment after this additive migration."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
revision='add_business_yansi_v1'
down_revision='add_guest_trial_v1'
branch_labels=None
depends_on=None

def uuid_col(name,target=None,**kwargs):
    return sa.Column(name,UUID(as_uuid=True),*([sa.ForeignKey(target)] if target else []),**kwargs)
def timestamps():
    return [sa.Column('created_at',sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False),sa.Column('updated_at',sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False)]
def upgrade():
    op.create_table('business_profiles',uuid_col('id','production_organizations.id',primary_key=True),
        uuid_col('owner_id','production_users.id',nullable=False),sa.Column('slug',sa.String(64),unique=True,nullable=False),
        sa.Column('name',sa.String(120),nullable=False),sa.Column('logo_url',sa.Text()),sa.Column('description',sa.String(500),nullable=False),
        sa.Column('verified',sa.Boolean(),nullable=False),sa.Column('official',sa.Boolean(),nullable=False),sa.Column('status',sa.String(16),nullable=False),
        sa.CheckConstraint("status IN ('active','suspended','archived')",name='ck_business_status'),*timestamps())
    op.create_table('business_members',uuid_col('business_id','business_profiles.id',primary_key=True),uuid_col('user_id','production_users.id',primary_key=True),
        sa.Column('role',sa.String(16),nullable=False),sa.CheckConstraint("role IN ('owner','editor','viewer')",name='ck_business_role'))
    op.create_table('business_knowledge_versions',uuid_col('id',primary_key=True),uuid_col('business_id','business_profiles.id',nullable=False),
        uuid_col('item_id',nullable=False),sa.Column('version',sa.Integer(),nullable=False),sa.Column('title',sa.String(160),nullable=False),
        sa.Column('category',sa.String(80),nullable=False),sa.Column('content',sa.Text(),nullable=False),sa.Column('source',sa.String(1000),nullable=False),
        sa.Column('public_allowed',sa.Boolean(),nullable=False),sa.Column('status',sa.String(16),nullable=False),sa.Column('revision',sa.Integer(),nullable=False),
        uuid_col('created_by','production_users.id',nullable=False),uuid_col('approved_by','production_users.id'),
        sa.UniqueConstraint('business_id','item_id','version',name='uq_business_knowledge_version'),
        sa.CheckConstraint("status IN ('draft','review','approved','published','archived')",name='ck_business_knowledge_status'),*timestamps())
    op.create_index('ix_business_knowledge_versions_business_id','business_knowledge_versions',['business_id'])
    op.create_table('business_yansi_drafts',uuid_col('id',primary_key=True),uuid_col('business_id','business_profiles.id',nullable=False),
        sa.Column('title',sa.String(200),nullable=False),sa.Column('summary',sa.String(500),nullable=False),sa.Column('steps',sa.JSON(),nullable=False),
        sa.Column('knowledge_snapshot',sa.JSON(),nullable=False),sa.Column('source_hash',sa.String(64),nullable=False),
        uuid_col('conversation_id','standalone_conversations.id'),uuid_col('created_by','production_users.id',nullable=False),uuid_col('approved_by','production_users.id'),
        sa.Column('status',sa.String(16),nullable=False),sa.Column('revision',sa.Integer(),nullable=False),
        sa.CheckConstraint("status IN ('draft','review','approved','published','archived')",name='ck_business_draft_status'),*timestamps())
    op.create_index('ix_business_yansi_drafts_business_id','business_yansi_drafts',['business_id'])
    op.create_table('business_publications',sa.Column('slug',sa.String(64),sa.ForeignKey('mirror_network_nodes.slug'),primary_key=True),
        sa.Column('journey_version',sa.Integer(),primary_key=True),uuid_col('business_id','business_profiles.id',nullable=False),
        uuid_col('draft_id','business_yansi_drafts.id',nullable=False),sa.Column('knowledge_snapshot',sa.JSON(),nullable=False),
        uuid_col('published_by','production_users.id',nullable=False),*timestamps())
    op.create_index('ix_business_publications_business_id','business_publications',['business_id'])
def downgrade():
    # Never erase knowledge or approved public provenance as an incidental rollback.
    bind=op.get_bind()
    names=['business_publications','business_yansi_drafts','business_knowledge_versions','business_members','business_profiles']
    if any(bind.execute(sa.text('SELECT 1 FROM '+name+' LIMIT 1')).first() for name in names):
        raise RuntimeError('Business downgrade requires empty tables; preserve production records')
    for name in names:op.drop_table(name)
