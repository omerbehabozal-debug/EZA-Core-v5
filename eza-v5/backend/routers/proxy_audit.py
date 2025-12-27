# -*- coding: utf-8 -*-
"""
EZA Proxy - Audit & Reporting Endpoints
Audit trail, PDF reports, hash verification
"""

import hashlib
import json
import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.utils.dependencies import get_db
from backend.auth.proxy_auth_production import require_proxy_auth_production
from backend.security.rate_limit import rate_limit_proxy_corporate
from backend.models.production import IntentLog, ImpactEvent, TelemetryEvent, Organization
from sqlalchemy import select, or_, func, distinct
from sqlalchemy.orm import selectinload

router = APIRouter()
logger = logging.getLogger(__name__)

# Note: search_audit_logs function removed - now using database queries directly in search_audit endpoint


class RiskFlagSeverity(BaseModel):
    flag: str
    severity: float  # 0.0 - 1.0
    policy: str
    evidence: Optional[str] = None


class DecisionJustification(BaseModel):
    violation: str
    policy: str
    evidence: str
    severity: float
    policies: Optional[List[str]] = None  # Array of all policy references (if multiple, for collapsed violations)


class AuditResponse(BaseModel):
    uuid: str
    sha256: str
    timestamp: str
    policy_trace: List[Dict[str, Any]]
    risk_flags: List[RiskFlagSeverity]
    signature: str  # RSA-2048 signature placeholder
    justification: List[DecisionJustification]


def generate_sha256_hash(data: str) -> str:
    """Generate SHA-256 hash for audit trail"""
    return hashlib.sha256(data.encode()).hexdigest()


def generate_rsa_signature(data: str) -> str:
    """Generate RSA-2048 signature placeholder"""
    # In production, use actual RSA signing
    hash_obj = hashlib.sha256(data.encode())
    return f"RSA2048:{hash_obj.hexdigest()[:32]}"


# Note: create_audit_entry function removed - audit entries are now stored in database (IntentLog/ImpactEvent)
# This function is kept for backward compatibility but should not be used
# Use IntentLog/ImpactEvent models directly for new audit entries
def create_audit_entry(
    analysis_id: str,
    content: str,
    scores: Dict[str, int],
    risk_flags: List[RiskFlagSeverity],
    policy_trace: List[Dict[str, Any]],
    justification: List[DecisionJustification],
    org_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    DEPRECATED: This function is kept for backward compatibility only.
    Audit entries are now stored in database (IntentLog/ImpactEvent models).
    Do not use this function for new code.
    """
    logger.warning("[Audit] create_audit_entry is deprecated. Use IntentLog/ImpactEvent models directly.")
    
    audit_data = {
        "analysis_id": analysis_id,
        "org_id": org_id,
        "content_hash": generate_sha256_hash(content),
        "scores": scores,
        "risk_flags": [flag.dict() for flag in risk_flags],
        "policy_trace": policy_trace,
        "justification": [j.dict() for j in justification],
        "timestamp": datetime.utcnow().isoformat(),
        "metadata": metadata or {}
    }
    
    audit_json = json.dumps(audit_data, sort_keys=True)
    sha256 = generate_sha256_hash(audit_json)
    signature = generate_rsa_signature(audit_json)
    
    entry = {
        "uuid": analysis_id,
        "sha256": sha256,
        "timestamp": audit_data["timestamp"],
        "policy_trace": policy_trace,
        "risk_flags": [flag.dict() for flag in risk_flags],
        "signature": signature,
        "justification": [j.dict() for j in justification],
        "raw_data": audit_data
    }
    
    # Note: audit_store removed - audit entries are now stored in database (IntentLog/ImpactEvent)
    # This function returns entry for backward compatibility only
    return entry


@router.get("/audit/search")
async def search_audit(
    org_id: Optional[str] = Query(None, description="Organization ID"),
    from_date: Optional[str] = Query(None, description="From date (ISO format)"),
    to_date: Optional[str] = Query(None, description="To date (ISO format)"),
    risk_level: Optional[str] = Query(None, description="Risk level: low, medium, high"),
    flag: Optional[str] = Query(None, description="Risk flag type"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Search audit logs with filters
    Searches IntentLog and ImpactEvent records
    """
    # Regulators can access all audit logs (no org_id required)
    is_regulator = current_user.get("is_regulator", False)
    
    if not is_regulator:
        # Non-regulator users require organization context
        user_org_id = current_user.get("org_id")
        if not user_org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Organization context required"
            )
        # Use provided org_id or default to user's org
        search_org_id = org_id or user_org_id
    else:
        # Regulators can search by org_id if provided, otherwise return all
        search_org_id = org_id
    
    # Build query for IntentLog
    intent_query = select(IntentLog)
    
    # Apply organization filter only if org_id is provided or user is not regulator
    if not is_regulator:
        # Non-regulator: must filter by org_id
        try:
            org_uuid = uuid.UUID(search_org_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid organization_id format"
            )
        intent_query = intent_query.where(IntentLog.organization_id == org_uuid)
    elif search_org_id:
        # Regulator with org_id filter: filter by specific org
        try:
            org_uuid = uuid.UUID(search_org_id)
            intent_query = intent_query.where(IntentLog.organization_id == org_uuid)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid organization_id format"
            )
    # Regulator without org_id: return all audit logs (no filter)
    
    # Apply date filters
    if from_date:
        try:
            from_dt = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
            intent_query = intent_query.where(IntentLog.created_at >= from_dt)
        except ValueError:
            pass
    
    if to_date:
        try:
            to_dt = datetime.fromisoformat(to_date.replace('Z', '+00:00'))
            intent_query = intent_query.where(IntentLog.created_at <= to_dt)
        except ValueError:
            pass
    
    # Execute query
    intent_result = await db.execute(intent_query)
    intent_logs = intent_result.scalars().all()
    
    # Filter by risk level and flags (in-memory filtering)
    results = []
    for intent in intent_logs:
        scores = intent.risk_scores or {}
        ethical_score = scores.get("ethical_index", 50)
        
        # Risk level filter
        if risk_level:
            if risk_level == "high" and ethical_score >= 50:
                continue
            if risk_level == "medium" and (ethical_score < 50 or ethical_score >= 80):
                continue
            if risk_level == "low" and ethical_score < 80:
                continue
        
        # Flag filter
        if flag:
            flags_data = intent.flags or {}
            flags_list = flags_data.get("flags", []) if isinstance(flags_data, dict) else []
            if not any(f.get("flag") == flag or f.get("type") == flag for f in flags_list):
                continue
        
        results.append({
            "id": str(intent.id),
            "type": "IntentLog",
            "created_at": intent.created_at.isoformat() if intent.created_at else "",
            "sector": intent.sector,
            "risk_scores": scores,
            "organization_id": str(intent.organization_id)
        })
    
    # Sort by timestamp descending
    results.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    return {
        "ok": True,
        "count": len(results),
        "results": results
    }


