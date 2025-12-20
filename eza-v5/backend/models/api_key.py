# -*- coding: utf-8 -*-
"""
API Key Model
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.core.utils.dependencies import Base


class APIKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True, index=True)
    key_hash = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=True)
    scopes = Column(String, nullable=True)  # JSON array of scopes
    is_active = Column(Boolean, default=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships - Use class names only (SQLAlchemy resolves from registry)
    user = relationship("LegacyUser", back_populates="api_keys")
    institution = relationship("Institution", back_populates="api_keys")
    application = relationship("Application", back_populates="api_keys")

