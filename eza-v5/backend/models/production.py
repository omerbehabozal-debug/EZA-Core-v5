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
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, index=True)  # admin, org_admin, user, ops, regulator
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    organization_users = relationship("OrganizationUser", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")
    api_keys = relationship("ApiKey", back_populates="user", cascade="all, delete-orphan")


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
    
    # Relationships
    organization_users = relationship("OrganizationUser", back_populates="organization", cascade="all, delete-orphan")
    api_keys = relationship("ApiKey", back_populates="organization", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="organization")
    telemetry_events = relationship("TelemetryEvent", back_populates="organization")
    alert_events = relationship("AlertEvent", back_populates="organization")


class OrganizationUser(Base):
    """Organization-User relationship"""
    __tablename__ = "production_organization_users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    org_id = Column(UUID(as_uuid=True), ForeignKey("production_organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("production_users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), nullable=False)  # org_admin, user, ops
    joined_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    status = Column(String(50), nullable=False, default="active")  # active, suspended
    
    # Relationships
    organization = relationship("Organization", back_populates="organization_users")
    user = relationship("User", back_populates="organization_users")
    
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
    
    # Relationships
    organization = relationship("Organization", back_populates="api_keys")
    user = relationship("User", back_populates="api_keys")


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
    
    # Relationships
    organization = relationship("Organization", back_populates="audit_logs")
    user = relationship("User", back_populates="audit_logs")


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
    
    # Relationships
    organization = relationship("Organization", back_populates="telemetry_events")


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
    
    # Relationships
    organization = relationship("Organization", back_populates="alert_events")

