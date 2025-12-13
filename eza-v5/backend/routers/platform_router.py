# -*- coding: utf-8 -*-
"""
Platform Router
API key management and content stream endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from pydantic import BaseModel
from backend.core.utils.dependencies import get_db
from backend.services import api_key_service
from backend.services.audit_service import log_operation
from datetime import datetime

router = APIRouter()


# Request/Response Models
class ApiKeyCreateRequest(BaseModel):
    name: str
    user_id: int
    institution_id: Optional[int] = None
    application_id: Optional[int] = None
    expires_days: Optional[int] = None


class ApiKeyResponse(BaseModel):
    id: int
    name: str
    key: str  # Plain text key (only on creation)
    user_id: int
    institution_id: Optional[int] = None
    application_id: Optional[int] = None
    is_active: bool
    expires_at: Optional[str] = None
    created_at: str


class ApiKeyListResponse(BaseModel):
    id: int
    name: str
    user_id: int
    institution_id: Optional[int] = None
    application_id: Optional[int] = None
    is_active: bool
    last_used_at: Optional[str] = None
    expires_at: Optional[str] = None
    created_at: str
    
    class Config:
        from_attributes = True


class StreamItem(BaseModel):
    id: str
    content: str
    risk_score: float
    timestamp: str


@router.get("/api-keys", response_model=List[ApiKeyListResponse])
async def list_api_keys(
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    institution_id: Optional[int] = Query(None, description="Filter by institution ID"),
    db: AsyncSession = Depends(get_db)
):
    """List API keys"""
    try:
        api_keys = await api_key_service.list_api_keys(
            db=db,
            user_id=user_id,
            institution_id=institution_id
        )
        
        # Log operation
        await log_operation(
            db=db,
            endpoint="/platform/api-keys",
            method="GET",
            actor="system",
            result="success",
            meta={"count": len(api_keys)}
        )
        
        return [
            ApiKeyListResponse(
                id=key.id,
                name=key.name,
                user_id=key.user_id,
                institution_id=key.institution_id,
                application_id=key.application_id,
                is_active=key.is_active,
                last_used_at=key.last_used_at.isoformat() if key.last_used_at else None,
                expires_at=key.expires_at.isoformat() if key.expires_at else None,
                created_at=key.created_at.isoformat() if key.created_at else ""
            )
            for key in api_keys
        ]
    except Exception as e:
        await log_operation(
            db=db,
            endpoint="/platform/api-keys",
            method="GET",
            actor="system",
            result="error",
            meta={"error": str(e)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing API keys: {str(e)}"
        )


@router.post("/api-keys", response_model=ApiKeyResponse)
async def create_api_key(
    request: ApiKeyCreateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Generate a new API key"""
    try:
        result = await api_key_service.generate_api_key(
            db=db,
            user_id=request.user_id,
            name=request.name,
            institution_id=request.institution_id,
            application_id=request.application_id,
            expires_days=request.expires_days
        )
        
        api_key = result["api_key"]
        plain_key = result["key"]
        
        # Log operation
        await log_operation(
            db=db,
            endpoint="/platform/api-keys",
            method="POST",
            actor="system",
            result="success",
            meta={"api_key_id": api_key.id}
        )
        
        return ApiKeyResponse(
            id=api_key.id,
            name=api_key.name,
            key=plain_key,
            user_id=api_key.user_id,
            institution_id=api_key.institution_id,
            application_id=api_key.application_id,
            is_active=api_key.is_active,
            expires_at=api_key.expires_at.isoformat() if api_key.expires_at else None,
            created_at=api_key.created_at.isoformat() if api_key.created_at else ""
        )
    except Exception as e:
        await log_operation(
            db=db,
            endpoint="/platform/api-keys",
            method="POST",
            actor="system",
            result="error",
            meta={"error": str(e)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating API key: {str(e)}"
        )


@router.delete("/api-keys/{api_key_id}")
async def revoke_api_key(
    api_key_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Revoke an API key"""
    try:
        success = await api_key_service.revoke_api_key(
            db=db,
            api_key_id=api_key_id
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )
        
        # Log operation
        await log_operation(
            db=db,
            endpoint=f"/platform/api-keys/{api_key_id}",
            method="DELETE",
            actor="system",
            result="success"
        )
        
        return {"message": "API key revoked successfully"}
    except HTTPException:
        raise
    except Exception as e:
        await log_operation(
            db=db,
            endpoint=f"/platform/api-keys/{api_key_id}",
            method="DELETE",
            actor="system",
            result="error",
            meta={"error": str(e)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error revoking API key: {str(e)}"
        )


@router.get("/stream", response_model=List[StreamItem])
async def get_stream(
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    """Get content moderation stream (mock event stream)"""
    try:
        # Mock stream data - in production, this would be a real-time stream
        from backend.services.case_service import list_cases
        
        cases = await list_cases(db=db, limit=limit)
        
        stream_items = [
            StreamItem(
                id=f"stream_{case.id}",
                content=case.text[:100] + "..." if len(case.text) > 100 else case.text,
                risk_score=case.risk_score,
                timestamp=case.created_at.isoformat() if case.created_at else datetime.utcnow().isoformat()
            )
            for case in cases
        ]
        
        # Log operation
        await log_operation(
            db=db,
            endpoint="/platform/stream",
            method="GET",
            actor="system",
            result="success",
            meta={"count": len(stream_items)}
        )
        
        return stream_items
    except Exception as e:
        await log_operation(
            db=db,
            endpoint="/platform/stream",
            method="GET",
            actor="system",
            result="error",
            meta={"error": str(e)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching stream: {str(e)}"
        )

