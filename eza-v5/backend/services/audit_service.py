# -*- coding: utf-8 -*-
"""
Audit Service
Handles audit log operations
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from backend.telemetry.audit_log import AuditLog, log_audit_event
from datetime import datetime


async def get_audit_logs(
    db: AsyncSession,
    endpoint: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
) -> List[AuditLog]:
    """
    Get audit logs with optional filtering
    
    Args:
        db: Database session
        endpoint: Filter by endpoint
        limit: Maximum number of logs to return
        offset: Offset for pagination
    
    Returns:
        List of AuditLog objects
    """
    query = select(AuditLog)
    
    if endpoint:
        query = query.where(AuditLog.endpoint == endpoint)
    
    query = query.order_by(desc(AuditLog.created_at)).limit(limit).offset(offset)
    
    result = await db.execute(query)
    return list(result.scalars().all())


async def log_operation(
    db: AsyncSession,
    endpoint: str,
    method: str,
    actor: Optional[str] = None,
    result: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None
) -> None:
    """
    Log an operation to audit log
    
    Args:
        db: Database session
        endpoint: Endpoint name
        method: HTTP method
        actor: Actor identifier (user, system, etc.)
        result: Operation result
        meta: Additional metadata
    """
    await log_audit_event(
        db=db,
        endpoint=endpoint,
        method=method,
        user_id=None,  # Could extract from actor if needed
        meta_data={
            "actor": actor,
            "result": result,
            **(meta or {})
        }
    )

