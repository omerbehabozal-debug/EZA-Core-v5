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
    input_content: Optional[str] = None  # Original content (for snapshot)
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
        valid_actions = ["save", "rewrite", "version", "approval_request", "analyze"]
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
        
        # Generate hash for original content
        input_content_hash = generate_content_hash(input_content)
        
        # Store original content for snapshot viewing
        stored_content = input_content
        
        # Extract rewritten content if available (for rewrite actions)
        rewritten_content = request.analysis_result.get('rewritten_content')
        
        # Extract scores and flags
        risk_scores = request.analysis_result.get('overall_scores', {})
        flags = {
            'flags': request.analysis_result.get('flags', []),
            'risk_locations': request.analysis_result.get('risk_locations', []),
            'risk_flags_severity': request.analysis_result.get('risk_flags_severity', []),
            'justification': request.analysis_result.get('justification', [])
        }
        
        # Store rewritten content in flags if available (for complete operation record)
        if rewritten_content:
            flags['_rewritten_content'] = rewritten_content
            flags['_rewrite_scores'] = request.analysis_result.get('rewrite_scores')
            flags['_rewrite_improvement'] = request.analysis_result.get('rewrite_improvement')
            logger.info(f"[Intent] Rewrite action detected - storing both original and rewritten content")
        
        # Create policy set snapshot
        policy_set = {
            'policies': request.policies or [],
            'sector': request.sector,
            'snapshot_time': datetime.utcnow().isoformat()
        }
        
        # Create Intent Log
        user_uuid = uuid.UUID(str(user_id))
        org_uuid = uuid.UUID(str(org_id))
        
        # Store content in flags as fallback if input_content column doesn't exist
        # This allows the system to work even if the column hasn't been added yet
        if not flags:
            flags = {}
        flags['_content_fallback'] = stored_content
        # Add analysis_mode to flags if present in analysis_result
        if 'analysis_mode' in request.analysis_result:
            flags['analysis_mode'] = request.analysis_result['analysis_mode']
        
        # Create Intent Log (input_content will be None if column doesn't exist)
        intent_log = IntentLog(
            id=uuid.uuid4(),
            organization_id=org_uuid,
            user_id=user_uuid,
            input_content_hash=input_content_hash,
            input_content=None,  # Will be set via direct SQL if column exists
            sector=request.sector,
            policy_set=policy_set,
            risk_scores=risk_scores,
            flags=flags,
            trigger_action=request.trigger_action,
            immutable=True  # Intent logs can NEVER be deleted or updated
        )
        
        db.add(intent_log)
        
        # Try to set input_content via direct SQL if column exists
        # This avoids SQLAlchemy trying to insert into non-existent column
        try:
            from sqlalchemy import text
            # Check if column exists and update if it does
            check_column = await db.execute(
                text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'production_intent_logs' 
                    AND column_name = 'input_content'
                """)
            )
            column_exists = check_column.scalar_one_or_none() is not None
            
            if column_exists:
                # Column exists, update it directly
                await db.execute(
                    text("""
                        UPDATE production_intent_logs 
                        SET input_content = :content 
                        WHERE id = :id
                    """),
                    {"content": stored_content, "id": str(intent_log.id)}
                )
                logger.info(f"[Intent] input_content set via direct SQL for {intent_log.id}")
            else:
                logger.warning("[Intent] input_content column not found in database. Content stored in flags._content_fallback")
        except Exception as e:
            logger.warning(f"[Intent] Could not set input_content: {e}. Content stored in flags._content_fallback")
        
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
        
        # Update telemetry state with risk flag distribution
        try:
            from backend.routers.proxy_websocket import update_telemetry_state
            
            # Extract risk flags and convert to distribution format
            risk_flag_distribution = {}
            if flags and isinstance(flags, dict):
                risk_flags_severity = flags.get('risk_flags_severity', [])
                if isinstance(risk_flags_severity, list):
                    for flag_item in risk_flags_severity:
                        flag_name = None
                        severity = 0.0
                        
                        if isinstance(flag_item, dict):
                            flag_name = flag_item.get('flag', '')
                            severity = flag_item.get('severity', 0.0)
                        elif hasattr(flag_item, 'flag') and hasattr(flag_item, 'severity'):
                            # Handle Pydantic model or object with attributes
                            flag_name = getattr(flag_item, 'flag', '')
                            severity = getattr(flag_item, 'severity', 0.0)
                        
                        if flag_name:
                            # Convert severity to float and ensure it's in valid range
                            try:
                                severity_float = float(severity)
                                if 0.0 <= severity_float <= 1.0:
                                    risk_flag_distribution[flag_name] = severity_float
                            except (ValueError, TypeError):
                                logger.warning(f"[Intent] Invalid severity value for flag {flag_name}: {severity}")
            
            # Get last policy triggered from policy_set
            last_policy = None
            if policy_set and isinstance(policy_set, dict):
                policies = policy_set.get('policies', [])
                if policies and len(policies) > 0:
                    first_policy = policies[0]
                    if isinstance(first_policy, str):
                        last_policy = first_policy
                    elif isinstance(first_policy, dict):
                        last_policy = first_policy.get('name', first_policy.get('policy', str(first_policy)))
                    else:
                        last_policy = str(first_policy)
            
            # Check fail-safe state based on ethical index
            fail_safe_state = False
            ethical_index = 50  # Default
            if isinstance(risk_scores, dict):
                ethical_index = risk_scores.get('ethical_index', 50)
            elif hasattr(risk_scores, 'ethical_index'):
                ethical_index = getattr(risk_scores, 'ethical_index', 50)
            
            if ethical_index < 50:
                fail_safe_state = True
            
            # Update telemetry state
            update_telemetry_state(
                risk_flag_distribution=risk_flag_distribution,
                last_policy_triggered=last_policy,
                fail_safe_state=fail_safe_state
            )
            
            logger.info(f"[Intent] Telemetry state updated: flags={len(risk_flag_distribution)}, fail_safe={fail_safe_state}, ethical_index={ethical_index}")
        except Exception as e:
            logger.warning(f"[Intent] Could not update telemetry state: {e}", exc_info=True)
        
        # Get content from input_content column or fallback to flags
        content = intent_log.input_content
        if not content and intent_log.flags and isinstance(intent_log.flags, dict):
            content = intent_log.flags.get('_content_fallback')
        
        return IntentLogResponse(
            id=str(intent_log.id),
            organization_id=str(intent_log.organization_id),
            user_id=str(intent_log.user_id),
            input_content_hash=intent_log.input_content_hash,
            input_content=content,  # Include original content (from column or fallback)
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
        # CRITICAL: Filter out soft-deleted records for user-facing queries
        # Admin/Regulator views should NOT apply this filter (but we don't have a separate endpoint for them yet)
        # For now, we apply the filter for all user-facing queries
        intent_query = select(IntentLog).where(
            and_(
                IntentLog.organization_id == org_uuid,
                IntentLog.deleted_by_user == False  # Soft delete filter - hide from user history
            )
        )
        
        # Editors can only see their own Intent Logs
        if is_editor:
            intent_query = intent_query.where(IntentLog.user_id == user_uuid)
        
        intent_query = intent_query.order_by(desc(IntentLog.created_at))
        
        # Get total count
        count_query = select(func.count(IntentLog.id)).where(
            and_(
                IntentLog.organization_id == org_uuid,
                IntentLog.deleted_by_user == False  # Soft delete filter
            )
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
            # CRITICAL: Filter out soft-deleted records for user-facing queries
            impact_query = select(ImpactEvent).join(
                IntentLog, ImpactEvent.intent_log_id == IntentLog.id
            ).where(
                and_(
                    IntentLog.organization_id == org_uuid,
                    ImpactEvent.deleted_by_user == False  # Soft delete filter
                )
            ).order_by(desc(ImpactEvent.occurred_at))
            
            impact_count_query = select(func.count(ImpactEvent.id)).join(
                IntentLog, ImpactEvent.intent_log_id == IntentLog.id
            ).where(
                and_(
                    IntentLog.organization_id == org_uuid,
                    ImpactEvent.deleted_by_user == False  # Soft delete filter
                )
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
                    input_content=il.input_content or (il.flags.get('_content_fallback') if isinstance(il.flags, dict) else None),  # Include original content (from column or fallback)
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
        # CRITICAL: Regulator views MUST NOT apply soft delete filter
        # Regulator needs to see ALL records for compliance monitoring
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


@router.get("/{analysis_id}/snapshot")
async def get_analysis_snapshot(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production),
    x_org_id: Optional[str] = Header(None, alias="x-org-id")
):
    """
    Get full read-only snapshot of an analysis (Intent Log or Impact Event)
    
    Returns complete immutable snapshot including:
    - Original content
    - Analysis configuration (sector, policies)
    - Scores (exact stored values, not recalculated)
    - System findings
    - User action taken
    
    This is an audit-grade snapshot for compliance and regulator purposes.
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
        
        org_uuid = uuid.UUID(str(org_id))
        analysis_uuid = None
        
        try:
            analysis_uuid = uuid.UUID(analysis_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Geçersiz analysis_id formatı."
            )
        
        # Try to find as Intent Log first
        intent_result = await db.execute(
            select(IntentLog).where(
                and_(
                    IntentLog.id == analysis_uuid,
                    IntentLog.organization_id == org_uuid
                )
            )
        )
        intent_log = intent_result.scalar_one_or_none()
        
        if intent_log:
            # Load related impact events
            impact_result = await db.execute(
                select(ImpactEvent).where(ImpactEvent.intent_log_id == intent_log.id)
            )
            impact_events = impact_result.scalars().all()
            
            # Get content from input_content column or fallback to flags
            content = intent_log.input_content
            if not content and intent_log.flags and isinstance(intent_log.flags, dict):
                content = intent_log.flags.get('_content_fallback', '')
            
            # Extract detailed analysis data from flags
            flags_data = intent_log.flags or {}
            paragraphs = flags_data.get('paragraphs', [])
            risk_locations = flags_data.get('risk_locations', [])
            justification = flags_data.get('justification', [])
            risk_flags_severity = flags_data.get('risk_flags_severity', [])
            flags_list = flags_data.get('flags', [])  # Extract flags list
            
            # Build snapshot response
            snapshot = {
                "analysis_id": str(intent_log.id),
                "analysis_type": "intent_log",
                "created_at": intent_log.created_at.isoformat(),
                "content": content or "",  # Original content (from column or fallback)
                "sector": intent_log.sector,
                "policies": intent_log.policy_set.get('policies', []) if intent_log.policy_set else [],
                "analysis_type_label": "Yayına Hazırlık Analizi",
                "scores": intent_log.risk_scores or {},
                "system_findings": _extract_system_findings(flags_data),
                "flags": flags_list if isinstance(flags_list, list) else [],  # Add flags list for RiskFlags component
                "paragraphs": paragraphs,  # Add paragraph analysis
                "risk_locations": risk_locations,  # Add risk locations
                "justification": justification,  # Add justification details
                "risk_flags_severity": risk_flags_severity,  # Add detailed risk flags
                "user_action": {
                    "action": intent_log.trigger_action,
                    "action_label": _get_trigger_action_label(intent_log.trigger_action),
                    "timestamp": intent_log.created_at.isoformat()
                },
                "immutable": intent_log.immutable,
                "impact_events": [
                    {
                        "id": str(ie.id),
                        "impact_type": ie.impact_type,
                        "occurred_at": ie.occurred_at.isoformat(),
                        "source_system": ie.source_system,
                        "risk_scores_locked": ie.risk_scores_locked
                    }
                    for ie in impact_events
                ]
            }
            
            # Audit log
            await log_analysis_audit(
                db=db,
                event_type="snapshot_viewed",
                user_id=str(user_id),
                org_id=str(org_id),
                record_id=str(intent_log.id),
                metadata={"analysis_type": "intent_log"}
            )
            
            return snapshot
        
        # Try to find as Impact Event
        impact_result = await db.execute(
            select(ImpactEvent).join(
                IntentLog, ImpactEvent.intent_log_id == IntentLog.id
            ).where(
                and_(
                    ImpactEvent.id == analysis_uuid,
                    IntentLog.organization_id == org_uuid
                )
            )
        )
        impact_event = impact_result.scalar_one_or_none()
        
        if impact_event:
            # Load related intent log
            intent_result = await db.execute(
                select(IntentLog).where(IntentLog.id == impact_event.intent_log_id)
            )
            related_intent = intent_result.scalar_one_or_none()
            
            # Get content from intent log (from column or fallback)
            content = ""
            if related_intent:
                content = related_intent.input_content
                if not content and related_intent.flags and isinstance(related_intent.flags, dict):
                    content = related_intent.flags.get('_content_fallback', '')
            
            # Extract detailed analysis data from related intent log flags
            flags_data = related_intent.flags if related_intent else {}
            paragraphs = flags_data.get('paragraphs', [])
            risk_locations = flags_data.get('risk_locations', [])
            justification = flags_data.get('justification', [])
            risk_flags_severity = flags_data.get('risk_flags_severity', [])
            flags_list = flags_data.get('flags', [])  # Extract flags list
            
            snapshot = {
                "analysis_id": str(impact_event.id),
                "analysis_type": "impact_event",
                "created_at": impact_event.occurred_at.isoformat(),
                "content": content,  # Content from intent log (from column or fallback)
                "sector": related_intent.sector if related_intent else None,
                "policies": related_intent.policy_set.get('policies', []) if related_intent and related_intent.policy_set else [],
                "analysis_type_label": "Gerçek Etki Kaydı",
                "scores": impact_event.risk_scores_locked,  # Locked scores
                "system_findings": _extract_system_findings(flags_data),
                "flags": flags_list if isinstance(flags_list, list) else [],  # Add flags list for RiskFlags component
                "paragraphs": paragraphs,  # Add paragraph analysis
                "risk_locations": risk_locations,  # Add risk locations
                "justification": justification,  # Add justification details
                "risk_flags_severity": risk_flags_severity,  # Add detailed risk flags
                "user_action": {
                    "action": "impact_occurred",
                    "action_label": "Gerçek Etki Tespit Edildi",
                    "timestamp": impact_event.occurred_at.isoformat()
                },
                "impact_details": {
                    "impact_type": impact_event.impact_type,
                    "impact_type_label": _get_impact_type_label(impact_event.impact_type),
                    "source_system": impact_event.source_system,
                    "content_hash_locked": impact_event.content_hash_locked
                },
                "immutable": impact_event.immutable,
                "intent_log_id": str(impact_event.intent_log_id) if impact_event.intent_log_id else None
            }
            
            # Audit log
            await log_analysis_audit(
                db=db,
                event_type="snapshot_viewed",
                user_id=str(user_id),
                org_id=str(org_id),
                record_id=str(impact_event.id),
                metadata={"analysis_type": "impact_event"}
            )
            
            return snapshot
        
        # Not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analiz kaydı bulunamadı."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Snapshot] Error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Snapshot alınamadı: {str(e)}"
        )


