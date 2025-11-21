# -*- coding: utf-8 -*-
"""
Role Model
"""

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from backend.core.utils.dependencies import Base


class Role(Base):
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    description = Column(String, nullable=True)
    
    # Relationships
    users = relationship("User", back_populates="role")

