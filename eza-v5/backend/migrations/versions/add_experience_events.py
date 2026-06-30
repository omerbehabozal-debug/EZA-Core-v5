"""add_experience_events

Revision ID: add_experience_events
Revises: add_conversation_groups
Create Date: 2026-05-31

EZA Observation Architecture — product-agnostic experience event backbone.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "add_experience_events"
down_revision: Union[str, None] = "add_conversation_groups"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector, name: str) -> bool:
    return name in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if _table_exists(inspector, "experience_events"):
        return

    op.create_table(
        "experience_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", sa.String(64), nullable=False),
        sa.Column("product_version", sa.String(64), nullable=True),
        sa.Column("tenant_id", sa.String(255), nullable=True),
        sa.Column("environment", sa.String(32), nullable=False),
        sa.Column("event_type", sa.String(96), nullable=False),
        sa.Column("universal_event_type", sa.String(96), nullable=True),
        sa.Column("user_id", sa.String(255), nullable=True),
        sa.Column("guest_token_hash", sa.String(128), nullable=True),
        sa.Column("session_id", sa.String(255), nullable=True),
        sa.Column("conversation_id", sa.String(255), nullable=True),
        sa.Column("mirror_id", sa.String(255), nullable=True),
        sa.Column("root_mirror_id", sa.String(255), nullable=True),
        sa.Column("parent_mirror_id", sa.String(255), nullable=True),
        sa.Column("context_json", postgresql.JSONB(), nullable=True),
        sa.Column("metrics_json", postgresql.JSONB(), nullable=True),
        sa.Column("privacy_json", postgresql.JSONB(), nullable=True),
        sa.Column("schema_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("idx_experience_events_product_id", "experience_events", ["product_id"])
    op.create_index("idx_experience_events_tenant_id", "experience_events", ["tenant_id"])
    op.create_index("idx_experience_events_event_type", "experience_events", ["event_type"])
    op.create_index(
        "idx_experience_events_universal_event_type",
        "experience_events",
        ["universal_event_type"],
    )
    op.create_index("idx_experience_events_user_id", "experience_events", ["user_id"])
    op.create_index(
        "idx_experience_events_guest_token_hash",
        "experience_events",
        ["guest_token_hash"],
    )
    op.create_index(
        "idx_experience_events_conversation_id",
        "experience_events",
        ["conversation_id"],
    )
    op.create_index("idx_experience_events_mirror_id", "experience_events", ["mirror_id"])
    op.create_index("idx_experience_events_created_at", "experience_events", ["created_at"])
    op.create_index("idx_experience_events_expires_at", "experience_events", ["expires_at"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _table_exists(inspector, "experience_events"):
        return

    op.drop_index("idx_experience_events_expires_at", table_name="experience_events")
    op.drop_index("idx_experience_events_created_at", table_name="experience_events")
    op.drop_index("idx_experience_events_mirror_id", table_name="experience_events")
    op.drop_index("idx_experience_events_conversation_id", table_name="experience_events")
    op.drop_index("idx_experience_events_guest_token_hash", table_name="experience_events")
    op.drop_index("idx_experience_events_user_id", table_name="experience_events")
    op.drop_index("idx_experience_events_universal_event_type", table_name="experience_events")
    op.drop_index("idx_experience_events_event_type", table_name="experience_events")
    op.drop_index("idx_experience_events_tenant_id", table_name="experience_events")
    op.drop_index("idx_experience_events_product_id", table_name="experience_events")
    op.drop_table("experience_events")
