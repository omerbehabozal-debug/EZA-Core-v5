# -*- coding: utf-8 -*-
"""
Corporate Policy Model
Stores tenant-specific policy configurations
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Index
from sqlalchemy.sql import func
from backend.core.utils.dependencies import Base


class CorporatePolicy(Base):
    __tablename__ = "corporate_policies"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant = Column(String(255), nullable=False, index=True)  # Tenant identifier
    rules = Column(Text, nullable=False)  # JSON string for policy rules
    policy_type = Column(String(100), nullable=True, default="default")  # default, custom, regulatory
    is_active = Column(String(10), nullable=False, default="true")  # true/false as string for simplicity
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Unique constraint on tenant (one active policy per tenant)
    __table_args__ = (
        Index('idx_tenant_active', 'tenant', 'is_active'),
    )

