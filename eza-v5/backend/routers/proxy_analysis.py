# -*- coding: utf-8 -*-
"""
EZA Proxy - Intent Log & Impact Event Management
Working Draft → Intent Log → Impact Event flow
Regulator-compliant, immutable records
"""

import hashlib
import logging
import uuid
from typing import Dict, Any, Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, func, or_, Integer

from backend.core.utils.dependencies import get_db
from backend.auth.proxy_auth_production import require_proxy_auth_production
from backend.models.production import IntentLog, ImpactEvent, AuditLog
from backend.services.production_org import check_user_organization_membership

router = APIRouter()
logger = logging.getLogger(__name__)


# ========== REQUEST/RESPONSE MODELS ==========

class CreateIntentLogRequest(BaseModel):
    """Request to create an Intent Log (publication readiness intent)"""
    analysis_result: Dict[str, Any]  # Full analysis result from /analyze endpoint
    trigger_action: str  # save, rewrite, version, approval_request
    sector: Optional[str] = None
    policies: Optional[List[str]] = None


class CreateImpactEventRequest(BaseModel):
    """Request to create an Impact Event (system signal)"""
    intent_log_id: Optional[str] = None  # Can be null if impact occurred without intent
    impact_type: str  # api_response, chatbot_display, cms_publish, campaign_send, notification, external_integration
    content_hash: str  # Content hash at impact moment
    risk_scores: Dict[str, Any]  # Scores at impact moment
    source_system: str  # e.g., "proxy_api", "chatbot_v1", "cms_webhook"


class IntentLogResponse(BaseModel):
    """Response for a single Intent Log"""
    id: str
    organization_id: str
    user_id: str
    input_content_hash: str
    sector: Optional[str]
    policy_set: Optional[Dict[str, Any]]
    risk_scores: Dict[str, Any]
    flags: Optional[Dict[str, Any]]
    trigger_action: str
    immutable: bool
    created_at: str
    impact_events: List[Dict[str, Any]] = []


class ImpactEventResponse(BaseModel):
    """Response for a single Impact Event"""
    id: str
    intent_log_id: Optional[str]
    impact_type: str
    risk_scores_locked: Dict[str, Any]
    content_hash_locked: str
    occurred_at: str
    source_system: str
    immutable: bool


class HistoryResponse(BaseModel):
    """Response for history (Intent Logs and Impact Events)"""
    intent_logs: List[IntentLogResponse]
    impact_events: List[ImpactEventResponse]
    total_intents: int
    total_impacts: int
    page: int
    page_size: int


# ========== HELPER FUNCTIONS ==========

def generate_content_hash(content: str) -> str:
    """Generate SHA256 hash for content"""
    return hashlib.sha256(content.encode('utf-8')).hexdigest()


async def log_analysis_audit(
    db: AsyncSession,
    event_type: str,
    user_id: str,
    org_id: str,
    record_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
):
    """Log analysis-related audit events"""
    try:
        user_uuid = uuid.UUID(user_id) if user_id else None
        org_uuid = uuid.UUID(org_id) if org_id else None
    except (ValueError, TypeError):
        logger.warning(f"[Audit] Invalid UUID format: user_id={user_id}, org_id={org_id}")
        return
    
    audit_entry = AuditLog(
        id=uuid.uuid4(),
        org_id=org_uuid,
        user_id=user_uuid,
        action=event_type,
        context={
            "source": "proxy",
            "record_id": record_id,
            **(metadata or {})
        },
        endpoint="/api/proxy/analysis",
        method="POST"
    )
    
    db.add(audit_entry)
    await db.commit()
    logger.info(f"[Audit] {event_type}: user_id={user_id}, org_id={org_id}, record_id={record_id}")


# ========== ENDPOINTS ==========