@router.get("/audit", response_model=AuditResponse)
async def get_audit(
    analysis_id: str = Query(..., description="Analysis UUID (IntentLog or ImpactEvent ID)"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production),
    _: None = Depends(rate_limit_proxy_corporate)
):
    """
    Get audit trail for a specific analysis
    Returns UUID, SHA-256 hash, timestamp, policy trace, risk flags, and signature
    """
    org_id = current_user.get("org_id")
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization context required"
        )
    
    try:
        analysis_uuid = uuid.UUID(analysis_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid analysis_id format"
        )
    
    # Try to find in IntentLog first
    intent_log_result = await db.execute(
        select(IntentLog)
        .where(IntentLog.id == analysis_uuid)
        .where(IntentLog.organization_id == uuid.UUID(org_id))
    )
    intent_log = intent_log_result.scalar_one_or_none()
    
    if intent_log:
        # Build audit response from IntentLog
        scores = intent_log.risk_scores or {}
        flags = intent_log.flags or {}
        flags_list = flags.get("flags", []) if isinstance(flags, dict) else []
        
        # Convert to AuditResponse format
        audit_data = {
            "analysis_id": str(intent_log.id),
            "org_id": str(intent_log.organization_id),
            "content_hash": intent_log.input_content_hash,
            "scores": scores,
            "risk_flags": flags_list,
            "policy_trace": intent_log.policy_set or [],
            "justification": flags.get("justification", []) if isinstance(flags, dict) else [],
            "timestamp": intent_log.created_at.isoformat() if intent_log.created_at else "",
            "metadata": {}
        }
        
        audit_json = json.dumps(audit_data, sort_keys=True)
        sha256 = generate_sha256_hash(audit_json)
        signature = generate_rsa_signature(audit_json)
        
        entry = {
            "uuid": str(intent_log.id),
            "sha256": sha256,
            "timestamp": audit_data["timestamp"],
            "policy_trace": audit_data["policy_trace"],
            "risk_flags": [{"flag": f.get("flag", ""), "severity": f.get("severity", 0.0), "policy": f.get("policy", ""), "evidence": f.get("evidence")} for f in flags_list],
            "signature": signature,
            "justification": [{"violation": j.get("violation", ""), "policy": j.get("policy", ""), "evidence": j.get("evidence", ""), "severity": j.get("severity", 0.0), "policies": j.get("policies", [])} for j in audit_data["justification"]]
        }
        
        return AuditResponse(**entry)
    else:
        # Try ImpactEvent
        impact_event_result = await db.execute(
            select(ImpactEvent)
            .join(IntentLog, ImpactEvent.intent_log_id == IntentLog.id)
            .where(ImpactEvent.id == analysis_uuid)
            .where(IntentLog.organization_id == uuid.UUID(org_id))
        )
        impact_event = impact_event_result.scalar_one_or_none()
        
        if not impact_event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Audit entry not found for analysis_id: {analysis_id}"
            )
        
        # Build audit response from ImpactEvent
        scores = impact_event.risk_scores_locked or {}
        
        audit_data = {
            "analysis_id": str(impact_event.id),
            "org_id": str(org_id),
            "content_hash": impact_event.content_hash_locked,
            "scores": scores,
            "risk_flags": [],
            "policy_trace": [],
            "justification": [],
            "timestamp": impact_event.occurred_at.isoformat() if impact_event.occurred_at else "",
            "metadata": {
                "impact_type": impact_event.impact_type,
                "source_system": impact_event.source_system
            }
        }
        
        audit_json = json.dumps(audit_data, sort_keys=True)
        sha256 = generate_sha256_hash(audit_json)
        signature = generate_rsa_signature(audit_json)
        
        entry = {
            "uuid": str(impact_event.id),
            "sha256": sha256,
            "timestamp": audit_data["timestamp"],
            "policy_trace": [],
            "risk_flags": [],
            "signature": signature,
            "justification": []
        }
        
        return AuditResponse(**entry)


