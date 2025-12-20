# -*- coding: utf-8 -*-
"""
Application Model (per-institution apps/clients)
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.core.utils.dependencies import Base


class Application(Base):
    __tablename__ = "applications"
    
    id = Column(Integer, primary_key=True, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    client_id = Column(String, unique=True, nullable=False, index=True)
    client_secret = Column(String, nullable=False)  # Hashed
    status = Column(String, default="active")  # active, suspended, revoked
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships - Use class names only (SQLAlchemy resolves from registry)
    institution = relationship("Institution", back_populates="applications")
    api_keys = relationship("APIKey", back_populates="application")


