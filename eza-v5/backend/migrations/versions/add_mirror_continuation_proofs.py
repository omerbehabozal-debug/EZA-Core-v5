"""add_mirror_continuation_proofs

Revision ID: add_mirror_continuation_proofs
Revises: add_mirror_network_publish_unique
Create Date: 2026-07-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "add_mirror_continuation_proofs"
down_revision: Union[str, None] = "add_mirror_network_publish_unique"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mirror_continuation_proofs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source_mirror_slug", sa.String(length=64), nullable=False),
        sa.Column("session_id", sa.String(length=64), nullable=False),
        sa.Column("actor_hash", sa.String(length=64), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("conversation_id", sa.String(length=128), nullable=True),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["production_users.id"], ondelete="SET NULL"),
    )
    op.create_index(
        "ix_mirror_continuation_proofs_source_mirror_slug",
        "mirror_continuation_proofs",
        ["source_mirror_slug"],
        unique=False,
    )
    op.create_index(
        "ix_mirror_continuation_proofs_session_id",
        "mirror_continuation_proofs",
        ["session_id"],
        unique=False,
    )
    op.create_index(
        "ix_mirror_continuation_proofs_actor_hash",
        "mirror_continuation_proofs",
        ["actor_hash"],
        unique=False,
    )
    op.create_index(
        "ix_mirror_continuation_proofs_conversation_id",
        "mirror_continuation_proofs",
        ["conversation_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_mirror_continuation_proofs_conversation_id", table_name="mirror_continuation_proofs")
    op.drop_index("ix_mirror_continuation_proofs_actor_hash", table_name="mirror_continuation_proofs")
    op.drop_index("ix_mirror_continuation_proofs_session_id", table_name="mirror_continuation_proofs")
    op.drop_index("ix_mirror_continuation_proofs_source_mirror_slug", table_name="mirror_continuation_proofs")
    op.drop_table("mirror_continuation_proofs")
