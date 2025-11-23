# -*- coding: utf-8 -*-
"""
Corporate Router
Corporate audit and policy management endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from pydantic import BaseModel
from backend.core.utils.dependencies import get_db
from backend.services import policy_service, audit_service
from backend.services.audit_service import log_operation
import json

router = APIRouter()


# Response Models
class AuditItemResponse(BaseModel):
    id: int
    endpoint: str
    method: str
    risk_score: Optional[float] = None
    eza_score: Optional[float] = None
    action_taken: Optional[str] = None
    created_at: str
    
    class Config:
        from_attributes = True


class PolicyResponse(BaseModel):
    id: int
    tenant: str
    rules: dict
    policy_type: str
    is_active: str
    created_at: str
    updated_at: str


class PolicyUpdateRequest(BaseModel):
    rules: dict
    policy_type: Optional[str] = "default"


@router.get("/audit", response_model=List[AuditItemResponse])
async def get_audit(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """Get corporate audit logs"""
    try:
        logs = await audit_service.get_audit_logs(
            db=db,
            limit=limit,
            offset=offset
        )
        
        # Log operation
        await log_operation(
            db=db,
            endpoint="/corporate/audit",
            method="GET",
            actor="system",
            result="success",
            meta={"count": len(logs)}
        )
        
        return [
            AuditItemResponse(
                id=log.id,
                endpoint=log.endpoint,
                method=log.method,
                risk_score=log.risk_score,
                eza_score=log.eza_score,
                action_taken=log.action_taken,
                created_at=log.created_at.isoformat() if log.created_at else ""
            )
            for log in logs
        ]
    except Exception as e:
        await log_operation(
            db=db,
            endpoint="/corporate/audit",
            method="GET",
            actor="system",
            result="error",
            meta={"error": str(e)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching audit logs: {str(e)}"
        )


@router.get("/policy", response_model=PolicyResponse)
async def get_policy(
    tenant: str = Query(..., description="Tenant identifier"),
    db: AsyncSession = Depends(get_db)
):
    """Get policy for a tenant"""
    try:
        policy = await policy_service.get_policy(db=db, tenant=tenant)
        
        if not policy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Policy not found for this tenant"
            )
        
        # Log operation
        await log_operation(
            db=db,
            endpoint="/corporate/policy",
            method="GET",
            actor="system",
            result="success",
            meta={"tenant": tenant}
        )
        
        return PolicyResponse(
            id=policy.id,
            tenant=policy.tenant,
            rules=json.loads(policy.rules) if policy.rules else {},
            policy_type=policy.policy_type,
            is_active=policy.is_active,
            created_at=policy.created_at.isoformat() if policy.created_at else "",
            updated_at=policy.updated_at.isoformat() if policy.updated_at else ""
        )
    except HTTPException:
        raise
    except Exception as e:
        await log_operation(
            db=db,
            endpoint="/corporate/policy",
            method="GET",
            actor="system",
            result="error",
            meta={"error": str(e)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching policy: {str(e)}"
        )


@router.post("/policy", response_model=PolicyResponse)
async def update_policy(
    tenant: str = Query(..., description="Tenant identifier"),
    request: PolicyUpdateRequest = ...,
    db: AsyncSession = Depends(get_db)
):
    """Update or create policy for a tenant"""
    try:
        policy = await policy_service.update_policy(
            db=db,
            tenant=tenant,
            rules=request.rules,
            policy_type=request.policy_type or "default"
        )
        
        # Log operation
        await log_operation(
            db=db,
            endpoint="/corporate/policy",
            method="POST",
            actor="system",
            result="success",
            meta={"tenant": tenant, "policy_type": policy.policy_type}
        )
        
        return PolicyResponse(
            id=policy.id,
            tenant=policy.tenant,
            rules=json.loads(policy.rules) if policy.rules else {},
            policy_type=policy.policy_type,
            is_active=policy.is_active,
            created_at=policy.created_at.isoformat() if policy.created_at else "",
            updated_at=policy.updated_at.isoformat() if policy.updated_at else ""
        )
    except Exception as e:
        await log_operation(
            db=db,
            endpoint="/corporate/policy",
            method="POST",
            actor="system",
            result="error",
            meta={"error": str(e)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating policy: {str(e)}"
        )

