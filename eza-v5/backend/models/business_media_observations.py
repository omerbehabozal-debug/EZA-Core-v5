"""Stored visual notes for one brand. They are not verified knowledge.

One row is the durable job and, later, the reusable description of one file's
bytes. A second brand with the same bytes gets its own row. A new analyzer
profile gets its own row. Frame rows belong to that observation and record
only the timestamps that were actually sampled.
"""
import uuid

from sqlalchemy import JSON, Column, DateTime, ForeignKey, ForeignKeyConstraint, Index, Integer, String, UniqueConstraint, CheckConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from backend.core.utils.dependencies import Base


class BusinessMediaObservation(Base):
    __tablename__ = "business_media_observations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("business_profiles.id"), nullable=False)
    asset_id = Column(UUID(as_uuid=True), nullable=False)
    content_sha256 = Column(String(64), nullable=False)
    analyzer_profile = Column(String(64), nullable=False)
    idempotency_key = Column(String(64), nullable=False)
    status = Column(String(24), nullable=False, default="queued", server_default=text("'queued'"))
    attempts = Column(Integer, nullable=False, server_default="0")
    max_attempts = Column(Integer, nullable=False, server_default="3")
    deadline_at = Column(DateTime(timezone=True), nullable=True)
    claim_token = Column(String(64), nullable=True)
    error_code = Column(String(80), nullable=True)
    summary = Column(String(400), nullable=True)
    visible_text = Column(String(200), nullable=True)
    tags = Column(JSON, nullable=True)
    provider_model = Column(String(64), nullable=True)
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    origin = Column(String(16), nullable=False, default="upload", server_default=text("'upload'"))
    created_by = Column(UUID(as_uuid=True), ForeignKey("production_users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    __table_args__ = (
        UniqueConstraint("id", "business_id", name="uq_business_media_observation_tenant"),
        UniqueConstraint("business_id", "idempotency_key", name="uq_business_media_observation_key"),
        UniqueConstraint(
            "business_id", "analyzer_profile", "content_sha256",
            name="uq_business_media_observation_bytes",
        ),
        CheckConstraint(
            "status IN ('queued','running','ready','failed')",
            name="ck_business_media_observation_status",
        ),
        CheckConstraint(
            "attempts >= 0 AND attempts <= max_attempts AND max_attempts > 0",
            name="ck_business_media_observation_attempts",
        ),
        CheckConstraint("length(content_sha256) = 64", name="ck_business_media_observation_sha"),
        CheckConstraint("length(idempotency_key) = 64", name="ck_business_media_observation_idem"),
        CheckConstraint("origin IN ('upload','generated')", name="ck_business_media_observation_origin"),
        CheckConstraint(
            "input_tokens IS NULL OR input_tokens >= 0",
            name="ck_business_media_observation_input_tokens",
        ),
        CheckConstraint(
            "output_tokens IS NULL OR output_tokens >= 0",
            name="ck_business_media_observation_output_tokens",
        ),
        ForeignKeyConstraint(
            ["asset_id", "business_id"],
            ["business_brand_assets.id", "business_brand_assets.business_id"],
            name="fk_business_media_observation_asset",
        ),
        Index("ix_business_media_observation_claim", "status", "created_at", "id"),
    )


class BusinessMediaObservationFrame(Base):
    __tablename__ = "business_media_observation_frames"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    observation_id = Column(UUID(as_uuid=True), nullable=False)
    business_id = Column(UUID(as_uuid=True), ForeignKey("business_profiles.id"), nullable=False)
    timestamp_ms = Column(Integer, nullable=False)
    note = Column(String(160), nullable=True)
    tags = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (
        UniqueConstraint("observation_id", "timestamp_ms", name="uq_business_media_observation_frame"),
        CheckConstraint("timestamp_ms >= 0", name="ck_business_media_observation_frame_time"),
        ForeignKeyConstraint(
            ["observation_id", "business_id"],
            ["business_media_observations.id", "business_media_observations.business_id"],
            name="fk_business_media_observation_frame",
        ),
        Index("ix_business_media_observation_frame_brand", "business_id"),
    )