@router.post("/intent", response_model=IntentLogResponse)
async def create_intent_log(
    request: CreateIntentLogRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production),
    x_org_id: Optional[str] = Header(None, alias="x-org-id")
):
    """
    Create an Intent Log (publication readiness intent)
    
    Triggered by:
    - "Analizi Kaydet" (save)
    - "Rewrite" (rewrite)
    - "Versiyon Oluştur" (version)
    - "Onaya Gönder" (approval_request)
    
    Rules:
    - Cannot be deleted
    - Cannot be updated
    - Does NOT mean impact occurred
    - Visible to regulator as "Preparation/Intent" label
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
        
        # Validate trigger_action
        valid_actions = ["save", "rewrite", "version", "approval_request"]
        if request.trigger_action not in valid_actions:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Geçersiz trigger_action. Geçerli değerler: {', '.join(valid_actions)}"
            )
        
        # Extract content from analysis result
        input_content = request.analysis_result.get('input_text') or request.analysis_result.get('content', '')
        if not input_content:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Analiz sonucunda içerik bulunamadı."
            )
        
        # Generate hash
        input_content_hash = generate_content_hash(input_content)
        
        # Extract scores and flags
        risk_scores = request.analysis_result.get('overall_scores', {})
        flags = {
            'flags': request.analysis_result.get('flags', []),
            'risk_locations': request.analysis_result.get('risk_locations', []),
            'risk_flags_severity': request.analysis_result.get('risk_flags_severity', []),
            'justification': request.analysis_result.get('justification', [])
        }
        
        # Create policy set snapshot
        policy_set = {
            'policies': request.policies or [],
            'sector': request.sector,
            'snapshot_time': datetime.utcnow().isoformat()
        }
        
        # Create Intent Log
        user_uuid = uuid.UUID(str(user_id))
        org_uuid = uuid.UUID(str(org_id))
        
        intent_log = IntentLog(
            id=uuid.uuid4(),
            organization_id=org_uuid,
            user_id=user_uuid,
            input_content_hash=input_content_hash,
            sector=request.sector,
            policy_set=policy_set,
            risk_scores=risk_scores,
            flags=flags,
            trigger_action=request.trigger_action,
            immutable=True  # Intent logs can NEVER be deleted or updated
        )
        
        db.add(intent_log)
        await db.commit()
        await db.refresh(intent_log)
        
        # Load impact events for this intent log
        impact_result = await db.execute(
            select(ImpactEvent).where(ImpactEvent.intent_log_id == intent_log.id)
        )
        impact_events = impact_result.scalars().all()
        
        # Audit log
        await log_analysis_audit(
            db=db,
            event_type="intent_log_created",
            user_id=str(user_id),
            org_id=str(org_id),
            record_id=str(intent_log.id),
            metadata={
                "trigger_action": request.trigger_action,
                "sector": request.sector,
                "policies": request.policies
            }
        )
        
        logger.info(f"[Intent] Created: id={intent_log.id}, user_id={user_id}, org_id={org_id}, action={request.trigger_action}")
        
        return IntentLogResponse(
            id=str(intent_log.id),
            organization_id=str(intent_log.organization_id),
            user_id=str(intent_log.user_id),
            input_content_hash=intent_log.input_content_hash,
            sector=intent_log.sector,
            policy_set=intent_log.policy_set,
            risk_scores=intent_log.risk_scores,
            flags=intent_log.flags,
            trigger_action=intent_log.trigger_action,
            immutable=intent_log.immutable,
            created_at=intent_log.created_at.isoformat(),
            impact_events=[
                {
                    "id": str(ie.id),
                    "impact_type": ie.impact_type,
                    "occurred_at": ie.occurred_at.isoformat(),
                    "source_system": ie.source_system
                }
                for ie in impact_events
            ]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Intent] Create error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Intent Log oluşturulamadı: {str(e)}"
        )


@router.post("/impact", response_model=ImpactEventResponse)
async def create_impact_event(
    request: CreateImpactEventRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[Dict[str, Any]] = Depends(require_proxy_auth_production),
    x_org_id: Optional[str] = Header(None, alias="x-org-id")
):
    """
    Create an Impact Event (system signal - real impact)
    
    Impact Event is triggered by SYSTEM SIGNALS, not user declarations:
    - Production API response
    - Chatbot answer displayed to user
    - CMS publish webhook
    - Campaign/message sent
    - Customer notification
    - External system integration
    
    Rules:
    - Cannot be deleted
    - Cannot be updated
    - This is the LEGAL RECORD for regulators
    - Scores are LOCKED at impact moment (historical truth)
    """
    try:
        # Impact events can be created by system signals (no user required)
        user_id = current_user.get('user_id') if current_user else None
        org_id = x_org_id or (current_user.get('org_id') if current_user else None)
        
        # Validate impact_type
        valid_types = [
            "api_response", "chatbot_display", "cms_publish",
            "campaign_send", "notification", "external_integration"
        ]
        if request.impact_type not in valid_types:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Geçersiz impact_type. Geçerli değerler: {', '.join(valid_types)}"
            )
        
        # If intent_log_id provided, validate it exists
        intent_log_id_uuid = None
        if request.intent_log_id:
            try:
                intent_log_id_uuid = uuid.UUID(request.intent_log_id)
                intent_result = await db.execute(
                    select(IntentLog).where(IntentLog.id == intent_log_id_uuid)
                )
                intent_log = intent_result.scalar_one_or_none()
                if not intent_log:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Intent Log bulunamadı."
                    )
                # Use org_id from intent log if not provided
                if not org_id:
                    org_id = str(intent_log.organization_id)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Geçersiz intent_log_id formatı."
                )
        
        # Create Impact Event
        impact_event = ImpactEvent(
            id=uuid.uuid4(),
            intent_log_id=intent_log_id_uuid,
            impact_type=request.impact_type,
            risk_scores_locked=request.risk_scores,  # Locked at impact moment
            content_hash_locked=request.content_hash,  # Locked at impact moment
            source_system=request.source_system,
            immutable=True  # Impact events can NEVER be deleted or updated
        )
        
        db.add(impact_event)
        await db.commit()
        await db.refresh(impact_event)
        
        # Audit log
        if user_id and org_id:
            await log_analysis_audit(
                db=db,
                event_type="impact_event_created",
                user_id=str(user_id),
                org_id=str(org_id),
                record_id=str(impact_event.id),
                metadata={
                    "impact_type": request.impact_type,
                    "source_system": request.source_system,
                    "intent_log_id": request.intent_log_id
                }
            )
        
        logger.info(f"[Impact] Created: id={impact_event.id}, type={request.impact_type}, source={request.source_system}")
        
        return ImpactEventResponse(
            id=str(impact_event.id),
            intent_log_id=str(impact_event.intent_log_id) if impact_event.intent_log_id else None,
            impact_type=impact_event.impact_type,
            risk_scores_locked=impact_event.risk_scores_locked,
            content_hash_locked=impact_event.content_hash_locked,
            occurred_at=impact_event.occurred_at.isoformat(),
            source_system=impact_event.source_system,
            immutable=impact_event.immutable
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Impact] Create error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Impact Event oluşturulamadı: {str(e)}"
        )


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production),
    x_org_id: Optional[str] = Header(None, alias="x-org-id"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """
    Get history (Intent Logs and Impact Events)
    
    Role-based visibility:
    - Editor: Can see only their own Intent Logs (no Impact Events)
    - Legal/Management: Can see Intent Logs and Impact Events
    - Regulator: Can see Intent Logs (labeled) and Impact Events
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
        
        # Role-based access
        is_editor = user_role in ["proxy_user", "reviewer"]
        is_legal_management = user_role in ["admin", "org_admin", "ops", "auditor"]
        
        # Get Intent Logs
        intent_query = select(IntentLog).where(
            IntentLog.organization_id == org_uuid
        )
        
        # Editors can only see their own Intent Logs
        if is_editor:
            intent_query = intent_query.where(IntentLog.user_id == user_uuid)
        
        intent_query = intent_query.order_by(desc(IntentLog.created_at))
        
        # Get total count
        count_query = select(func.count(IntentLog.id)).where(
            IntentLog.organization_id == org_uuid
        )
        if is_editor:
            count_query = count_query.where(IntentLog.user_id == user_uuid)
        
        total_intents_result = await db.execute(count_query)
        total_intents = total_intents_result.scalar() or 0
        
        # Pagination
        offset = (page - 1) * page_size
        intent_query = intent_query.offset(offset).limit(page_size)
        
        intent_result = await db.execute(intent_query)
        intent_logs = intent_result.scalars().all()
        
        # Get Impact Events (only for legal/management roles)
        impact_events = []
        total_impacts = 0
        
        if is_legal_management:
            # Get Impact Events for this organization (via Intent Logs)
            impact_query = select(ImpactEvent).join(
                IntentLog, ImpactEvent.intent_log_id == IntentLog.id
            ).where(
                IntentLog.organization_id == org_uuid
            ).order_by(desc(ImpactEvent.occurred_at))
            
            impact_count_query = select(func.count(ImpactEvent.id)).join(
                IntentLog, ImpactEvent.intent_log_id == IntentLog.id
            ).where(
                IntentLog.organization_id == org_uuid
            )
            
            total_impacts_result = await db.execute(impact_count_query)
            total_impacts = total_impacts_result.scalar() or 0
            
            impact_query = impact_query.offset(offset).limit(page_size)
            impact_result = await db.execute(impact_query)
            impact_events = impact_result.scalars().all()
        
        # Audit log
        await log_analysis_audit(
            db=db,
            event_type="history_viewed",
            user_id=str(user_id),
            org_id=str(org_id),
            metadata={"page": page, "page_size": page_size}
        )
        
        return HistoryResponse(
            intent_logs=[
                IntentLogResponse(
                    id=str(il.id),
                    organization_id=str(il.organization_id),
                    user_id=str(il.user_id),
                    input_content_hash=il.input_content_hash,
                    sector=il.sector,
                    policy_set=il.policy_set,
                    risk_scores=il.risk_scores,
                    flags=il.flags,
                    trigger_action=il.trigger_action,
                    immutable=il.immutable,
                    created_at=il.created_at.isoformat(),
                    impact_events=[]  # Will be loaded separately if needed
                )
                for il in intent_logs
            ],
            impact_events=[
                ImpactEventResponse(
                    id=str(ie.id),
                    intent_log_id=str(ie.intent_log_id) if ie.intent_log_id else None,
                    impact_type=ie.impact_type,
                    risk_scores_locked=ie.risk_scores_locked,
                    content_hash_locked=ie.content_hash_locked,
                    occurred_at=ie.occurred_at.isoformat(),
                    source_system=ie.source_system,
                    immutable=ie.immutable
                )
                for ie in impact_events
            ],
            total_intents=total_intents,
            total_impacts=total_impacts,
            page=page,
            page_size=page_size
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[History] Error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Geçmiş alınamadı: {str(e)}"
        )


