# -*- coding: utf-8 -*-
"""
EZA Proxy - Audit & Reporting Endpoints
Audit trail, PDF reports, hash verification
"""

import hashlib
import json
import logging
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.utils.dependencies import get_db
from backend.auth.proxy_auth_production import require_proxy_auth_production
from backend.security.rate_limit import rate_limit_proxy_corporate
from backend.models.production import IntentLog, ImpactEvent
from sqlalchemy import select, or_
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

