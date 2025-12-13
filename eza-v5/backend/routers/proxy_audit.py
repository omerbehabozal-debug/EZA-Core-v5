# -*- coding: utf-8 -*-
"""
EZA Proxy - Audit & Reporting Endpoints
Audit trail, PDF reports, hash verification
"""

import hashlib
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.utils.dependencies import get_db
from backend.auth.proxy_auth import require_proxy_auth
from backend.auth.rbac import require_permission
from backend.security.rate_limit import rate_limit_proxy_corporate

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory audit store (in production, use database)
audit_store: Dict[str, Dict[str, Any]] = {}

# Helper function to search audit logs
def search_audit_logs(
    org_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    risk_level: Optional[str] = None,
    flag: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Search audit logs with filters"""
    results = []
    
    for analysis_id, entry in audit_store.items():
        # Filter by org_id
        if org_id and entry.get("raw_data", {}).get("org_id") != org_id:
            continue
        
        # Filter by date range
        entry_date = entry.get("timestamp", "")
        if from_date and entry_date < from_date:
            continue
        if to_date and entry_date > to_date:
            continue
        
        # Filter by risk level (based on scores)
        if risk_level:
            scores = entry.get("raw_data", {}).get("scores", {})
            ethical_score = scores.get("ethical_index", 50)
            if risk_level == "high" and ethical_score >= 50:
                continue
            if risk_level == "medium" and (ethical_score < 50 or ethical_score >= 80):
                continue
            if risk_level == "low" and ethical_score < 80:
                continue
        
        # Filter by flag
        if flag:
            risk_flags = entry.get("risk_flags", [])
            if not any(f.get("flag") == flag for f in risk_flags):
                continue
        
        results.append(entry)
    
    # Sort by timestamp descending
    results.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return results


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
    """Create audit entry with hash and signature"""
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
    
    audit_store[analysis_id] = entry
    return entry


@router.get("/audit/search")
async def search_audit(
    org_id: Optional[str] = Query(None, description="Organization ID"),
    from_date: Optional[str] = Query(None, description="From date (ISO format)"),
    to_date: Optional[str] = Query(None, description="To date (ISO format)"),
    risk_level: Optional[str] = Query(None, description="Risk level: low, medium, high"),
    flag: Optional[str] = Query(None, description="Risk flag type"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_permission("audit.read"))
):
    """
    Search audit logs with filters
    """
    results = search_audit_logs(
        org_id=org_id,
        from_date=from_date,
        to_date=to_date,
        risk_level=risk_level,
        flag=flag
    )
    
    return {
        "ok": True,
        "count": len(results),
        "results": results
    }


@router.get("/audit", response_model=AuditResponse)
async def get_audit(
    analysis_id: str = Query(..., description="Analysis UUID"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_permission("audit.read")),
    _: None = Depends(rate_limit_proxy_corporate)
):
    """
    Get audit trail for a specific analysis
    Returns UUID, SHA-256 hash, timestamp, policy trace, risk flags, and signature
    """
    if analysis_id not in audit_store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audit entry not found for analysis_id: {analysis_id}"
        )
    
    entry = audit_store[analysis_id]
    return AuditResponse(**entry)


@router.get("/audit/verify")
async def verify_audit_hash(
    analysis_id: str = Query(..., description="Analysis UUID"),
    provided_hash: str = Query(..., description="SHA-256 hash to verify"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth)
):
    """
    Verify audit entry hash
    Returns verification status
    """
    if analysis_id not in audit_store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit entry not found"
        )
    
    entry = audit_store[analysis_id]
    stored_hash = entry["sha256"]
    
    is_valid = stored_hash == provided_hash
    
    return {
        "ok": True,
        "analysis_id": analysis_id,
        "stored_hash": stored_hash,
        "provided_hash": provided_hash,
        "verified": is_valid,
        "status": "Onaylandı" if is_valid else "Uyuşmazlık"
    }


@router.get("/report/pdf")
async def generate_pdf_report(
    analysis_id: str = Query(..., description="Analysis UUID"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth)
):
    """
    Generate PDF report for audit entry
    """
    if analysis_id not in audit_store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit entry not found"
        )
    
    entry = audit_store[analysis_id]
    
    # Generate simple PDF (in production, use reportlab or similar)
    pdf_content = f"""
EZA Proxy - Denetim Raporu

UUID: {entry['uuid']}
SHA-256: {entry['sha256']}
Tarih: {entry['timestamp']}

Risk Bayrakları:
{json.dumps(entry['risk_flags'], indent=2, ensure_ascii=False)}

Politika İzleme:
{json.dumps(entry['policy_trace'], indent=2, ensure_ascii=False)}

İmza: {entry['signature']}
"""
    
    # Return as text/plain for now (in production, generate actual PDF)
    return Response(
        content=pdf_content,
        media_type="text/plain",
        headers={
            "Content-Disposition": f"attachment; filename=audit_report_{analysis_id}.txt"
        }
    )


@router.post("/regulator/send")
async def send_to_regulator(
    analysis_id: str = Query(..., description="Analysis UUID"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth)
):
    """
    Send anonymized audit data to regulator channel
    """
    if analysis_id not in audit_store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit entry not found"
        )
    
    entry = audit_store[analysis_id]
    
    # Anonymize data (remove content, keep only scores and flags)
    anonymized = {
        "timestamp": entry["timestamp"],
        "risk_flags": entry["risk_flags"],
        "policy_trace": entry["policy_trace"],
        "hash": entry["sha256"]
    }
    
    # Broadcast to regulator WebSocket channel
    from backend.routers.proxy_websocket import broadcast_regulator_data
    await broadcast_regulator_data(anonymized)
    
    return {
        "ok": True,
        "message": "Regülatöre gönderildi",
        "analysis_id": analysis_id
    }

