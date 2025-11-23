# -*- coding: utf-8 -*-
"""
BTK Router
Network traffic risk evaluation endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from pydantic import BaseModel
from backend.core.utils.dependencies import get_db
from backend.services import traffic_service, audit_service
from backend.services.audit_service import log_operation

router = APIRouter()


# Request/Response Models
class TrafficRiskRequest(BaseModel):
    text: str
    metadata: Optional[dict] = None


class TrafficRiskResponse(BaseModel):
    risk_score: float
    risk_level: str
    traffic_category: str
    analysis: dict


class AuditLogResponse(BaseModel):
    id: int
    endpoint: str
    method: str
    actor: Optional[str] = None
    result: Optional[str] = None
    meta: Optional[dict] = None
    created_at: str
    
    class Config:
        from_attributes = True


@router.post("/traffic-risk", response_model=TrafficRiskResponse)
async def evaluate_traffic_risk(
    request: TrafficRiskRequest,
    db: AsyncSession = Depends(get_db)
):
    """Evaluate network traffic for risk"""
    try:
        result = traffic_service.evaluate_traffic(request.text)
        
        # Log operation
        await log_operation(
            db=db,
            endpoint="/btk/traffic-risk",
            method="POST",
            actor="system",
            result="success",
            meta={
                "risk_score": result["risk_score"],
                "category": result["traffic_category"]
            }
        )
        
        return TrafficRiskResponse(**result)
    except Exception as e:
        await log_operation(
            db=db,
            endpoint="/btk/traffic-risk",
            method="POST",
            actor="system",
            result="error",
            meta={"error": str(e)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error evaluating traffic risk: {str(e)}"
        )


@router.get("/audit-log", response_model=List[AuditLogResponse])
async def get_audit_log(
    endpoint: Optional[str] = Query(None, description="Filter by endpoint"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """Get audit logs"""
    try:
        logs = await audit_service.get_audit_logs(
            db=db,
            endpoint=endpoint,
            limit=limit,
            offset=offset
        )
        
        # Log operation
        await log_operation(
            db=db,
            endpoint="/btk/audit-log",
            method="GET",
            actor="system",
            result="success",
            meta={"count": len(logs)}
        )
        
        return [
            AuditLogResponse(
                id=log.id,
                endpoint=log.endpoint,
                method=log.method,
                actor=log.meta_data.get("actor") if log.meta_data else None,
                result=log.meta_data.get("result") if log.meta_data else None,
                meta=log.meta_data,
                created_at=log.created_at.isoformat() if log.created_at else ""
            )
            for log in logs
        ]
    except Exception as e:
        await log_operation(
            db=db,
            endpoint="/btk/audit-log",
            method="GET",
            actor="system",
            result="error",
            meta={"error": str(e)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching audit logs: {str(e)}"
        )

