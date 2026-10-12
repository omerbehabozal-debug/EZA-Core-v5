"""Durable one-time guest trial; leaves historical usage untouched."""
from alembic import op
import sqlalchemy as sa
revision = "add_guest_trial_v1"
down_revision = 'add_yansi_editorial_v1'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("guest_trials",
        sa.Column("guest_fingerprint", sa.String(32), primary_key=True),
        sa.Column("session_id", sa.String(36), nullable=False, unique=True),
        sa.Column("source_slug", sa.String(64), nullable=False),
        sa.Column("session_payload", sa.JSON(), nullable=False),
        sa.Column("turns", sa.JSON(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))

def downgrade():
    op.drop_table("guest_trials")
