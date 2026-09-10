"""add_yansi_identity_gen_g885_v1

Revision ID: add_yansi_identity_gen_g885_v1
Revises: add_conv_groups_g8531_v1
Create Date: 2026-09-09

Phase 8.8G Yansı identity lifecycle — durable committed generation token
for stale-promotion CAS on standalone_conversations.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "add_yansi_identity_gen_g885_v1"
down_revision: Union[str, None] = "add_conv_groups_g8531_v1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "standalone_conversations",
        sa.Column("yansi_identity_generation_id", sa.String(length=128), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("standalone_conversations", "yansi_identity_generation_id")
