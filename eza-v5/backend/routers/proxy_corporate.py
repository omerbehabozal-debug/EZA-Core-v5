# -*- coding: utf-8 -*-
"""
EZA Proxy - Corporate Router
Deep analysis, rewrite, telemetry for corporate clients
"""

import logging
import hashlib
import uuid
import time
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from typing import List, Optional, Literal, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.utils.dependencies import get_db
from backend.security.rate_limit import rate_limit_proxy_corporate
from backend.auth.proxy_auth import require_proxy_auth
from backend.services.proxy_analyzer import analyze_content_deep
from backend.services.proxy_rewrite_engine import rewrite_content
from backend.services.proxy_telemetry import log_analysis, log_rewrite, get_telemetry_metrics, get_regulator_data
from backend.routers.proxy_audit import RiskFlagSeverity, DecisionJustification, create_audit_entry
from backend.routers.proxy_websocket import update_telemetry_state
from backend.routers.policy_management import get_enabled_policies_for_org

router = APIRouter()
logger = logging.getLogger(__name__)


# ========== REQUEST/RESPONSE MODELS ==========

class ProxyAnalyzeRequest(BaseModel):
    content: str
    input_type: Literal["text", "image", "audio", "video"] = "text"
    policies: Optional[List[Literal["TRT", "FINTECH", "HEALTH"]]] = None
    provider: Literal["openai", "groq", "mistral"] = "openai"
    domain: Optional[Literal["finance", "health", "retail", "media", "autonomous"]] = None
    return_report: bool = True


class RiskLocation(BaseModel):
    start: int
    end: int
    type: Literal["ethical", "compliance", "manipulation", "bias", "legal"]
    severity: Literal["low", "medium", "high"]


class ParagraphAnalysis(BaseModel):
    paragraph_index: int
    text: str
    ethical_index: int
    compliance_score: int
    manipulation_score: int
    bias_score: int
    legal_risk_score: int
    flags: List[str]
    risk_locations: List[RiskLocation]


class RiskFlagSeverityResponse(BaseModel):
    flag: str
    severity: float
    policy: str
    evidence: Optional[str] = None


class DecisionJustificationResponse(BaseModel):
    violation: str
    policy: str
    evidence: str
    severity: float


class ProxyAnalyzeResponse(BaseModel):
    ok: bool = True
    overall_scores: Dict[str, int]
    paragraphs: List[ParagraphAnalysis]
    flags: List[str]
    risk_locations: List[RiskLocation]
    report: Optional[str] = None
    provider: str = "EZA-Core"
    analysis_id: Optional[str] = None
    risk_flags_severity: Optional[List[RiskFlagSeverityResponse]] = None
    justification: Optional[List[DecisionJustificationResponse]] = None


class ProxyRewriteRequest(BaseModel):
    content: str
    mode: Literal["strict_compliance", "neutral_rewrite", "policy_bound", "autonomous_safety", "corporate_voice"]
    policies: Optional[List[Literal["TRT", "FINTECH", "HEALTH"]]] = None
    domain: Optional[Literal["finance", "health", "retail", "media", "autonomous"]] = None
    provider: Literal["openai", "groq", "mistral"] = "openai"
    auto_reanalyze: bool = True


class ProxyRewriteResponse(BaseModel):
    ok: bool = True
    original_content: str
    rewritten_content: str
    original_scores: Dict[str, int]
    new_scores: Optional[Dict[str, int]] = None
    improvement: Optional[Dict[str, int]] = None
    provider: str = "EZA-Core"


# ========== HELPER FUNCTIONS ==========

def generate_content_hash(content: str) -> str:
    """Generate hash for content (for telemetry)"""
    return hashlib.sha256(content.encode()).hexdigest()[:16]


# ========== ENDPOINTS ==========

