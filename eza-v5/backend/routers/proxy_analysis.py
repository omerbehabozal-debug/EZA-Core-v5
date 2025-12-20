# -*- coding: utf-8 -*-
"""
EZA Proxy - Analysis Record Management
Draft and Saved analysis storage with regulator compliance
"""

import hashlib
import logging
import uuid
from typing import Dict, Any, Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, func
from sqlalchemy.orm import selectinload

from backend.core.utils.dependencies import get_db
from backend.auth.proxy_auth_production import require_proxy_auth_production
from backend.models.production import AnalysisRecord, AuditLog
from backend.services.production_org import check_user_organization_membership

router = APIRouter()
logger = logging.getLogger(__name__)


# ========== REQUEST/RESPONSE MODELS ==========

class SaveAnalysisRequest(BaseModel):
    """Request to save an analysis"""
    analysis_result: Dict[str, Any]  # Full analysis result from /analyze endpoint
    rewrite_mode: Optional[str] = None
    sector: Optional[str] = None
    policies: Optional[List[str]] = None


class AnalysisRecordResponse(BaseModel):
    """Response for a single analysis record"""
    id: str
    organization_id: str
    user_id: str
    input_text_hash: str
    input_text: str
    sector: Optional[str]
    policies_snapshot: Optional[Dict[str, Any]]
    scores: Dict[str, Any]
    violations: Optional[Dict[str, Any]]
    rewrite_mode: Optional[str]
    status: str  # DRAFT, SAVED
    immutable: bool
    created_at: str


class AnalysisHistoryResponse(BaseModel):
    """Response for analysis history list"""
    records: List[AnalysisRecordResponse]
    total: int
    page: int
    page_size: int


# ========== HELPER FUNCTIONS ==========

def generate_text_hash(text: str) -> str:
    """Generate SHA256 hash for input text"""
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


async def log_analysis_audit(
    db: AsyncSession,
    event_type: str,  # analysis_previewed, analysis_saved, analysis_viewed
    user_id: str,
    org_id: str,
    analysis_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
):
    """Log analysis-related audit events"""
    try:
        user_uuid = uuid.UUID(user_id) if user_id else None
        org_uuid = uuid.UUID(org_id) if org_id else None
        analysis_uuid = uuid.UUID(analysis_id) if analysis_id else None
    except (ValueError, TypeError):
        logger.warning(f"[Audit] Invalid UUID format: user_id={user_id}, org_id={org_id}, analysis_id={analysis_id}")
        return
    
    audit_entry = AuditLog(
        id=uuid.uuid4(),
        org_id=org_uuid,
        user_id=user_uuid,
        action=event_type,
        context={
            "source": "proxy",
            "analysis_id": analysis_id,
            **(metadata or {})
        },
        endpoint="/api/proxy/analysis",
        method="POST" if event_type == "analysis_saved" else "GET"
    )
    
    db.add(audit_entry)
    await db.commit()
    logger.info(f"[Audit] {event_type}: user_id={user_id}, org_id={org_id}, analysis_id={analysis_id}")


# ========== ENDPOINTS ==========

@router.post("/save", response_model=AnalysisRecordResponse)
async def save_analysis(
    request: SaveAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production),
    x_org_id: Optional[str] = Header(None, alias="x-org-id")
):
    """
    Save an analysis as SAVED (permanent, regulator-visible)
    
    Authorization:
    - JWT token required
    - organization_id required
    - User must be member of organization
    """
    try:
        user_id = current_user.get('user_id') or current_user.get('sub')
        org_id = x_org_id or current_user.get('org_id')
        
        if not user_id or not org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Kullanıcı veya organizasyon bağlamı eksik."
            )
        
        # Validate user is member of organization
        is_member = await check_user_organization_membership(db, str(user_id), str(org_id))
        if not is_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu organizasyona erişim yetkiniz bulunmamaktadır."
            )
        
        # Extract input text from analysis result
        # The analysis_result should contain the original content
        input_text = request.analysis_result.get('input_text') or request.analysis_result.get('content', '')
        if not input_text:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Analiz sonucunda içerik bulunamadı."
            )
        
        # Generate hash
        input_text_hash = generate_text_hash(input_text)
        
        # Extract scores and violations
        scores = request.analysis_result.get('overall_scores', {})
        violations = {
            'flags': request.analysis_result.get('flags', []),
            'risk_locations': request.analysis_result.get('risk_locations', []),
            'risk_flags_severity': request.analysis_result.get('risk_flags_severity', []),
            'justification': request.analysis_result.get('justification', [])
        }
        
        # Create policies snapshot
        policies_snapshot = {
            'policies': request.policies or [],
            'sector': request.sector,
            'snapshot_time': datetime.utcnow().isoformat()
        }
        
        # Create analysis record
        user_uuid = uuid.UUID(str(user_id))
        org_uuid = uuid.UUID(str(org_id))
        
        analysis_record = AnalysisRecord(
            id=uuid.uuid4(),
            organization_id=org_uuid,
            user_id=user_uuid,
            input_text_hash=input_text_hash,
            input_text=input_text,
            sector=request.sector,
            policies_snapshot=policies_snapshot,
            scores=scores,
            violations=violations,
            rewrite_mode=request.rewrite_mode,
            status="SAVED",  # Saved records are permanent
            immutable=True  # Saved records can never be updated
        )
        
        db.add(analysis_record)
        await db.commit()
        await db.refresh(analysis_record)
        
        # Audit log
        await log_analysis_audit(
            db=db,
            event_type="analysis_saved",
            user_id=str(user_id),
            org_id=str(org_id),
            analysis_id=str(analysis_record.id),
            metadata={
                "sector": request.sector,
                "policies": request.policies,
                "scores": scores
            }
        )
        
        logger.info(f"[Analysis] Saved: id={analysis_record.id}, user_id={user_id}, org_id={org_id}")
        
        return AnalysisRecordResponse(
            id=str(analysis_record.id),
            organization_id=str(analysis_record.organization_id),
            user_id=str(analysis_record.user_id),
            input_text_hash=analysis_record.input_text_hash,
            input_text=analysis_record.input_text,
            sector=analysis_record.sector,
            policies_snapshot=analysis_record.policies_snapshot,
            scores=analysis_record.scores,
            violations=analysis_record.violations,
            rewrite_mode=analysis_record.rewrite_mode,
            status=analysis_record.status,
            immutable=analysis_record.immutable,
            created_at=analysis_record.created_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Analysis] Save error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analiz kaydedilemedi: {str(e)}"
        )


