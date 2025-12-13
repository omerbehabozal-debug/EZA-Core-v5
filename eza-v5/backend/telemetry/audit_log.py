# -*- coding: utf-8 -*-
"""
Audit Logging - Persist who asked what, risk scores, and actions
"""

from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, Text
from sqlalchemy.sql import func
from backend.core.utils.dependencies import Base, get_db
from backend.telemetry.logger import setup_logger

logger = setup_logger("eza.audit")


class AuditLog(Base):
    """Audit log model"""
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    institution_id = Column(Integer, nullable=True, index=True)
    endpoint = Column(String, nullable=False)
    method = Column(String, nullable=False)
    input_hash = Column(String, nullable=True)  # Hash of input for privacy
    risk_score = Column(Float, nullable=True)
    eza_score = Column(Float, nullable=True)
    action_taken = Column(String, nullable=True)  # "allowed", "blocked", "rewritten"
    policy_pack = Column(String, nullable=True)
    meta_data = Column("metadata", JSON, nullable=True)  # Renamed to avoid conflict with Base.metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())


async def log_audit_event(
    db: AsyncSession,
    endpoint: str,
    method: str,
    user_id: Optional[int] = None,
    institution_id: Optional[int] = None,
    input_hash: Optional[str] = None,
    risk_score: Optional[float] = None,
    eza_score: Optional[float] = None,
    action_taken: Optional[str] = None,
    policy_pack: Optional[str] = None,
    meta_data: Optional[Dict[str, Any]] = None,
):
    """Log audit event to database"""
    try:
        audit_log = AuditLog(
            user_id=user_id,
            institution_id=institution_id,
            endpoint=endpoint,
            method=method,
            input_hash=input_hash,
            risk_score=risk_score,
            eza_score=eza_score,
            action_taken=action_taken,
            policy_pack=policy_pack,
            meta_data=meta_data
        )
        db.add(audit_log)
        await db.commit()
    except Exception as e:
        logger.error(f"Failed to write audit log: {e}")
        await db.rollback()


async def log_high_risk_event(
    db: AsyncSession,
    endpoint: str,
    method: str,
    risk_score: float,
    eza_score: Optional[float] = None,
    user_id: Optional[int] = None,
    institution_id: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
):
    """Log high-risk event (convenience function)"""
    await log_audit_event(
        db=db,
        endpoint=endpoint,
        method=method,
        user_id=user_id,
        institution_id=institution_id,
        risk_score=risk_score,
        eza_score=eza_score,
        action_taken="blocked" if risk_score > 0.8 else "flagged",
        metadata=metadata
    )

