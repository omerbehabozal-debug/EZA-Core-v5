"""add_mirror_network_publish_unique

Revision ID: add_mirror_network_publish_unique
Revises: add_experience_events
Create Date: 2026-05-31

Prevent duplicate mirror_network_nodes per user + conversation on concurrent publish.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "add_mirror_network_publish_unique"
down_revision: Union[str, None] = "add_experience_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "uq_mirror_network_nodes_user_conversation",
        "mirror_network_nodes",
        ["user_id", "conversation_id"],
        unique=True,
        postgresql_where=sa.text("conversation_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_mirror_network_nodes_user_conversation",
        table_name="mirror_network_nodes",
    )
