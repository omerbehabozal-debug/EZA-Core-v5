"""add_mirror_network_nodes

Revision ID: add_mirror_network_nodes
Revises: add_user_mirror_plan
Create Date: 2026-05-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "add_mirror_network_nodes"
down_revision: Union[str, None] = "add_user_mirror_plan"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mirror_network_nodes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("conversation_id", sa.String(length=128), nullable=True),
        sa.Column("visibility", sa.String(length=20), nullable=False, server_default="public"),
        sa.Column("safety_status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("card_title", sa.String(length=200), nullable=False),
        sa.Column("card_date", sa.String(length=10), nullable=False),
        sa.Column("scene_image_url", sa.Text(), nullable=True),
        sa.Column("public_payload", sa.JSON(), nullable=False),
        sa.Column("private_payload", sa.JSON(), nullable=False),
        sa.Column("parent_slug", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["production_users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_mirror_network_nodes_slug", "mirror_network_nodes", ["slug"], unique=True)
    op.create_index("ix_mirror_network_nodes_user_id", "mirror_network_nodes", ["user_id"], unique=False)
    op.create_index("ix_mirror_network_nodes_visibility", "mirror_network_nodes", ["visibility"], unique=False)
    op.create_index("ix_mirror_network_nodes_safety_status", "mirror_network_nodes", ["safety_status"], unique=False)
    op.create_index("ix_mirror_network_nodes_parent_slug", "mirror_network_nodes", ["parent_slug"], unique=False)
    op.create_index("ix_mirror_network_nodes_conversation_id", "mirror_network_nodes", ["conversation_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_mirror_network_nodes_conversation_id", table_name="mirror_network_nodes")
    op.drop_index("ix_mirror_network_nodes_parent_slug", table_name="mirror_network_nodes")
    op.drop_index("ix_mirror_network_nodes_safety_status", table_name="mirror_network_nodes")
    op.drop_index("ix_mirror_network_nodes_visibility", table_name="mirror_network_nodes")
    op.drop_index("ix_mirror_network_nodes_user_id", table_name="mirror_network_nodes")
    op.drop_index("ix_mirror_network_nodes_slug", table_name="mirror_network_nodes")
    op.drop_table("mirror_network_nodes")
