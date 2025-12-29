# -*- coding: utf-8 -*-
"""
EU AI Act Router
AI model registry and risk profiling endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from backend.core.utils.dependencies import get_db
from backend.services import model_registry_service
from backend.services.audit_service import log_operation
import json

router = APIRouter()


# Request/Response Models
class ModelRegisterRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    
    model_name: str
    version: str
    risk_profile: Optional[dict] = None
    provider: Optional[str] = None


class ModelResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=(), from_attributes=True)
    
    id: int
    model_name: str
    version: str
    risk_profile: Optional[dict] = None
    provider: Optional[str] = None
    compliance_status: Optional[str] = None
    created_at: str


class RiskProfileResponse(BaseModel):
    risk_profile: dict


@router.get("/models", response_model=List[ModelResponse])
async def list_models(
    provider: Optional[str] = Query(None, description="Filter by provider"),
    compliance_status: Optional[str] = Query(None, description="Filter by compliance status"),
    db: AsyncSession = Depends(get_db)
):
    """List registered AI models"""
    try:
        models = await model_registry_service.list_models(
            db=db,
            provider=provider,
            compliance_status=compliance_status
        )
        
        # Log operation
        await log_operation(
            db=db,
            endpoint="/eu-ai/models",
            method="GET",
            actor="system",
            result="success",
            meta={"count": len(models)}
        )
        
        return [
            ModelResponse(
                id=model.id,
                model_name=model.model_name,
                version=model.version,
                risk_profile=json.loads(model.risk_profile) if model.risk_profile else None,
                provider=model.provider,
                compliance_status=model.compliance_status,
                created_at=model.created_at.isoformat() if model.created_at else ""
            )
            for model in models
        ]
    except Exception as e:
        await log_operation(
            db=db,
            endpoint="/eu-ai/models",
            method="GET",
            actor="system",
            result="error",
            meta={"error": str(e)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing models: {str(e)}"
        )


@router.post("/models", response_model=ModelResponse)
async def register_model(
    request: ModelRegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """Register a new AI model"""
    try:
        model = await model_registry_service.register_model(
            db=db,
            model_name=request.model_name,
            version=request.version,
            risk_profile=request.risk_profile,
            provider=request.provider
        )
        
        # Log operation
        await log_operation(
            db=db,
            endpoint="/eu-ai/models",
            method="POST",
            actor="system",
            result="success",
            meta={"model_id": model.id, "model_name": model.model_name}
        )
        
        return ModelResponse(
            id=model.id,
            model_name=model.model_name,
            version=model.version,
            risk_profile=json.loads(model.risk_profile) if model.risk_profile else None,
            provider=model.provider,
            compliance_status=model.compliance_status,
            created_at=model.created_at.isoformat() if model.created_at else ""
        )
    except Exception as e:
        await log_operation(
            db=db,
            endpoint="/eu-ai/models",
            method="POST",
            actor="system",
            result="error",
            meta={"error": str(e)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error registering model: {str(e)}"
        )


@router.get("/risk-profile/{model_id}", response_model=RiskProfileResponse)
async def get_risk_profile(
    model_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get risk profile for a model"""
    try:
        risk_profile = await model_registry_service.get_risk_profile(
            db=db,
            model_id=model_id
        )
        
        if risk_profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Risk profile not found for this model"
            )
        
        # Log operation
        await log_operation(
            db=db,
            endpoint=f"/eu-ai/risk-profile/{model_id}",
            method="GET",
            actor="system",
            result="success"
        )
        
        return RiskProfileResponse(risk_profile=risk_profile)
    except HTTPException:
        raise
    except Exception as e:
        await log_operation(
            db=db,
            endpoint=f"/eu-ai/risk-profile/{model_id}",
            method="GET",
            actor="system",
            result="error",
            meta={"error": str(e)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching risk profile: {str(e)}"
        )

