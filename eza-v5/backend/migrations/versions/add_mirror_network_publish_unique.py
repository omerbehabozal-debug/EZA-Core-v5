"""add_mirror_network_publish_unique

Revision ID: add_mirror_network_publish_unique
Revises: add_experience_events
Create Date: 2026-05-31

Prevent duplicate mirror_network_nodes per user + conversation on concurrent publish.

Preflight (run before migration in production):
  SELECT user_id, conversation_id, COUNT(*) AS row_count
  FROM mirror_network_nodes
  WHERE conversation_id IS NOT NULL
  GROUP BY user_id, conversation_id
  HAVING COUNT(*) > 1;

Resolve duplicates manually before applying this migration. This migration does not auto-delete.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "add_mirror_network_publish_unique"
down_revision: Union[str, None] = "add_experience_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DUPLICATE_PREFLIGHT_SQL = """
SELECT user_id, conversation_id, COUNT(*) AS row_count
FROM mirror_network_nodes
WHERE conversation_id IS NOT NULL
GROUP BY user_id, conversation_id
HAVING COUNT(*) > 1
"""


def upgrade() -> None:
    bind = op.get_bind()
    duplicates = bind.execute(sa.text(DUPLICATE_PREFLIGHT_SQL)).fetchall()
    if duplicates:
        sample = duplicates[:5]
        raise RuntimeError(
            "Cannot apply uq_mirror_network_nodes_user_conversation: "
            f"{len(duplicates)} duplicate (user_id, conversation_id) group(s) found. "
            f"Run preflight SQL and dedupe manually first. Sample: {sample}"
        )

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
