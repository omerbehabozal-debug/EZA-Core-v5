"""Allow Studio job kind v2_prop for Yansı V2 AI conversation proposals.

Additive check-constraint widening only. Does not change V1 topics/draft jobs.

DO NOT apply to production until Stage 03B review.
"""
from __future__ import annotations

from alembic import op


revision = "add_studio_kind_v2_prop"
down_revision = "add_yansi_v2_conversation_drafts_v1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_studio_kind", "business_studio_generations", type_="check")
    op.create_check_constraint(
        "ck_studio_kind",
        "business_studio_generations",
        "kind IN ('topics','draft','v2_prop')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_studio_kind", "business_studio_generations", type_="check")
    op.create_check_constraint(
        "ck_studio_kind",
        "business_studio_generations",
        "kind IN ('topics','draft')",
    )
