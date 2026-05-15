"""safe_mode_and_universal_events

Revision ID: 20260516_governance
Revises: add_deleted_by_user
Create Date: 2026-05-16

Behavioral calibration tables, eza_events, and behavioral_feedback.event_id.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "20260516_governance"
down_revision: Union[str, None] = "add_deleted_by_user"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector, name: str) -> bool:
    return name in inspector.get_table_names()


def _column_exists(inspector, table: str, column: str) -> bool:
    if not _table_exists(inspector, table):
        return False
    return column in {c["name"] for c in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _table_exists(inspector, "behavioral_logs"):
        op.create_table(
            "behavioral_logs",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", sa.String(255), nullable=False),
            sa.Column("session_id", sa.String(255), nullable=False),
            sa.Column("org_id", sa.String(255), nullable=True),
            sa.Column(
                "timestamp",
                sa.DateTime(timezone=True),
                server_default=sa.text("NOW()"),
                nullable=False,
            ),
            sa.Column("eza_score", sa.Float(), nullable=True),
            sa.Column("input_risk", sa.Float(), nullable=True),
            sa.Column("output_risk", sa.Float(), nullable=True),
            sa.Column("alignment_score", sa.Float(), nullable=True),
            sa.Column("asymmetry_index", sa.Float(), nullable=True),
            sa.Column("reliance_signal", sa.Float(), nullable=True),
            sa.Column("confidence_score", sa.Float(), nullable=True),
            sa.Column("data_quality", sa.Float(), nullable=True),
            sa.Column("mode", sa.String(50), nullable=True),
            sa.Column("schema_version", sa.Integer(), server_default="1"),
            sa.Column("case_snapshot", postgresql.JSONB(), nullable=True),
        )
        op.create_index("idx_behavioral_user_time", "behavioral_logs", ["user_id", "timestamp"])
        op.create_index("idx_behavioral_org_time", "behavioral_logs", ["org_id", "timestamp"])
        op.create_index("idx_behavioral_session", "behavioral_logs", ["session_id"])

    if not _table_exists(inspector, "behavioral_baselines"):
        op.create_table(
            "behavioral_baselines",
            sa.Column("user_id", sa.String(255), primary_key=True),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("NOW()"),
            ),
            sa.Column("sample_count", sa.Integer(), server_default="0"),
            sa.Column("eza_mean", sa.Float(), nullable=True),
            sa.Column("eza_std", sa.Float(), nullable=True),
            sa.Column("eza_slope_7d", sa.Float(), nullable=True),
            sa.Column("eza_slope_30d", sa.Float(), nullable=True),
            sa.Column("asymmetry_mean", sa.Float(), nullable=True),
            sa.Column("asymmetry_std", sa.Float(), nullable=True),
            sa.Column("reliance_mean", sa.Float(), nullable=True),
            sa.Column("reliance_std", sa.Float(), nullable=True),
            sa.Column("baseline_quality", sa.Float(), nullable=True),
            sa.Column("is_stable", sa.Boolean(), server_default=sa.text("false")),
            sa.Column("last_calibrated", sa.DateTime(timezone=True), nullable=True),
        )

    if not _table_exists(inspector, "behavioral_feedback"):
        op.create_table(
            "behavioral_feedback",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", sa.String(255), nullable=False),
            sa.Column("org_id", sa.String(255), nullable=True),
            sa.Column(
                "timestamp",
                sa.DateTime(timezone=True),
                server_default=sa.text("NOW()"),
            ),
            sa.Column("analysis_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("feedback_type", sa.String(50), nullable=False),
            sa.Column("metric_name", sa.String(100), nullable=True),
            sa.Column("original_label", sa.String(100), nullable=True),
            sa.Column("corrected_label", sa.String(100), nullable=True),
            sa.Column("original_score", sa.Float(), nullable=True),
            sa.Column("corrected_score", sa.Float(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("reviewed_by", sa.String(255), nullable=True),
            sa.Column("is_reviewed", sa.Boolean(), server_default=sa.text("false")),
        )
        op.create_index("idx_feedback_user", "behavioral_feedback", ["user_id", "timestamp"])
        op.create_index("idx_feedback_analysis", "behavioral_feedback", ["analysis_id"])
        op.create_index("idx_feedback_event", "behavioral_feedback", ["event_id"])
    elif not _column_exists(inspector, "behavioral_feedback", "event_id"):
        op.add_column(
            "behavioral_feedback",
            sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
        op.create_index("idx_feedback_event", "behavioral_feedback", ["event_id"])

    inspector = inspect(bind)
    if not _table_exists(inspector, "eza_events"):
        op.create_table(
            "eza_events",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("source_mode", sa.String(64), nullable=False),
            sa.Column("entity_type", sa.String(64), nullable=False),
            sa.Column("entity_id", sa.String(255), nullable=False),
            sa.Column("event_type", sa.String(64), nullable=False),
            sa.Column("calibration_scope", sa.String(64), nullable=False),
            sa.Column(
                "regulation_scope",
                sa.String(64),
                nullable=False,
                server_default="none",
            ),
            sa.Column("user_id", sa.String(255), nullable=True),
            sa.Column("org_id", sa.String(255), nullable=True),
            sa.Column("session_id", sa.String(255), nullable=True),
            sa.Column(
                "timestamp",
                sa.DateTime(timezone=True),
                server_default=sa.text("NOW()"),
                nullable=False,
            ),
            sa.Column("score_vector", postgresql.JSONB(), nullable=True),
            sa.Column("engine_votes", postgresql.JSONB(), nullable=True),
            sa.Column("decision_trace", postgresql.JSONB(), nullable=True),
            sa.Column("metadata", postgresql.JSONB(), nullable=True),
            sa.Column("risk_label", sa.String(64), nullable=True),
            sa.Column("risk_score", sa.Float(), nullable=True),
            sa.Column("confidence_score", sa.Float(), nullable=True),
            sa.Column("reliability_score", sa.Float(), nullable=True),
            sa.Column("can_interpret", sa.Boolean(), server_default=sa.text("false")),
            sa.Column("case_snapshot", postgresql.JSONB(), nullable=True),
            sa.Column("schema_version", sa.Integer(), nullable=False, server_default="1"),
        )
        op.create_index("idx_eza_events_source_time", "eza_events", ["source_mode", "timestamp"])
        op.create_index("idx_eza_events_entity_time", "eza_events", ["entity_type", "entity_id", "timestamp"])
        op.create_index("idx_eza_events_user_time", "eza_events", ["user_id", "timestamp"])
        op.create_index("idx_eza_events_org_time", "eza_events", ["org_id", "timestamp"])
        op.create_index("idx_eza_events_type_time", "eza_events", ["event_type", "timestamp"])
        op.create_index("idx_eza_events_regulation_time", "eza_events", ["regulation_scope", "timestamp"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if _table_exists(inspector, "eza_events"):
        op.drop_index("idx_eza_events_regulation_time", table_name="eza_events")
        op.drop_index("idx_eza_events_type_time", table_name="eza_events")
        op.drop_index("idx_eza_events_org_time", table_name="eza_events")
        op.drop_index("idx_eza_events_user_time", table_name="eza_events")
        op.drop_index("idx_eza_events_entity_time", table_name="eza_events")
        op.drop_index("idx_eza_events_source_time", table_name="eza_events")
        op.drop_table("eza_events")

    if _table_exists(inspector, "behavioral_feedback"):
        if _column_exists(inspector, "behavioral_feedback", "event_id"):
            op.drop_index("idx_feedback_event", table_name="behavioral_feedback")
            op.drop_column("behavioral_feedback", "event_id")
        if _column_exists(inspector, "behavioral_feedback", "analysis_id"):
            op.drop_index("idx_feedback_analysis", table_name="behavioral_feedback")
        op.drop_index("idx_feedback_user", table_name="behavioral_feedback")
        op.drop_table("behavioral_feedback")

    if _table_exists(inspector, "behavioral_baselines"):
        op.drop_table("behavioral_baselines")

    if _table_exists(inspector, "behavioral_logs"):
        op.drop_index("idx_behavioral_session", table_name="behavioral_logs")
        op.drop_index("idx_behavioral_org_time", table_name="behavioral_logs")
        op.drop_index("idx_behavioral_user_time", table_name="behavioral_logs")
        op.drop_table("behavioral_logs")
