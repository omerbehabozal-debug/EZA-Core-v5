"""Original-language editorial presentation, separate from immutable replay."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "add_yansi_editorial_v1"
down_revision = "add_yansi_katki_phase1_v1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("yansi_editorial_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(64), sa.ForeignKey("mirror_network_nodes.slug", ondelete="CASCADE"), nullable=False),
        sa.Column("journey_version", sa.Integer(), nullable=False),
        sa.Column("language", sa.String(16), nullable=False),
        sa.Column("template_version", sa.Integer(), nullable=False),
        sa.Column("source_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("structure", sa.JSON(), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("retry_after", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("slug", "journey_version", "language", "template_version", "source_hash", name="uq_yansi_editorial_identity"),
        sa.CheckConstraint("status IN ('pending','processing','ready','failed')", name="ck_yansi_editorial_status"))


def downgrade():
    op.drop_table("yansi_editorial_versions")