@router.post("/analyze", response_model=ProxyAnalyzeResponse)
async def proxy_analyze(
    request: ProxyAnalyzeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth),
    _: None = Depends(rate_limit_proxy_corporate)
):
    """
    EZA Proxy - Deep Content Analysis
    Paragraph + Sentence level analysis with 5 score types
    """
    try:
        logger.info(f"[Proxy] Analyze request: domain={request.domain}, policies={request.policies}, user_id={current_user.get('user_id')}")
        
        # For now, only text input_type is supported
        # Media processing can be added later
        if request.input_type != "text":
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail=f"Input type '{request.input_type}' not yet implemented. Use 'text' for now."
            )
        
        # Generate analysis ID
        analysis_id = str(uuid.uuid4())
        
        # Start timing for latency measurement
        start_time = time.time()
        
        # Deep analysis
        analysis_result = await analyze_content_deep(
            content=request.content,
            domain=request.domain,
            policies=request.policies,
            provider=request.provider
        )
        
        # Calculate latency
        latency_ms = (time.time() - start_time) * 1000
        
        # Convert risk locations to RiskFlagSeverity model
        risk_flags_severity = []
        policy_trace = []
        justification = []
        
        for loc in analysis_result.get("risk_locations", []):
            severity_value = {"low": 0.3, "medium": 0.6, "high": 0.9}.get(loc.get("severity", "medium"), 0.5)
            policy_code = f"{request.domain.upper()}-{loc.get('type', 'UNKNOWN').upper()}" if request.domain else "GENERAL-01"
            
            risk_flag = RiskFlagSeverity(
                flag=loc.get("type", "unknown"),
                severity=severity_value,
                policy=policy_code,
                evidence=request.content[loc.get("start", 0):loc.get("end", 0)]
            )
            risk_flags_severity.append(risk_flag)
            
            # Add to policy trace
            policy_trace.append({
                "policy": policy_code,
                "triggered_at": loc.get("start", 0),
                "severity": loc.get("severity", "medium")
            })
            
            # Add to justification
            justification.append(DecisionJustification(
                violation=f"{loc.get('type', 'unknown')} ihlali",
                policy=policy_code,
                evidence=request.content[loc.get("start", 0):loc.get("end", 0)],
                severity=severity_value
            ))
        
        # Get org_id from API key or user context
        org_id = current_user.get("org_id") or current_user.get("company_id")
        
        # Get enabled policies for org (if org_id exists)
        if org_id:
            enabled_policies = get_enabled_policies_for_org(org_id)
            # Override request.policies with org-specific enabled policies
            if enabled_policies:
                # Filter to only valid policy IDs
                valid_policies = [p for p in enabled_policies if p in ["TRT", "FINTECH", "HEALTH"]]
                if valid_policies:
                    request.policies = valid_policies
        
        # Estimate token usage (mock, in production get from LLM response)
        estimated_tokens = len(request.content.split()) * 1.3  # Rough estimate
        
        # Create audit entry with metadata
        create_audit_entry(
            analysis_id=analysis_id,
            content=request.content,
            scores=analysis_result["overall_scores"],
            risk_flags=risk_flags_severity,
            policy_trace=policy_trace,
            justification=justification,
            org_id=org_id,
            metadata={
                "token_usage": int(estimated_tokens),
                "llm_provider": request.provider,
                "latency_ms": latency_ms,
                "pipeline_steps": 4,  # Input -> LLM -> Risk Engine -> Policy -> Output
            }
        )
        
        # Update telemetry
        update_telemetry_state(
            risk_flag_distribution={flag.flag: flag.severity for flag in risk_flags_severity},
            last_policy_triggered=policy_trace[0]["policy"] if policy_trace else None
        )
        
        # Log to telemetry
        content_hash = generate_content_hash(request.content)
        await log_analysis(
            db=db,
            content_hash=content_hash,
            scores=analysis_result["overall_scores"],
            flags=analysis_result["flags"],
            domain=request.domain,
            policies=request.policies,
            user_id=current_user.get("user_id"),
            company_id=current_user.get("company_id")
        )
        
        # Generate report if requested
        report = None
        if request.return_report:
            report = f"""EZA Proxy Analiz Raporu

Genel Skorlar:
- Etik İndeks: {analysis_result['overall_scores']['ethical_index']}/100
- Uyum Skoru: {analysis_result['overall_scores']['compliance_score']}/100
- Manipülasyon Skoru: {analysis_result['overall_scores']['manipulation_score']}/100
- Önyargı Skoru: {analysis_result['overall_scores']['bias_score']}/100
- Hukuki Risk Skoru: {analysis_result['overall_scores']['legal_risk_score']}/100

Tespit Edilen Riskler: {len(analysis_result['flags'])} adet
Risk Lokasyonları: {len(analysis_result['risk_locations'])} adet
"""
        
        return ProxyAnalyzeResponse(
            ok=True,
            overall_scores=analysis_result["overall_scores"],
            paragraphs=[
                ParagraphAnalysis(**para) for para in analysis_result["paragraphs"]
            ],
            flags=analysis_result["flags"],
            risk_locations=[
                RiskLocation(**loc) for loc in analysis_result["risk_locations"]
            ],
            report=report,
            provider="EZA-Core",
            analysis_id=analysis_id,
            risk_flags_severity=[
                RiskFlagSeverityResponse(
                    flag=flag.flag,
                    severity=flag.severity,
                    policy=flag.policy,
                    evidence=flag.evidence
                ) for flag in risk_flags_severity
            ] if risk_flags_severity else None,
            justification=[
                DecisionJustificationResponse(
                    violation=j.violation,
                    policy=j.policy,
                    evidence=j.evidence,
                    severity=j.severity
                ) for j in justification
            ] if justification else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Proxy] Analysis error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analiz hatası: {str(e)}"
        )


