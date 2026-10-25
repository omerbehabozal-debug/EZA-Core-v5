"""GIN index for simple full-text search on ready knowledge chunks.

The chunk table migration is unchanged. This revision has not been applied
to production. Do not run it there until a later approval.
"""
from alembic import op
import sqlalchemy as sa


revision = "add_business_knowledge_chunks_fts_v1"
down_revision = "add_business_knowledge_chunks_v1"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_business_knowledge_chunks_text_simple "
        "ON business_knowledge_chunks USING gin (to_tsvector('simple', text)) "
        "WHERE index_status = 'ready'"
    ))


def downgrade():
    op.execute(sa.text("DROP INDEX IF EXISTS ix_business_knowledge_chunks_text_simple"))
