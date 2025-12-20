# -*- coding: utf-8 -*-
"""
Institution Model
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.core.utils.dependencies import Base


class Institution(Base):
    __tablename__ = "institutions"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    domain = Column(String, unique=True, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    code = Column(String, unique=True, nullable=True, index=True)  # Institution code
    
    # Relationships
    users = relationship("backend.models.user.LegacyUser", back_populates="institution")
    api_keys = relationship("backend.models.api_key.APIKey", back_populates="institution")
    applications = relationship("backend.models.application.Application", back_populates="institution")

