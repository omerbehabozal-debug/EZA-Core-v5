"""One paid cover proposal. It is not a cover job and not a Studio generation."""
import uuid

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from backend.core.utils.dependencies import Base


class BusinessCoverAiProposal(Base):
    __tablename__ = "business_cover_ai_proposals"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("business_profiles.id"), nullable=False)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("production_users.id"), nullable=False)
    idempotency_key = Column(String(128), nullable=False)
    request_hash = Column(String(64), nullable=False)
    kind = Column(String(32), nullable=False)
    status = Column(String(16), nullable=False)
    request_payload = Column(JSON, nullable=False)
    result_payload = Column(JSON, nullable=True)
    provider_model = Column(String(120), nullable=True)
    error_code = Column(String(80), nullable=True)
    reserved_cost_usd = Column(Numeric(18, 8), nullable=False)
    cost_usd = Column(Numeric(18, 8), nullable=False, default=0)
    cost_known = Column(Boolean, nullable=False, default=False)
    cost_limit_usd = Column(Numeric(18, 8), nullable=False)
    quota_day = Column(Date, nullable=False)
    attempts = Column(Integer, nullable=False, default=0)
    max_attempts = Column(Integer, nullable=False, default=1)
    deadline_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    __table_args__ = (
        UniqueConstraint("business_id", "idempotency_key", name="uq_business_cover_ai_proposal"),
        CheckConstraint("kind IN ('video_intervals','image_cover')", name="ck_business_cover_ai_kind"),
        CheckConstraint(
            "status IN ('reserved','running','succeeded','failed','expired')",
            name="ck_business_cover_ai_status",
        ),
        CheckConstraint(
            "attempts >= 0 AND attempts <= max_attempts AND max_attempts = 1",
            name="ck_business_cover_ai_attempts",
        ),
        # cost_usd may exceed reserved_cost_usd when measured usage overruns the estimate.
        CheckConstraint(
            "reserved_cost_usd > 0 AND reserved_cost_usd <= cost_limit_usd AND cost_usd >= 0",
            name="ck_business_cover_ai_cost",
        ),
    )


class BusinessCoverAiUsage(Base):
    """The charge reserved before the provider call. One row per proposal."""

    __tablename__ = "business_cover_ai_usage"
    proposal_id = Column(
        UUID(as_uuid=True),
        ForeignKey("business_cover_ai_proposals.id"),
        primary_key=True,
    )
    business_id = Column(UUID(as_uuid=True), ForeignKey("business_profiles.id"), nullable=False)
    quota_day = Column(Date, nullable=False)
    cost_usd = Column(Numeric(18, 8), nullable=False)
    outcome = Column(String(16), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    __table_args__ = (
        CheckConstraint("cost_usd > 0", name="ck_business_cover_ai_usage_cost"),
        CheckConstraint(
            "outcome IN ('reserved','succeeded','failed','released','uncertain')",
            name="ck_business_cover_ai_usage_outcome",
        ),
        Index("ix_business_cover_ai_usage_day", "business_id", "quota_day"),
    )