@router.get("/audit/verify")
async def verify_audit_hash(
    analysis_id: str = Query(..., description="Analysis UUID (IntentLog or ImpactEvent ID)"),
    provided_hash: str = Query(..., description="SHA-256 hash to verify"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Verify audit entry hash
    Checks IntentLog or ImpactEvent hash against provided hash
    Returns verification status
    """
    org_id = current_user.get("org_id")
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization context required"
        )
    
    try:
        analysis_uuid = uuid.UUID(analysis_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid analysis_id format"
        )
    
    # Try to find in IntentLog first
    intent_log_result = await db.execute(
        select(IntentLog)
        .where(IntentLog.id == analysis_uuid)
        .where(IntentLog.organization_id == uuid.UUID(org_id))
    )
    intent_log = intent_log_result.scalar_one_or_none()
    
    stored_hash = None
    record_type = None
    
    if intent_log:
        stored_hash = intent_log.input_content_hash
        record_type = "IntentLog"
    else:
        # Try ImpactEvent
        impact_event_result = await db.execute(
            select(ImpactEvent)
            .join(IntentLog, ImpactEvent.intent_log_id == IntentLog.id)
            .where(ImpactEvent.id == analysis_uuid)
            .where(IntentLog.organization_id == uuid.UUID(org_id))
        )
        impact_event = impact_event_result.scalar_one_or_none()
        
        if impact_event:
            stored_hash = impact_event.content_hash_locked
            record_type = "ImpactEvent"
    
    if not stored_hash:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analiz kaydı bulunamadı veya erişim yetkiniz yok"
        )
    
    is_valid = stored_hash.lower() == provided_hash.lower()
    
    return {
        "ok": True,
        "analysis_id": analysis_id,
        "stored_hash": stored_hash,
        "provided_hash": provided_hash,
        "verified": is_valid,
        "status": "Onaylandı" if is_valid else "Uyuşmazlık",
        "record_type": record_type
    }


@router.get("/report/pdf")
async def generate_pdf_report(
    analysis_id: str = Query(..., description="Analysis UUID (IntentLog or ImpactEvent ID)"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Generate PDF report for audit entry
    Returns text report (in production, generate actual PDF)
    """
    org_id = current_user.get("org_id")
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization context required"
        )
    
    try:
        analysis_uuid = uuid.UUID(analysis_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid analysis_id format"
        )
    
    # Try to find in IntentLog first
    intent_log_result = await db.execute(
        select(IntentLog)
        .where(IntentLog.id == analysis_uuid)
        .where(IntentLog.organization_id == uuid.UUID(org_id))
    )
    intent_log = intent_log_result.scalar_one_or_none()
    
    if intent_log:
        # Generate report from IntentLog
        scores = intent_log.risk_scores or {}
        flags = intent_log.flags or {}
        policies = intent_log.policy_set or []
        
        report_content = f"""EZA Proxy - Denetim Raporu

Kayıt ID: {intent_log.id}
Organizasyon ID: {intent_log.organization_id}
Kullanıcı ID: {intent_log.user_id}
Tarih: {intent_log.created_at.isoformat() if intent_log.created_at else 'N/A'}

İçerik Hash (SHA-256): {intent_log.input_content_hash}
Sektör: {intent_log.sector or 'N/A'}
Politikalar: {', '.join(policies) if policies else 'N/A'}
Tetikleme Aksiyonu: {intent_log.trigger_action}

Risk Skorları:
- Etik İndeks: {scores.get('ethical_index', 'N/A')}
- Uyum Skoru: {scores.get('compliance_score', 'N/A')}
- Manipülasyon Skoru: {scores.get('manipulation_score', 'N/A')}
- Önyargı Skoru: {scores.get('bias_score', 'N/A')}
- Hukuki Risk Skoru: {scores.get('legal_risk_score', 'N/A')}

Risk Bayrakları:
{json.dumps(flags, indent=2, ensure_ascii=False) if flags else 'Yok'}

Bu rapor, EZA Proxy sisteminin analiz kaydını içermektedir.
Kayıt değiştirilemez (immutable).
"""
    else:
        # Try ImpactEvent
        impact_event_result = await db.execute(
            select(ImpactEvent)
            .join(IntentLog, ImpactEvent.intent_log_id == IntentLog.id)
            .where(ImpactEvent.id == analysis_uuid)
            .where(IntentLog.organization_id == uuid.UUID(org_id))
        )
        impact_event = impact_event_result.scalar_one_or_none()
        
        if not impact_event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Analiz kaydı bulunamadı veya erişim yetkiniz yok"
            )
        
        # Generate report from ImpactEvent
        scores = impact_event.risk_scores_locked or {}
        
        report_content = f"""EZA Proxy - Impact Event Raporu

Kayıt ID: {impact_event.id}
Intent Log ID: {impact_event.intent_log_id or 'N/A'}
Tarih: {impact_event.occurred_at.isoformat() if impact_event.occurred_at else 'N/A'}

İçerik Hash (SHA-256): {impact_event.content_hash_locked}
Impact Tipi: {impact_event.impact_type}
Kaynak Sistem: {impact_event.source_system}

Kilitli Risk Skorları (Impact Anındaki Değerler):
{json.dumps(scores, indent=2, ensure_ascii=False)}

Bu rapor, gerçek etki anındaki kilitli skorları içermektedir.
Kayıt değiştirilemez (immutable).
"""
    
    # Return as text/plain for now (in production, generate actual PDF)
    return Response(
        content=report_content,
        media_type="text/plain",
        headers={
            "Content-Disposition": f"attachment; filename=audit_report_{analysis_id}.txt"
        }
    )


