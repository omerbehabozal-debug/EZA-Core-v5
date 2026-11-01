"""Durable cover preparation. The row is the job, not a Redis message."""
import uuid

from sqlalchemy import BigInteger, Column, String, Integer, DateTime, ForeignKey, UniqueConstraint, CheckConstraint, ForeignKeyConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from backend.core.utils.dependencies import Base


class BusinessVideoCoverJob(Base):
    __tablename__ = "business_video_cover_jobs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("business_profiles.id"), nullable=False, index=True)
    source_asset_id = Column(UUID(as_uuid=True), nullable=False)
    idempotency_key = Column(String(64), nullable=False)
    strategy = Column(String(32), nullable=False)
    start_ticks = Column(BigInteger, nullable=False)
    end_ticks = Column(BigInteger, nullable=False)
    encoder_profile = Column(String(64), nullable=False)
    status = Column(String(24), nullable=False)
    attempts = Column(Integer, nullable=False, default=0)
    max_attempts = Column(Integer, nullable=False, default=3)
    deadline_at = Column(DateTime(timezone=True), nullable=True)
    claim_token = Column(String(64), nullable=True)
    result_asset_id = Column(UUID(as_uuid=True), nullable=True)
    error_code = Column(String(80), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("production_users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    __table_args__ = (
        UniqueConstraint("business_id", "idempotency_key", name="uq_business_video_cover_job"),
        CheckConstraint(
            "status IN ('queued','running','ready','awaiting_encode','failed')",
            name="ck_business_video_cover_job_status",
        ),
        CheckConstraint("attempts >= 0 AND attempts <= max_attempts AND max_attempts > 0", name="ck_business_video_cover_job_attempts"),
        CheckConstraint("start_ticks >= 0 AND end_ticks > start_ticks", name="ck_business_video_cover_job_window"),
        ForeignKeyConstraint(
            ["source_asset_id", "business_id"],
            ["business_brand_assets.id", "business_brand_assets.business_id"],
            name="fk_business_video_cover_job_source",
        ),
        ForeignKeyConstraint(
            ["result_asset_id", "business_id"],
            ["business_brand_assets.id", "business_brand_assets.business_id"],
            name="fk_business_video_cover_job_result",
        ),
    )