@router.get("/regulator/telemetry")
async def get_regulator_telemetry(
    db: AsyncSession = Depends(get_db),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    policy: Optional[str] = Query(None)
):
    """
    Regulator Telemetry - Anonymous analysis data
    NO content, NO identity, NO organization name
    
    Returns:
    - sector
    - policy
    - risk range
    - flag types
    - time (rounded)
    """
    try:
        # Build query for Intent Logs (aggregated, anonymous)
        base_query = select(IntentLog).where(IntentLog.organization_id.isnot(None))
        
        # Apply filters
        if sector:
            base_query = base_query.where(IntentLog.sector == sector)
        
        if from_date:
            base_query = base_query.where(IntentLog.created_at >= datetime.fromisoformat(from_date))
        
        if to_date:
            base_query = base_query.where(IntentLog.created_at <= datetime.fromisoformat(to_date))
        
        result = await db.execute(base_query)
        intent_logs = result.scalars().all()
        
        # Aggregate data (anonymous, no content)
        telemetry_data = []
        sector_policy_map: Dict[str, Dict[str, List[float]]] = {}
        
        for il in intent_logs:
            sec = il.sector or "unknown"
            policies = il.policy_set.get('policies', []) if il.policy_set else []
            ethical_score = il.risk_scores.get('ethical_index', 50) if il.risk_scores else 50
            
            if not policies:
                policies = ["unknown"]
            
            for pol in policies:
                if sec not in sector_policy_map:
                    sector_policy_map[sec] = {}
                if pol not in sector_policy_map[sec]:
                    sector_policy_map[sec][pol] = []
                sector_policy_map[sec][pol].append(float(ethical_score))
        
        # Format response
        for sec, policies in sector_policy_map.items():
            for pol, scores in policies.items():
                avg_ethical = sum(scores) / len(scores) if scores else 50
                telemetry_data.append({
                    "sector": sec,
                    "policy": pol,
                    "risk_range": _get_risk_range(avg_ethical),
                    "count": len(scores),
                    "avg_ethical_score": round(avg_ethical, 2)
                })
        
        return {
            "telemetry": telemetry_data,
            "total_records": len(telemetry_data)
        }
        
    except Exception as e:
        logger.error(f"[Regulator] Telemetry error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Telemetri alınamadı: {str(e)}"
        )


def _get_risk_range(score: float) -> str:
    """Convert score to risk range"""
    if score >= 80:
        return "low"
    elif score >= 50:
        return "medium"
    else:
        return "high"