@router.post("/rewrite", response_model=ProxyRewriteResponse)
async def proxy_rewrite(
    request: ProxyRewriteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth),
    _: None = Depends(rate_limit_proxy_corporate)
):
    """
    EZA Proxy - Rewrite Content
    5 rewrite modes with auto re-analysis
    """
    try:
        logger.info(f"[Proxy] Rewrite request: mode={request.mode}, domain={request.domain}, user_id={current_user.get('user_id')}")
        
        # Analyze original content first
        original_analysis = await analyze_content_deep(
            content=request.content,
            domain=request.domain,
            policies=request.policies,
            provider=request.provider
        )
        original_scores = original_analysis["overall_scores"]
        
        # Rewrite content
        rewritten_content = await rewrite_content(
            content=request.content,
            mode=request.mode,
            policies=request.policies,
            domain=request.domain,
            provider=request.provider
        )
        
        # Auto re-analyze if requested
        new_scores = None
        improvement = None
        
        if request.auto_reanalyze:
            new_analysis = await analyze_content_deep(
                content=rewritten_content,
                domain=request.domain,
                policies=request.policies,
                provider=request.provider
            )
            new_scores = new_analysis["overall_scores"]
            
            # Calculate improvement
            improvement = {
                "ethical_index": new_scores["ethical_index"] - original_scores["ethical_index"],
                "compliance_score": new_scores["compliance_score"] - original_scores["compliance_score"],
                "manipulation_score": new_scores["manipulation_score"] - original_scores["manipulation_score"],
                "bias_score": new_scores["bias_score"] - original_scores["bias_score"],
                "legal_risk_score": new_scores["legal_risk_score"] - original_scores["legal_risk_score"]
            }
        
        # Log to telemetry
        original_hash = generate_content_hash(request.content)
        rewritten_hash = generate_content_hash(rewritten_content)
        await log_rewrite(
            db=db,
            original_hash=original_hash,
            rewritten_hash=rewritten_hash,
            mode=request.mode,
            score_before=original_scores,
            score_after=new_scores or original_scores,
            improvement=improvement or {},
            user_id=current_user.get("user_id"),
            company_id=current_user.get("company_id")
        )
        
        return ProxyRewriteResponse(
            ok=True,
            original_content=request.content,
            rewritten_content=rewritten_content,
            original_scores=original_scores,
            new_scores=new_scores,
            improvement=improvement,
            provider="EZA-Core"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Proxy] Rewrite error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Yeniden yazma hatası: {str(e)}"
        )


@router.get("/telemetry")
async def get_telemetry(
    hours: int = 24,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth)
):
    """
    Get telemetry metrics for corporate dashboard
    """
    try:
        company_id = current_user.get("company_id")
        metrics = await get_telemetry_metrics(db, company_id, hours)
        return {
            "ok": True,
            "metrics": metrics,
            "hours": hours
        }
    except Exception as e:
        logger.error(f"[Proxy] Telemetry error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Telemetri hatası: {str(e)}"
        )


@router.get("/regulator-data")
async def get_regulator_data_endpoint(
    hours: int = 1,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth)
):
    """
    Get regulator-appropriate data (anonymized scores only)
    No content shared
    """
    try:
        # Check if user has regulator access
        user_role = current_user.get("role", "")
        if user_role not in ["regulator", "admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Regulator access required"
            )
        
        data = await get_regulator_data(db, hours)
        return {
            "ok": True,
            "data": data,
            "hours": hours
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Proxy] Regulator data error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Regülatör veri hatası: {str(e)}"
        )