@router.post("/regulator/send")
async def send_to_regulator(
    analysis_id: str = Query(..., description="Analysis UUID (IntentLog or ImpactEvent ID)"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Send anonymized audit data to regulator channel
    Only sends scores, flags, and hash - NO content or user/org identifiers
    """
    org_id = current_user.get("org_id")
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization context required"
        )
    
    # Check user role - only regulator, admin, or auditor can send
    user_role = current_user.get("role", "")
    if user_role not in ["regulator", "admin", "auditor"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sadece regülatör, admin veya denetçi rolüne sahip kullanıcılar regülatöre veri gönderebilir"
        )
    
    try:
        analysis_uuid = uuid.UUID(analysis_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid analysis_id format"
        )
    
    # Try to find in IntentLog first
    intent_log_result = await db.execute(
        select(IntentLog)
        .where(IntentLog.id == analysis_uuid)
        .where(IntentLog.organization_id == uuid.UUID(org_id))
    )
    intent_log = intent_log_result.scalar_one_or_none()
    
    if intent_log:
        # Anonymize IntentLog data (remove content, keep only scores and flags)
        scores = intent_log.risk_scores or {}
        flags = intent_log.flags or {}
        
        anonymized = {
            "timestamp": intent_log.created_at.isoformat() if intent_log.created_at else "",
            "sector": intent_log.sector,  # Sector is OK for regulator
            "policies": intent_log.policy_set or [],
            "risk_scores": {
                "ethical_index": scores.get("ethical_index"),
                "compliance_score": scores.get("compliance_score"),
                "manipulation_score": scores.get("manipulation_score"),
                "bias_score": scores.get("bias_score"),
                "legal_risk_score": scores.get("legal_risk_score"),
            },
            "risk_flags": flags.get("flags", []) if isinstance(flags, dict) else [],
            "hash": intent_log.input_content_hash,
            "record_type": "IntentLog"
        }
    else:
        # Try ImpactEvent
        impact_event_result = await db.execute(
            select(ImpactEvent)
            .join(IntentLog, ImpactEvent.intent_log_id == IntentLog.id)
            .where(ImpactEvent.id == analysis_uuid)
            .where(IntentLog.organization_id == uuid.UUID(org_id))
        )
        impact_event = impact_event_result.scalar_one_or_none()
        
        if not impact_event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Analiz kaydı bulunamadı veya erişim yetkiniz yok"
            )
        
        # Anonymize ImpactEvent data
        scores = impact_event.risk_scores_locked or {}
        
        anonymized = {
            "timestamp": impact_event.occurred_at.isoformat() if impact_event.occurred_at else "",
            "impact_type": impact_event.impact_type,
            "source_system": impact_event.source_system,
            "risk_scores_locked": scores,
            "hash": impact_event.content_hash_locked,
            "record_type": "ImpactEvent"
        }
    
    # Broadcast to regulator WebSocket channel
    from backend.routers.telemetry_websocket import regulator_manager
    import asyncio
    await regulator_manager.broadcast("regulator", {
        "type": "regulator_report",
        "timestamp": datetime.utcnow().isoformat(),
        "data": anonymized
    })
    
    return {
        "ok": True,
        "message": "Regülatöre gönderildi",
        "analysis_id": analysis_id
    }


@router.get("/audit/coverage-summary")
async def get_coverage_summary(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Coverage & Data Sources Summary for Regulator Panel
    
    Returns aggregated, non-identifying coverage statistics.
    NO organization names, vendor names, model names, or identifiable information.
    """
    # Check if user is regulator (same pattern as search_audit)
    is_regulator = current_user.get("is_regulator", False)
    
    if not is_regulator:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Regulator access required"
        )
    
    try:
        # Helper function to map source_system to generic AI system type
        def map_to_ai_system_type(source_system: str) -> str:
            """Map source system to generic AI system type category"""
            source_lower = source_system.lower() if source_system else ""
            if "text" in source_lower or "generation" in source_lower or "llm" in source_lower:
                return "Text Generation Systems"
            elif "chat" in source_lower or "conversation" in source_lower or "assistant" in source_lower:
                return "Conversational AI"
            elif "image" in source_lower or "vision" in source_lower or "visual" in source_lower:
                return "Image Generation Systems"
            elif "audio" in source_lower or "speech" in source_lower or "voice" in source_lower:
                return "Audio / Speech Systems"
            elif "decision" in source_lower or "support" in source_lower or "recommendation" in source_lower:
                return "Decision-Support AI"
            elif "multi" in source_lower or "hybrid" in source_lower or "modal" in source_lower:
                return "Hybrid / Multi-Modal Systems"
            else:
                return "Text Generation Systems"  # Default fallback
        
        # Helper function to map source to data origin type
        def map_to_data_origin(source: str) -> str:
            """Map source to generic data origin type"""
            source_lower = source.lower() if source else ""
            if "api" in source_lower:
                return "API-based Integrations"
            elif "enterprise" in source_lower or "corporate" in source_lower:
                return "Enterprise System Connections"
            elif "ui" in source_lower or "interface" in source_lower or "user" in source_lower:
                return "End-User Interfaces"
            elif "pipeline" in source_lower or "evaluation" in source_lower or "internal" in source_lower:
                return "Internal Evaluation Pipelines"
            else:
                return "API-based Integrations"  # Default fallback
        
        # Count distinct organizations (from IntentLog - most comprehensive)
        org_count_query = select(func.count(distinct(IntentLog.organization_id)))
        org_count_result = await db.execute(org_count_query)
        organizations_count = org_count_result.scalar() or 0
        
        # Count distinct source systems from both ImpactEvent and TelemetryEvent
        # ImpactEvent: Real impact events (when content reaches users)
        # TelemetryEvent: All analysis events (broader coverage)
        impact_sources_query = select(distinct(ImpactEvent.source_system))
        impact_sources_result = await db.execute(impact_sources_query)
        impact_sources = [row[0] for row in impact_sources_result.fetchall() if row[0]]
        
        telemetry_sources_query = select(distinct(TelemetryEvent.source))
        telemetry_sources_result = await db.execute(telemetry_sources_query)
        telemetry_sources = [row[0] for row in telemetry_sources_result.fetchall() if row[0]]
        
        # Combine and deduplicate (use both ImpactEvent source_system and TelemetryEvent source)
        all_unique_sources = set(impact_sources + telemetry_sources)
        independent_sources = len(all_unique_sources)
        
        # Map all unique sources to AI system types
        ai_system_types_map: Dict[str, int] = {}
        
        # Map all unique sources (both ImpactEvent and TelemetryEvent) to AI types
        for source in all_unique_sources:
            ai_type = map_to_ai_system_type(source)
            ai_system_types_map[ai_type] = ai_system_types_map.get(ai_type, 0) + 1
        
        # If no data exists yet, assume at least Text Generation Systems (proxy does text generation)
        if len(ai_system_types_map) == 0:
            # Check if there's any data at all (IntentLog or TelemetryEvent)
            intent_count_query = select(func.count(IntentLog.id))
            intent_count_result = await db.execute(intent_count_query)
            intent_count = intent_count_result.scalar() or 0
            
            telemetry_count_query = select(func.count(TelemetryEvent.id))
            telemetry_count_result = await db.execute(telemetry_count_query)
            telemetry_count = telemetry_count_result.scalar() or 0
            
            # If there's any analysis data, assume Text Generation Systems
            if intent_count > 0 or telemetry_count > 0:
                ai_system_types_map["Text Generation Systems"] = 1
        
        # Count distinct AI system types
        ai_system_types_count = len(ai_system_types_map)
        
        # Get data origin types from TelemetryEvent
        all_sources_query = select(distinct(TelemetryEvent.source))
        sources_result = await db.execute(all_sources_query)
        sources = [row[0] for row in sources_result.fetchall() if row[0]]
        
        data_origins_map: Dict[str, int] = {}
        for source in sources:
            origin_type = map_to_data_origin(source)
            # Count occurrences (approximate from distinct sources)
            data_origins_map[origin_type] = data_origins_map.get(origin_type, 0) + 1
        
        # Get more accurate data origin counts from TelemetryEvent
        if sources:
            for source in sources:
                origin_type = map_to_data_origin(source)
                count_query = select(func.count(TelemetryEvent.id)).where(TelemetryEvent.source == source)
                count_result = await db.execute(count_query)
                count = count_result.scalar() or 0
                data_origins_map[origin_type] = data_origins_map.get(origin_type, 0) + count
        
        return {
            "ok": True,
            "independent_sources": independent_sources,
            "organizations": organizations_count,
            "ai_system_types": ai_system_types_count,
            "ai_modalities": ai_system_types_map,
            "data_origins": data_origins_map
        }
    
    except Exception as e:
        logger.error(f"[Coverage] Error generating coverage summary: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Coverage summary could not be generated"
        )


@router.get("/audit/global/country-risk-summary")
async def get_country_risk_summary(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Global Country-Level Risk Distribution
    
    Returns aggregated risk metrics by country (derived from policy sets).
    NO country names exposed - uses policy-based inference only.
    """
    is_regulator = current_user.get("is_regulator", False)
    if not is_regulator:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Regulator access required"
        )
    
    try:
        # Helper: Map policy set to country (policy-based inference only)
        def infer_country_from_policy(policy_set: Any) -> Optional[str]:
            """Infer country from policy set - NO explicit country data"""
            if not policy_set:
                return None
            
            # Extract policy names from JSON
            policies = []
            if isinstance(policy_set, dict):
                policies = policy_set.get('policies', []) or []
            elif isinstance(policy_set, list):
                policies = policy_set
            
            if not policies:
                return None
            
            # Policy-based country inference (TRT, FINTECH, HEALTH -> Turkey)
            policy_str = ' '.join(str(p).upper() for p in policies)
            if 'TRT' in policy_str or 'FINTECH' in policy_str or 'HEALTH' in policy_str:
                return "TR"  # Turkey (ISO code)
            # Add more policy-to-country mappings as needed
            # For now, only TR policies are identifiable
            
            return None
        
        # Get all IntentLogs with policy sets
        intent_logs_query = select(IntentLog).where(IntentLog.policy_set.isnot(None))
        intent_logs_result = await db.execute(intent_logs_query)
        intent_logs = intent_logs_result.scalars().all()
        
        # Aggregate by inferred country
        country_data: Dict[str, Dict[str, Any]] = {}
        
        for log in intent_logs:
            country = infer_country_from_policy(log.policy_set)
            if not country:
                continue  # Skip if country cannot be inferred
            
            if country not in country_data:
                country_data[country] = {
                    "total_analyses": 0,
                    "ethical_scores": [],
                    "risk_distribution": {"low": 0, "medium": 0, "high": 0}
                }
            
            country_data[country]["total_analyses"] += 1
            
            ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
            country_data[country]["ethical_scores"].append(ethical_score)
            
            # Risk distribution
            if ethical_score < 50:
                country_data[country]["risk_distribution"]["high"] += 1
            elif ethical_score < 80:
                country_data[country]["risk_distribution"]["medium"] += 1
            else:
                country_data[country]["risk_distribution"]["low"] += 1
        
        # Calculate averages and normalize
        country_summary = []
        for country_code, data in country_data.items():
            avg_ethical = sum(data["ethical_scores"]) / len(data["ethical_scores"]) if data["ethical_scores"] else 0
            
            # Normalize analysis volume (relative to max)
            max_analyses = max((d["total_analyses"] for d in country_data.values()), default=1)
            normalized_volume = (data["total_analyses"] / max_analyses) * 100 if max_analyses > 0 else 0
            
            country_summary.append({
                "country_code": country_code,  # ISO code only, NO country name
                "average_ethical_index": round(avg_ethical, 1),
                "risk_distribution": data["risk_distribution"],
                "normalized_analysis_volume": round(normalized_volume, 1),
                "total_analyses": data["total_analyses"]
            })
        
        # Sort by total analyses (descending)
        country_summary.sort(key=lambda x: x["total_analyses"], reverse=True)
        
        return {
            "ok": True,
            "countries": country_summary
        }
    
    except Exception as e:
        logger.error(f"[Global] Error generating country risk summary: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Country risk summary could not be generated"
        )


@router.get("/audit/global/country-risk-trends")
async def get_country_risk_trends(
    days: int = Query(30, ge=7, le=365, description="Number of days for trend analysis"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Country Risk Trends Over Time
    
    Returns time-series risk data by country.
    """
    is_regulator = current_user.get("is_regulator", False)
    if not is_regulator:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Regulator access required"
        )
    
    try:
        # Helper: Same country inference as above
        def infer_country_from_policy(policy_set: Any) -> Optional[str]:
            if not policy_set:
                return None
            policies = []
            if isinstance(policy_set, dict):
                policies = policy_set.get('policies', []) or []
            elif isinstance(policy_set, list):
                policies = policy_set
            if not policies:
                return None
            policy_str = ' '.join(str(p).upper() for p in policies)
            if 'TRT' in policy_str or 'FINTECH' in policy_str or 'HEALTH' in policy_str:
                return "TR"
            return None
        
        # Get IntentLogs within date range
        from_date = datetime.utcnow() - timedelta(days=days)
        intent_logs_query = select(IntentLog).where(
            IntentLog.policy_set.isnot(None),
            IntentLog.created_at >= from_date
        )
        intent_logs_result = await db.execute(intent_logs_query)
        intent_logs = intent_logs_result.scalars().all()
        
        # Group by country and time period (daily)
        trends: Dict[str, Dict[str, List[float]]] = {}  # country -> date -> [scores]
        
        for log in intent_logs:
            country = infer_country_from_policy(log.policy_set)
            if not country:
                continue
            
            # Get date (YYYY-MM-DD)
            log_date = log.created_at.date().isoformat() if log.created_at else None
            if not log_date:
                continue
            
            if country not in trends:
                trends[country] = {}
            if log_date not in trends[country]:
                trends[country][log_date] = []
            
            ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
            trends[country][log_date].append(ethical_score)
        
        # Calculate daily averages
        country_trends = []
        for country_code, date_scores in trends.items():
            daily_averages = []
            for date, scores in sorted(date_scores.items()):
                avg_score = sum(scores) / len(scores) if scores else 0
                daily_averages.append({
                    "date": date,
                    "average_ethical_index": round(avg_score, 1),
                    "sample_count": len(scores)
                })
            
            country_trends.append({
                "country_code": country_code,
                "daily_averages": daily_averages
            })
        
        # Calculate global average
        all_scores = []
        for log in intent_logs:
            ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
            all_scores.append(ethical_score)
        
        global_avg = sum(all_scores) / len(all_scores) if all_scores else 0
        
        return {
            "ok": True,
            "countries": country_trends,
            "global_average": round(global_avg, 1),
            "period_days": days
        }
    
    except Exception as e:
        logger.error(f"[Global] Error generating country risk trends: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Country risk trends could not be generated"
        )


@router.get("/audit/global/country-patterns")
async def get_country_patterns(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Dominant Risk Patterns by Country
    
    Returns aggregated risk pattern analysis by country.
    """
    is_regulator = current_user.get("is_regulator", False)
    if not is_regulator:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Regulator access required"
        )
    
    try:
        # Helper: Same country inference
        def infer_country_from_policy(policy_set: Any) -> Optional[str]:
            if not policy_set:
                return None
            policies = []
            if isinstance(policy_set, dict):
                policies = policy_set.get('policies', []) or []
            elif isinstance(policy_set, list):
                policies = policy_set
            if not policies:
                return None
            policy_str = ' '.join(str(p).upper() for p in policies)
            if 'TRT' in policy_str or 'FINTECH' in policy_str or 'HEALTH' in policy_str:
                return "TR"
            return None
        
        # Helper: Extract dominant risk pattern from flags
        def get_dominant_risk_pattern(flags: Any) -> str:
            """Extract dominant risk pattern category from flags"""
            if not flags:
                return "Unknown"
            
            flag_list = []
            if isinstance(flags, dict):
                flag_list = flags.get('flags', []) or flags.get('risk_flags_severity', []) or []
            elif isinstance(flags, list):
                flag_list = flags
            
            if not flag_list:
                return "Unknown"
            
            # Count risk pattern categories
            pattern_counts: Dict[str, int] = {}
            for flag in flag_list:
                flag_name = ""
                if isinstance(flag, dict):
                    flag_name = flag.get('flag', '') or flag.get('type', '')
                elif isinstance(flag, str):
                    flag_name = flag
                
                flag_lower = flag_name.lower()
                # Categorize flags
                if 'manipulation' in flag_lower or 'deception' in flag_lower:
                    pattern_counts['Manipulation'] = pattern_counts.get('Manipulation', 0) + 1
                elif 'legal' in flag_lower or 'compliance' in flag_lower:
                    pattern_counts['Legal Risk'] = pattern_counts.get('Legal Risk', 0) + 1
                elif 'bias' in flag_lower or 'discrimination' in flag_lower:
                    pattern_counts['Bias'] = pattern_counts.get('Bias', 0) + 1
                elif 'harm' in flag_lower or 'violence' in flag_lower:
                    pattern_counts['Harm'] = pattern_counts.get('Harm', 0) + 1
                else:
                    pattern_counts['Other'] = pattern_counts.get('Other', 0) + 1
            
            if not pattern_counts:
                return "Unknown"
            
            return max(pattern_counts.items(), key=lambda x: x[1])[0]
        
        # Get IntentLogs with flags
        intent_logs_query = select(IntentLog).where(IntentLog.flags.isnot(None))
        intent_logs_result = await db.execute(intent_logs_query)
        intent_logs = intent_logs_result.scalars().all()
        
        # Aggregate by country
        country_patterns: Dict[str, Dict[str, Any]] = {}
        
        for log in intent_logs:
            country = infer_country_from_policy(log.policy_set)
            if not country:
                continue
            
            if country not in country_patterns:
                country_patterns[country] = {
                    "dominant_pattern": "",
                    "pattern_counts": {},
                    "trend_scores": []  # For trend direction
                }
            
            # Get dominant pattern
            dominant = get_dominant_risk_pattern(log.flags)
            country_patterns[country]["pattern_counts"][dominant] = country_patterns[country]["pattern_counts"].get(dominant, 0) + 1
            
            # Track ethical scores for trend
            ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
            country_patterns[country]["trend_scores"].append(ethical_score)
        
        # Calculate dominant pattern and trend direction
        country_summary = []
        for country_code, data in country_patterns.items():
            # Dominant pattern
            if data["pattern_counts"]:
                dominant = max(data["pattern_counts"].items(), key=lambda x: x[1])[0]
            else:
                dominant = "Unknown"
            
            # Trend direction (comparing recent vs older scores)
            trend_scores = data["trend_scores"]
            if len(trend_scores) >= 10:
                recent_avg = sum(trend_scores[-10:]) / 10
                older_avg = sum(trend_scores[:10]) / 10
                if recent_avg < older_avg - 5:
                    trend = "Decreasing"
                elif recent_avg > older_avg + 5:
                    trend = "Increasing"
                else:
                    trend = "Stable"
            else:
                trend = "Insufficient Data"
            
            country_summary.append({
                "country_code": country_code,
                "dominant_risk_pattern": dominant,
                "trend_direction": trend
            })
        
        return {
            "ok": True,
            "countries": country_summary
        }
    
    except Exception as e:
        logger.error(f"[Global] Error generating country patterns: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Country patterns could not be generated"
        )

