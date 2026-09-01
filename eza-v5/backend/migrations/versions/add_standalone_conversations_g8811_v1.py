"""add_standalone_conversations_g8811_v1

Revision ID: add_standalone_conversations_g8811_v1
Revises: add_standalone_conversations_g881_v1
Create Date: 2026-09-02

Phase 8.8G-1.1 — DB allowlist constraints for conversation_type and message role.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "add_standalone_conversations_g8811_v1"
down_revision: Union[str, None] = "add_standalone_conversations_g881_v1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_standalone_conversations_type",
        "standalone_conversations",
        "conversation_type IN ('direct', 'mirror', 'mirror_branch', 'continuation')",
    )
    op.create_check_constraint(
        "ck_standalone_conversation_messages_role",
        "standalone_conversation_messages",
        "role IN ('user', 'assistant')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_standalone_conversation_messages_role",
        "standalone_conversation_messages",
        type_="check",
    )
    op.drop_constraint(
        "ck_standalone_conversations_type",
        "standalone_conversations",
        type_="check",
    )