def _extract_system_findings(flags: Dict[str, Any]) -> List[str]:
    """Extract system findings from flags"""
    findings = []
    
    if flags.get('flags'):
        findings.extend([f"Flag: {flag}" for flag in flags['flags']])
    
    if flags.get('risk_flags_severity'):
        for flag_sev in flags['risk_flags_severity']:
            if isinstance(flag_sev, dict):
                flag_name = flag_sev.get('flag', 'Unknown')
                severity = flag_sev.get('severity', 0)
                findings.append(f"{flag_name} (Şiddet: {severity})")
    
    if flags.get('justification'):
        for just in flags['justification']:
            if isinstance(just, dict):
                violation = just.get('violation', 'Unknown')
                findings.append(f"İhlal: {violation}")
    
    return findings


def _get_trigger_action_label(action: str) -> str:
    """Get Turkish label for trigger action"""
    labels = {
        "save": "Yayına Hazırlık Analizi",
        "rewrite": "Yeniden Yazma",
        "version": "Versiyon Oluşturma",
        "approval_request": "Onaya Gönderme"
    }
    return labels.get(action, action)


def _get_impact_type_label(impact_type: str) -> str:
    """Get Turkish label for impact type"""
    labels = {
        "api_response": "API Yanıtı",
        "chatbot_display": "Chatbot Gösterimi",
        "cms_publish": "CMS Yayını",
        "campaign_send": "Kampanya Gönderimi",
        "notification": "Bildirim",
        "external_integration": "Harici Entegrasyon"
    }
    return labels.get(impact_type, impact_type)


