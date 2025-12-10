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
from backend.security.rate_limit import rate_limit_proxy_corporate

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory audit store (in production, use database)
audit_store: Dict[str, Dict[str, Any]] = {}


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
    justification: List[DecisionJustification]
) -> Dict[str, Any]:
    """Create audit entry with hash and signature"""
    audit_data = {
        "analysis_id": analysis_id,
        "content_hash": generate_sha256_hash(content),
        "scores": scores,
        "risk_flags": [flag.dict() for flag in risk_flags],
        "policy_trace": policy_trace,
        "justification": [j.dict() for j in justification],
        "timestamp": datetime.utcnow().isoformat()
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


@router.get("/audit", response_model=AuditResponse)
async def get_audit(
    analysis_id: str = Query(..., description="Analysis UUID"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth),
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