@router.get("/history", response_model=AnalysisHistoryResponse)
async def get_analysis_history(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production),
    x_org_id: Optional[str] = Header(None, alias="x-org-id"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """
    Get analysis history (only SAVED records)
    
    Authorization:
    - JWT token required
    - organization_id required
    - User must be member of organization
    - Role-based visibility
    """
    try:
        user_id = current_user.get('user_id') or current_user.get('sub')
        org_id = x_org_id or current_user.get('org_id')
        user_role = current_user.get('role', '')
        
        if not user_id or not org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Kullanıcı veya organizasyon bağlamı eksik."
            )
        
        # Validate user is member of organization
        is_member = await check_user_organization_membership(db, str(user_id), str(org_id))
        if not is_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu organizasyona erişim yetkiniz bulunmamaktadır."
            )
        
        org_uuid = uuid.UUID(str(org_id))
        user_uuid = uuid.UUID(str(user_id))
        
        # Build query - only SAVED records
        query = select(AnalysisRecord).where(
            and_(
                AnalysisRecord.organization_id == org_uuid,
                AnalysisRecord.status == "SAVED"
            )
        )
        
        # Role-based filtering: regular users see only their own records
        if user_role not in ["admin", "org_admin", "ops", "auditor"]:
            query = query.where(AnalysisRecord.user_id == user_uuid)
        
        # Order by created_at descending
        query = query.order_by(desc(AnalysisRecord.created_at))
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        
        # Pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        
        # Execute query
        result = await db.execute(query)
        records = result.scalars().all()
        
        # Audit log
        await log_analysis_audit(
            db=db,
            event_type="analysis_viewed",
            user_id=str(user_id),
            org_id=str(org_id),
            metadata={"page": page, "page_size": page_size, "total": total}
        )
        
        return AnalysisHistoryResponse(
            records=[
                AnalysisRecordResponse(
                    id=str(record.id),
                    organization_id=str(record.organization_id),
                    user_id=str(record.user_id),
                    input_text_hash=record.input_text_hash,
                    input_text=record.input_text,
                    sector=record.sector,
                    policies_snapshot=record.policies_snapshot,
                    scores=record.scores,
                    violations=record.violations,
                    rewrite_mode=record.rewrite_mode,
                    status=record.status,
                    immutable=record.immutable,
                    created_at=record.created_at.isoformat()
                )
                for record in records
            ],
            total=total,
            page=page,
            page_size=page_size
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Analysis] History error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analiz geçmişi alınamadı: {str(e)}"
        )


@router.get("/{analysis_id}", response_model=AnalysisRecordResponse)
async def get_analysis(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production),
    x_org_id: Optional[str] = Header(None, alias="x-org-id")
):
    """
    Get a single analysis record (immutable snapshot)
    
    Authorization:
    - JWT token required
    - organization_id required
    - User must be member of organization
    - Role-based visibility
    """
    try:
        user_id = current_user.get('user_id') or current_user.get('sub')
        org_id = x_org_id or current_user.get('org_id')
        user_role = current_user.get('role', '')
        
        if not user_id or not org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Kullanıcı veya organizasyon bağlamı eksik."
            )
        
        # Validate UUID format
        try:
            analysis_uuid = uuid.UUID(analysis_id)
            org_uuid = uuid.UUID(str(org_id))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Geçersiz analiz kimliği formatı."
            )
        
        # Get analysis record
        result = await db.execute(
            select(AnalysisRecord).where(
                and_(
                    AnalysisRecord.id == analysis_uuid,
                    AnalysisRecord.organization_id == org_uuid
                )
            )
        )
        record = result.scalar_one_or_none()
        
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Analiz kaydı bulunamadı."
            )
        
        # Role-based access: regular users can only see their own records
        user_uuid = uuid.UUID(str(user_id))
        if user_role not in ["admin", "org_admin", "ops", "auditor"]:
            if record.user_id != user_uuid:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Bu analiz kaydına erişim yetkiniz bulunmamaktadır."
                )
        
        # Audit log
        await log_analysis_audit(
            db=db,
            event_type="analysis_viewed",
            user_id=str(user_id),
            org_id=str(org_id),
            analysis_id=analysis_id
        )
        
        return AnalysisRecordResponse(
            id=str(record.id),
            organization_id=str(record.organization_id),
            user_id=str(record.user_id),
            input_text_hash=record.input_text_hash,
            input_text=record.input_text,
            sector=record.sector,
            policies_snapshot=record.policies_snapshot,
            scores=record.scores,
            violations=record.violations,
            rewrite_mode=record.rewrite_mode,
            status=record.status,
            immutable=record.immutable,
            created_at=record.created_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Analysis] Get error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analiz kaydı alınamadı: {str(e)}"
        )

