"""add_mirror_journey_identity_pass_closure

Revision ID: add_mirror_journey_identity_pass_closure
Revises: add_mirror_journey_identity_v1
Create Date: 2026-08-08

Phase 1 PASS closure:
- partial unique (user_id, conversation_id) for legacy_landing only
- journey_version on mirror_journey_steps (Option A versioning foundation)
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "add_mirror_journey_identity_pass_closure"
down_revision: Union[str, None] = "add_mirror_journey_identity_v1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

LEGACY_DUP_PREFLIGHT_SQL = """
SELECT user_id, conversation_id, COUNT(*) AS row_count
FROM mirror_network_nodes
WHERE artifact_kind = 'legacy_landing'
  AND conversation_id IS NOT NULL
GROUP BY user_id, conversation_id
HAVING COUNT(*) > 1
"""


def _index_exists(inspector, table: str, name: str) -> bool:
    return name in {idx["name"] for idx in inspector.get_indexes(table)}


def _column_exists(inspector, table: str, name: str) -> bool:
    return name in {col["name"] for col in inspector.get_columns(table)}


def _table_exists(inspector, table: str) -> bool:
    return table in inspector.get_table_names()


def _unique_constraint_exists(inspector, table: str, name: str) -> bool:
    return name in {uc["name"] for uc in inspector.get_unique_constraints(table)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if _table_exists(inspector, "mirror_network_nodes"):
        if not _index_exists(
            inspector,
            "mirror_network_nodes",
            "uq_mirror_network_nodes_legacy_user_conversation",
        ):
            duplicates = bind.execute(sa.text(LEGACY_DUP_PREFLIGHT_SQL)).fetchall()
            if duplicates:
                sample = duplicates[:5]
                raise RuntimeError(
                    "Cannot apply uq_mirror_network_nodes_legacy_user_conversation: "
                    f"{len(duplicates)} duplicate legacy_landing (user_id, conversation_id) "
                    f"group(s). Dedupe manually first. Sample: {sample}"
                )
            op.create_index(
                "uq_mirror_network_nodes_legacy_user_conversation",
                "mirror_network_nodes",
                ["user_id", "conversation_id"],
                unique=True,
                postgresql_where=sa.text(
                    "artifact_kind = 'legacy_landing' AND conversation_id IS NOT NULL"
                ),
            )

    if _table_exists(inspector, "mirror_journey_steps"):
        if not _column_exists(inspector, "mirror_journey_steps", "journey_version"):
            op.add_column(
                "mirror_journey_steps",
                sa.Column(
                    "journey_version",
                    sa.Integer(),
                    nullable=False,
                    server_default="1",
                ),
            )

        # Replace slug+index uniqueness with slug+version+index.
        if _unique_constraint_exists(
            inspector, "mirror_journey_steps", "uq_mirror_journey_steps_slug_index"
        ):
            op.drop_constraint(
                "uq_mirror_journey_steps_slug_index",
                "mirror_journey_steps",
                type_="unique",
            )
        # Some dialects register UniqueConstraint as an index.
        if _index_exists(
            inspector, "mirror_journey_steps", "uq_mirror_journey_steps_slug_index"
        ):
            op.drop_index(
                "uq_mirror_journey_steps_slug_index",
                table_name="mirror_journey_steps",
            )

        if not _unique_constraint_exists(
            inspector,
            "mirror_journey_steps",
            "uq_mirror_journey_steps_slug_version_index",
        ) and not _index_exists(
            inspector,
            "mirror_journey_steps",
            "uq_mirror_journey_steps_slug_version_index",
        ):
            op.create_unique_constraint(
                "uq_mirror_journey_steps_slug_version_index",
                "mirror_journey_steps",
                ["journey_slug", "journey_version", "step_index"],
            )

        if not _index_exists(
            inspector,
            "mirror_journey_steps",
            "ix_mirror_journey_steps_slug_version",
        ):
            op.create_index(
                "ix_mirror_journey_steps_slug_version",
                "mirror_journey_steps",
                ["journey_slug", "journey_version"],
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if _table_exists(inspector, "mirror_journey_steps"):
        if _index_exists(
            inspector, "mirror_journey_steps", "ix_mirror_journey_steps_slug_version"
        ):
            op.drop_index(
                "ix_mirror_journey_steps_slug_version",
                table_name="mirror_journey_steps",
            )
        if _unique_constraint_exists(
            inspector,
            "mirror_journey_steps",
            "uq_mirror_journey_steps_slug_version_index",
        ):
            op.drop_constraint(
                "uq_mirror_journey_steps_slug_version_index",
                "mirror_journey_steps",
                type_="unique",
            )
        elif _index_exists(
            inspector,
            "mirror_journey_steps",
            "uq_mirror_journey_steps_slug_version_index",
        ):
            op.drop_index(
                "uq_mirror_journey_steps_slug_version_index",
                table_name="mirror_journey_steps",
            )

        if not _unique_constraint_exists(
            inspector, "mirror_journey_steps", "uq_mirror_journey_steps_slug_index"
        ) and not _index_exists(
            inspector, "mirror_journey_steps", "uq_mirror_journey_steps_slug_index"
        ):
            op.create_unique_constraint(
                "uq_mirror_journey_steps_slug_index",
                "mirror_journey_steps",
                ["journey_slug", "step_index"],
            )

        if _column_exists(inspector, "mirror_journey_steps", "journey_version"):
            op.drop_column("mirror_journey_steps", "journey_version")

    if _table_exists(inspector, "mirror_network_nodes"):
        if _index_exists(
            inspector,
            "mirror_network_nodes",
            "uq_mirror_network_nodes_legacy_user_conversation",
        ):
            op.drop_index(
                "uq_mirror_network_nodes_legacy_user_conversation",
                table_name="mirror_network_nodes",
            )