@router.delete("/{analysis_id}")
async def soft_delete_analysis(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production),
    x_org_id: Optional[str] = Header(None, alias="x-org-id")
):
    """
    Soft delete an analysis record (Intent Log or Impact Event)
    
    CRITICAL: This does NOT delete the record, only hides it from user history.
    - Sets deleted_by_user = True
    - Sets deleted_at = current timestamp
    - Sets deleted_by_user_id = current user
    
    The record remains in:
    - Audit logs
    - Regulator views
    - Telemetry & aggregation
    - Impact Event pipelines
    
    Permission Rules:
    - Only analysis owner (user_id matches) OR organization admin can delete
    - Regulators CANNOT delete
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
        
        # Regulators cannot delete
        if user_role == "regulator":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Regulator kullanıcıları analiz kayıtlarını silemez."
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
        analysis_uuid = None
        
        try:
            analysis_uuid = uuid.UUID(analysis_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Geçersiz analysis_id formatı."
            )
        
        # Check if user is org_admin or ops (can delete any record in org)
        is_org_admin = user_role in ["admin", "org_admin", "ops"]
        
        # Try to find as Intent Log first
        intent_result = await db.execute(
            select(IntentLog).where(
                and_(
                    IntentLog.id == analysis_uuid,
                    IntentLog.organization_id == org_uuid
                )
            )
        )
        intent_log = intent_result.scalar_one_or_none()
        
        if intent_log:
            # Permission check: Only owner or org admin can delete
            if not is_org_admin and intent_log.user_id != user_uuid:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Bu analizi silme yetkiniz bulunmamaktadır. Sadece analiz sahibi veya organizasyon yöneticisi silebilir."
                )
            
            # Check if already deleted
            if intent_log.deleted_by_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Bu analiz zaten silinmiş."
                )
            
            # Soft delete: Set flags (DO NOT delete the record)
            intent_log.deleted_by_user = True
            intent_log.deleted_at = datetime.now()
            intent_log.deleted_by_user_id = user_uuid
            
            await db.commit()
            await db.refresh(intent_log)
            
            # Audit log
            await log_analysis_audit(
                db=db,
                event_type="intent_log_soft_deleted",
                user_id=str(user_id),
                org_id=str(org_id),
                record_id=str(intent_log.id),
                metadata={
                    "deleted_by": str(user_id),
                    "deleted_at": intent_log.deleted_at.isoformat(),
                    "note": "Soft delete - record remains in audit logs and regulator views"
                }
            )
            
            logger.info(f"[Intent] Soft deleted: id={intent_log.id}, deleted_by={user_id}, org_id={org_id}")
            
            return {
                "success": True,
                "message": "Analiz geçmişinizden kaldırıldı. Sistem kayıtları korunur.",
                "analysis_id": str(intent_log.id),
                "analysis_type": "intent_log"
            }
        
        # Try to find as Impact Event
        impact_result = await db.execute(
            select(ImpactEvent).join(
                IntentLog, ImpactEvent.intent_log_id == IntentLog.id
            ).where(
                and_(
                    ImpactEvent.id == analysis_uuid,
                    IntentLog.organization_id == org_uuid
                )
            )
        )
        impact_event = impact_result.scalar_one_or_none()
        
        if impact_event:
            # Permission check: Only org admin can delete Impact Events (they are system-generated)
            # Regular users cannot delete Impact Events
            if not is_org_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Impact Event kayıtlarını sadece organizasyon yöneticileri silebilir."
                )
            
            # Check if already deleted
            if impact_event.deleted_by_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Bu analiz zaten silinmiş."
                )
            
            # Soft delete: Set flags (DO NOT delete the record)
            impact_event.deleted_by_user = True
            impact_event.deleted_at = datetime.now()
            impact_event.deleted_by_user_id = user_uuid
            
            await db.commit()
            await db.refresh(impact_event)
            
            # Audit log
            await log_analysis_audit(
                db=db,
                event_type="impact_event_soft_deleted",
                user_id=str(user_id),
                org_id=str(org_id),
                record_id=str(impact_event.id),
                metadata={
                    "deleted_by": str(user_id),
                    "deleted_at": impact_event.deleted_at.isoformat(),
                    "note": "Soft delete - record remains in audit logs and regulator views"
                }
            )
            
            logger.info(f"[Impact] Soft deleted: id={impact_event.id}, deleted_by={user_id}, org_id={org_id}")
            
            return {
                "success": True,
                "message": "Analiz geçmişinizden kaldırıldı. Sistem kayıtları korunur.",
                "analysis_id": str(impact_event.id),
                "analysis_type": "impact_event"
            }
        
        # Not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analiz kaydı bulunamadı."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Soft Delete] Error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analiz silinemedi: {str(e)}"
        )
