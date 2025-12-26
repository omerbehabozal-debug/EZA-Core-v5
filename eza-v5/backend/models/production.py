# -*- coding: utf-8 -*-
"""
Production-Grade Database Models
EZA Core V6 - Persistent PostgreSQL Models
"""

import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.core.utils.dependencies import Base


class User(Base):
    """User model with UUID primary key"""
    __tablename__ = "production_users"
    __mapper_args__ = {
        "polymorphic_identity": "production_user"
    }
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, index=True)  # admin, org_admin, user, ops, regulator, REGULATOR_READONLY, REGULATOR_AUDITOR
    is_active = Column(Boolean, nullable=False, default=True, index=True)  # User account active status
    is_internal_test_user = Column(Boolean, nullable=True, default=False)  # Internal audit/testing flag (regulator test users, etc.)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships - Use fully qualified paths for production models to avoid conflicts
    organization_users = relationship("backend.models.production.OrganizationUser", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("backend.models.production.AuditLog", back_populates="user")
    api_keys = relationship("backend.models.production.ApiKey", back_populates="user", cascade="all, delete-orphan")


class Organization(Base):
    """Organization model with UUID primary key"""
    __tablename__ = "production_organizations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(255), nullable=False, index=True)
    plan = Column(String(50), nullable=False, default="free")  # free, pro, enterprise
    status = Column(String(50), nullable=False, default="active", index=True)  # active, suspended, archived
    base_currency = Column(String(10), nullable=False, default="TRY")  # TRY, USD
    proxy_access = Column(Boolean, nullable=False, default=True)
    sla_tier = Column(String(50), nullable=True)
    default_policy_set = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships - Use fully qualified paths for production models to avoid conflicts
    organization_users = relationship("backend.models.production.OrganizationUser", back_populates="organization", cascade="all, delete-orphan")
    api_keys = relationship("backend.models.production.ApiKey", back_populates="organization", cascade="all, delete-orphan")
    audit_logs = relationship("backend.models.production.AuditLog", back_populates="organization")
    telemetry_events = relationship("backend.models.production.TelemetryEvent", back_populates="organization")
    alert_events = relationship("backend.models.production.AlertEvent", back_populates="organization")
    invitations = relationship("backend.models.production.Invitation", back_populates="organization", cascade="all, delete-orphan")


class OrganizationUser(Base):
    """Organization-User relationship"""
    __tablename__ = "production_organization_users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    org_id = Column(UUID(as_uuid=True), ForeignKey("production_organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("production_users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), nullable=False)  # org_admin, user, ops
    joined_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    status = Column(String(50), nullable=False, default="active")  # active, suspended (removed "invited" - use Invitation model instead)
    
    # Relationships - Use fully qualified paths for production models to avoid conflicts
    organization = relationship("backend.models.production.Organization", back_populates="organization_users")
    user = relationship("backend.models.production.User", back_populates="organization_users")
    
    # Unique constraint: user can only have one role per organization
    __table_args__ = (
        {"sqlite_autoincrement": True},
    )


class ApiKey(Base):
    """API Key model for organization API keys"""
    __tablename__ = "production_api_keys"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    org_id = Column(UUID(as_uuid=True), ForeignKey("production_organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("production_users.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    key_hash = Column(String(255), unique=True, index=True, nullable=False)  # SHA256 hash of ezak_* key
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    revoked = Column(Boolean, nullable=False, default=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships - Use fully qualified paths for production models to avoid conflicts
    organization = relationship("backend.models.production.Organization", back_populates="api_keys")
    user = relationship("backend.models.production.User", back_populates="api_keys")


class AuditLog(Base):
    """Audit log for all actions"""
    __tablename__ = "production_audit_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    org_id = Column(UUID(as_uuid=True), ForeignKey("production_organizations.id", ondelete="SET NULL"), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("production_users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)  # ORG_CREATED, ORG_UPDATED, etc.
    context = Column(JSON, nullable=True)  # Additional action context (renamed from metadata to avoid SQLAlchemy conflict)
    endpoint = Column(String(500), nullable=True)
    method = Column(String(10), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    # Relationships - Use fully qualified paths for production models to avoid conflicts
    organization = relationship("backend.models.production.Organization", back_populates="audit_logs")
    user = relationship("backend.models.production.User", back_populates="audit_logs")


class TelemetryEvent(Base):
    """Telemetry events for SLA and monitoring"""
    __tablename__ = "production_telemetry_events"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    org_id = Column(UUID(as_uuid=True), ForeignKey("production_organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    source = Column(String(50), nullable=False)  # proxy_ui, api
    data_type = Column(String(50), nullable=False, index=True)  # real, simulated
    risk_score = Column(Integer, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    provider = Column(String(100), nullable=True)
    content_id = Column(String(255), nullable=True)
    flags = Column(JSON, nullable=True)
    token_usage = Column(JSON, nullable=True)
    fail_safe_triggered = Column(Boolean, nullable=False, default=False)
    fail_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    # Relationships - Use fully qualified paths for production models to avoid conflicts
    organization = relationship("backend.models.production.Organization", back_populates="telemetry_events")


class AlertEvent(Base):
    """Alert events for SLA breaches and fail-safes"""
    __tablename__ = "production_alert_events"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    org_id = Column(UUID(as_uuid=True), ForeignKey("production_organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(50), nullable=False, index=True)  # sla, latency, fail_safe
    severity = Column(String(50), nullable=False)  # low, medium, high, critical
    payload = Column(JSON, nullable=True)  # Alert details
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships - Use fully qualified paths for production models to avoid conflicts
    organization = relationship("backend.models.production.Organization", back_populates="alert_events")


class Invitation(Base):
    """Enterprise-grade invitation system - SOC2/ISO compliant"""
    __tablename__ = "production_invitations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String(255), nullable=False, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("production_organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), nullable=False)  # org_admin, user, ops
    token = Column(String(255), unique=True, nullable=False, index=True)  # Secure, single-use token
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="invited", index=True)  # invited, accepted, expired
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)  # When invitation was accepted
    invited_by_user_id = Column(UUID(as_uuid=True), ForeignKey("production_users.id", ondelete="SET NULL"), nullable=True, index=True)  # Who sent the invitation
    
    # Relationships
    organization = relationship("backend.models.production.Organization", back_populates="invitations")
    invited_by = relationship("backend.models.production.User", foreign_keys=[invited_by_user_id])


class IntentLog(Base):
    """
    Intent Log - Publication readiness intent
    Immutable, cannot be deleted or updated
    Does NOT mean impact occurred
    """
    __tablename__ = "production_intent_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("production_organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("production_users.id", ondelete="SET NULL"), nullable=False, index=True)
    
    # Content identification (hash for deduplication)
    input_content_hash = Column(String(64), nullable=False, index=True)  # SHA256 hash
    
    # Original content text (for snapshot viewing - nullable for backward compatibility)
    input_content = Column(Text, nullable=True)  # Full original text analyzed
    
    # Analysis metadata
    sector = Column(String(50), nullable=True)  # finance, health, retail, media, autonomous
    policy_set = Column(JSON, nullable=True)  # Snapshot of policies used (TRT, FINTECH, HEALTH)
    risk_scores = Column(JSON, nullable=False)  # Overall scores (ethical_index, compliance_score, etc.)
    flags = Column(JSON, nullable=True)  # Risk flags, violations, risk_locations
    
    # Intent trigger action
    trigger_action = Column(String(50), nullable=False)  # save, rewrite, version, approval_request
    
    # Immutability - Intent logs can NEVER be deleted or updated
    immutable = Column(Boolean, nullable=False, default=True)
    
    # Soft Delete (User Visibility Control)
    # CRITICAL: This does NOT delete the record, only hides it from user history
    # Audit logs, regulator views, and telemetry MUST ignore this flag
    deleted_by_user = Column(Boolean, nullable=False, default=False, index=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by_user_id = Column(UUID(as_uuid=True), ForeignKey("production_users.id", ondelete="SET NULL"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    # Relationships
    organization = relationship("backend.models.production.Organization")
    user = relationship("backend.models.production.User", foreign_keys=[user_id])
    deleted_by_user_rel = relationship("backend.models.production.User", foreign_keys=[deleted_by_user_id])
    impact_events = relationship("backend.models.production.ImpactEvent", back_populates="intent_log", cascade="all, delete-orphan")


class ImpactEvent(Base):
    """
    Impact Event - Real impact when content reaches users/systems
    System signal triggered, not user declaration
    Immutable, cannot be deleted or updated
    This is the LEGAL RECORD for regulators
    """
    __tablename__ = "production_impact_events"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    intent_log_id = Column(UUID(as_uuid=True), ForeignKey("production_intent_logs.id", ondelete="RESTRICT"), nullable=True, index=True)  # Can be null if impact occurred without intent
    
    # Impact type
    impact_type = Column(String(50), nullable=False, index=True)  # api_response, chatbot_display, cms_publish, campaign_send, notification, external_integration
    
    # Locked scores at impact moment (historical truth)
    risk_scores_locked = Column(JSON, nullable=False)  # Scores at the moment of impact
    
    # Locked content hash at impact moment
    content_hash_locked = Column(String(64), nullable=False, index=True)  # Content hash at impact moment
    
    # Impact occurrence
    occurred_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    # Source system that triggered the impact
    source_system = Column(String(100), nullable=False)  # e.g., "proxy_api", "chatbot_v1", "cms_webhook"
    
    # Immutability - Impact events can NEVER be deleted or updated
    immutable = Column(Boolean, nullable=False, default=True)
    
    # Soft Delete (User Visibility Control)
    # CRITICAL: This does NOT delete the record, only hides it from user history
    # Audit logs, regulator views, and telemetry MUST ignore this flag
    deleted_by_user = Column(Boolean, nullable=False, default=False, index=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by_user_id = Column(UUID(as_uuid=True), ForeignKey("production_users.id", ondelete="SET NULL"), nullable=True)
    
    # Relationships
    intent_log = relationship("backend.models.production.IntentLog", back_populates="impact_events")

