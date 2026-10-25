"""Derived Business knowledge chunks. Fails closed when pgvector is missing.

This revision has not been applied to production. Do not run it there until
a later approval. A failure leaves the Alembic version unchanged.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "add_business_knowledge_chunks_v1"
down_revision = "add_business_studio_v2"
branch_labels = None
depends_on = None


class PgvectorRequired(RuntimeError):
    """Raised before DDL so the revision is not recorded."""


class VECTOR(sa.types.UserDefinedType):
    cache_ok = True

    def __init__(self, dimensions):
        self.dimensions = dimensions

    def get_col_spec(self, **kw):
        return f"vector({int(self.dimensions)})"


def _require_pgvector():
    context = op.get_context()
    if context.as_sql:
        return
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        raise PgvectorRequired(
            "add_business_knowledge_chunks_v1 requires PostgreSQL with pgvector. "
            "No table was created and the Alembic revision was not applied."
        )
    found = bind.execute(
        sa.text("SELECT 1 FROM pg_available_extensions WHERE name = 'vector'")
    ).scalar()
    if not found:
        raise PgvectorRequired(
            "pgvector is not available on this PostgreSQL server. "
            "Install the vector package before add_business_knowledge_chunks_v1. "
            "No table was created and the Alembic revision was not applied."
        )


def upgrade():
    _require_pgvector()
    op.execute(sa.text("CREATE EXTENSION IF NOT EXISTS vector"))
    op.create_unique_constraint(
        "uq_business_knowledge_version_tenant",
        "business_knowledge_versions",
        ["id", "business_id", "item_id"],
    )
    op.create_table(
        "business_knowledge_chunks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("business_id", UUID(as_uuid=True), nullable=False),
        sa.Column("knowledge_version_id", UUID(as_uuid=True), nullable=False),
        sa.Column("item_id", UUID(as_uuid=True), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("embedding", VECTOR(1536), nullable=True),
        sa.Column("embedding_model", sa.String(length=64), nullable=True),
        sa.Column("token_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("index_status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.String(length=80), nullable=True),
        sa.Column("indexed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("claim_token", UUID(as_uuid=True), nullable=True),
        sa.Column("claim_owner", sa.String(length=64), nullable=True),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["knowledge_version_id", "business_id", "item_id"],
            ["business_knowledge_versions.id", "business_knowledge_versions.business_id", "business_knowledge_versions.item_id"],
            name="fk_business_knowledge_chunk_tenant",
        ),
        sa.ForeignKeyConstraint(["business_id"], ["business_profiles.id"], name="fk_business_knowledge_chunk_business"),
        sa.UniqueConstraint("knowledge_version_id", "chunk_index", name="uq_business_knowledge_chunk"),
        sa.CheckConstraint(
            "index_status IN ('pending','leased','ready','failed','exhausted','retired')",
            name="ck_business_knowledge_chunk_status",
        ),
    )
    op.create_index("ix_business_knowledge_chunks_business_id", "business_knowledge_chunks", ["business_id"])
    op.create_index("ix_business_knowledge_chunks_version_id", "business_knowledge_chunks", ["knowledge_version_id"])
    op.create_index(
        "ix_business_knowledge_chunks_reuse",
        "business_knowledge_chunks",
        ["business_id", "content_hash", "embedding_model"],
    )
    op.create_index(
        "ix_business_knowledge_chunks_embedding",
        "business_knowledge_chunks",
        ["embedding"],
        unique=False,
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
        postgresql_where=sa.text("index_status = 'ready' AND embedding IS NOT NULL"),
    )


def downgrade():
    op.execute(sa.text("DROP INDEX IF EXISTS ix_business_knowledge_chunks_embedding"))
    op.drop_index("ix_business_knowledge_chunks_reuse", table_name="business_knowledge_chunks")
    op.drop_index("ix_business_knowledge_chunks_version_id", table_name="business_knowledge_chunks")
    op.drop_index("ix_business_knowledge_chunks_business_id", table_name="business_knowledge_chunks")
    op.drop_table("business_knowledge_chunks")
    op.drop_constraint(
        "uq_business_knowledge_version_tenant",
        "business_knowledge_versions",
        type_="unique",
    )
