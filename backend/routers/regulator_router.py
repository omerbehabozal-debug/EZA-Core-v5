# -*- coding: utf-8 -*-
"""
Regulator Router (RTÜK)
Regulatory case management endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from pydantic import BaseModel
from backend.core.utils.dependencies import get_db
from backend.services import case_service, risk_service, report_service
from backend.services.audit_service import log_operation
import json

router = APIRouter()


# Response Models
class CaseResponse(BaseModel):
    id: int
    text: str
    risk_score: float
    risk_level: str
    source: str
    metadata: Optional[dict] = None
    created_at: str
    
    class Config:
        from_attributes = True


class RiskMatrixResponse(BaseModel):
    matrix: List[List[dict]]
    total_cases: int
    summary: dict


class ReportResponse(BaseModel):
    metadata: dict
    content: dict


@router.get("/cases", response_model=List[CaseResponse])
async def get_cases(
    source: Optional[str] = Query(None, description="Filter by source"),
    risk_level: Optional[str] = Query(None, description="Filter by risk level"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """Get regulatory cases"""
    try:
        cases = await case_service.list_cases(
            db=db,
            source=source,
            risk_level=risk_level,
            limit=limit,
            offset=offset
        )
        
        # Log operation
        await log_operation(
            db=db,
            endpoint="/regulator/cases",
            method="GET",
            actor="system",
            result="success",
            meta={"count": len(cases)}
        )
        
        return [
            CaseResponse(
                id=case.id,
                text=case.text,
                risk_score=case.risk_score,
                risk_level=case.risk_level,
                source=case.source,
                metadata=json.loads(case.meta_data) if case.meta_data else None,
                created_at=case.created_at.isoformat() if case.created_at else ""
            )
            for case in cases
        ]
    except Exception as e:
        await log_operation(
            db=db,
            endpoint="/regulator/cases",
            method="GET",
            actor="system",
            result="error",
            meta={"error": str(e)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching cases: {str(e)}"
        )


@router.get("/risk-matrix", response_model=RiskMatrixResponse)
async def get_risk_matrix(
    source: Optional[str] = Query(None, description="Filter by source"),
    db: AsyncSession = Depends(get_db)
):
    """Get 3x3 risk matrix heatmap"""
    try:
        matrix_data = await risk_service.compute_risk_matrix_from_db(
            db=db,
            source=source
        )
        
        # Log operation
        await log_operation(
            db=db,
            endpoint="/regulator/risk-matrix",
            method="GET",
            actor="system",
            result="success"
        )
        
        return RiskMatrixResponse(**matrix_data)
    except Exception as e:
        await log_operation(
            db=db,
            endpoint="/regulator/risk-matrix",
            method="GET",
            actor="system",
            result="error",
            meta={"error": str(e)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error computing risk matrix: {str(e)}"
        )


@router.get("/reports", response_model=ReportResponse)
async def get_reports(
    format: str = Query("json", regex="^(json|pdf)$"),
    db: AsyncSession = Depends(get_db)
):
    """Generate RTÜK regulatory report"""
    try:
        report = await report_service.generate_rtuk_report(
            db=db,
            format=format
        )
        
        # Log operation
        await log_operation(
            db=db,
            endpoint="/regulator/reports",
            method="GET",
            actor="system",
            result="success",
            meta={"format": format}
        )
        
        return ReportResponse(**report)
    except Exception as e:
        await log_operation(
            db=db,
            endpoint="/regulator/reports",
            method="GET",
            actor="system",
            result="error",
            meta={"error": str(e)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating report: {str(e)}"
        )

