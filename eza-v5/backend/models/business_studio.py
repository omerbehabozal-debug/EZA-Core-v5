"""Separate, opt-in Studio job/usage tables; existing Business records are untouched."""
import uuid

from sqlalchemy import (Column, String, Integer, Date, DateTime, JSON, Numeric,
                        ForeignKey, UniqueConstraint, CheckConstraint, Boolean)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from backend.core.utils.dependencies import Base


class BusinessStudioGeneration(Base):
    __tablename__ = 'business_studio_generations'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey('business_profiles.id'), nullable=False, index=True)
    actor_id = Column(UUID(as_uuid=True), ForeignKey('production_users.id'), nullable=False)
    idempotency_key = Column(String(128), nullable=False)
    request_hash = Column(String(64), nullable=False)
    request_payload = Column(JSON, nullable=False)
    kind = Column(String(12), nullable=False)
    execution = Column(JSON, nullable=True)
    source_snapshot = Column(JSON, nullable=False)
    snapshot_hash = Column(String(64), nullable=False)
    status = Column(String(16), nullable=False)
    model = Column(String(120))
    prompt_version = Column(String(80), nullable=False)
    attempts = Column(Integer, nullable=False, default=0)
    max_attempts = Column(Integer, nullable=False)
    reserved_input_tokens = Column(Integer, nullable=False)
    reserved_output_tokens = Column(Integer, nullable=False)
    input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)
    cost_usd = Column(Numeric(18, 8), nullable=False, default=0)
    cost_limit_usd = Column(Numeric(18, 8), nullable=False)
    quota_day = Column(Date, nullable=False)
    error_code = Column(String(80))
    draft_id = Column(UUID(as_uuid=True), ForeignKey('business_yansi_drafts.id'))
    deadline_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    __table_args__ = (
        UniqueConstraint('business_id', 'idempotency_key', name='uq_business_studio_idempotency'),
        CheckConstraint("kind IN ('topics','draft')", name='ck_studio_kind'),
        CheckConstraint("status IN ('blocked','pending','running','validated','succeeded','failed','cancelled','expired')", name='ck_studio_status'),
        CheckConstraint('attempts >= 0 AND attempts <= max_attempts AND max_attempts > 0', name='ck_studio_attempts'),
        CheckConstraint('input_tokens >= 0 AND input_tokens <= reserved_input_tokens AND output_tokens >= 0 AND output_tokens <= reserved_output_tokens', name='ck_studio_tokens'),
        CheckConstraint('cost_usd >= 0 AND cost_usd <= cost_limit_usd', name='ck_studio_cost'),
    )


class BusinessStudioUsage(Base):
    __tablename__ = 'business_studio_usage'
    generation_id = Column(UUID(as_uuid=True), ForeignKey('business_studio_generations.id'), primary_key=True)
    attempt = Column(Integer, primary_key=True)
    estimated = Column(Boolean, nullable=False, default=False, server_default="false")
    settlement_hash = Column(String(64), nullable=False)
    input_tokens = Column(Integer, nullable=False)
    output_tokens = Column(Integer, nullable=False)
    cost_usd = Column(Numeric(18, 8), nullable=False)
    outcome = Column(String(16), nullable=False)
    error_code = Column(String(80))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    __table_args__ = (
        CheckConstraint('attempt > 0 AND input_tokens >= 0 AND output_tokens >= 0 AND cost_usd >= 0', name='ck_studio_usage_nonnegative'),
        CheckConstraint("outcome IN ('validated','failed','expired')", name='ck_studio_usage_outcome'),
    )
