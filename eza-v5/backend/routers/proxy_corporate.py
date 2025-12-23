# -*- coding: utf-8 -*-
"""
EZA Proxy - Corporate Router
Deep analysis, rewrite, telemetry for corporate clients
"""

import logging
import hashlib
import uuid
import time
from fastapi import APIRouter, Depends, HTTPException, status
from starlette.requests import Request
from pydantic import BaseModel
from typing import List, Optional, Literal, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.utils.dependencies import get_db
from backend.security.rate_limit import rate_limit_proxy_corporate
from backend.auth.proxy_auth_production import require_proxy_auth_production
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
    # Contextual Camera Mode: start/end are optional (not used in new system)
    start: Optional[int] = None  # Optional for backward compatibility
    end: Optional[int] = None  # Optional for backward compatibility
    type: Literal["ethical", "compliance", "manipulation", "bias", "legal"]
    severity: Literal["low", "medium", "high"]
    evidence: Optional[str] = None  # Contextual evidence (meaning-based, not word positions)
    policy: Optional[str] = None  # Primary policy code (for backward compatibility)
    policies: Optional[List[str]] = None  # Array of all policy references (collapsed violations)
    primary_risk_pattern: Optional[str] = None  # Primary risk pattern identifier
    occurrence_count: Optional[int] = None  # How many times this pattern appeared (after grouping)


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
    violation: str  # Primary risk pattern label
    policy: str  # Primary policy (for backward compatibility)
    policies: Optional[List[str]] = None  # Array of all policy references (if multiple)
    evidence: str  # Consolidated decision rationale (ONE explanation per pattern)
    severity: float  # Single severity per primary risk pattern


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
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production),
    _: None = Depends(rate_limit_proxy_corporate)
):
    """
    EZA Proxy - Deep Content Analysis
    Paragraph + Sentence level analysis with 5 score types
    
    Authorization:
    - Requires JWT token (mandatory)
    - Requires organization_id in x-org-id header (mandatory)
    - Backend resolves API key internally from organization
    - No frontend API key handling
    """
    try:
        user_id = current_user.get('user_id')
        org_id = current_user.get('org_id')
        resolved_api_key_id = current_user.get('resolved_api_key_id', 'unknown')
        
        logger.info(
            f"[Proxy] Analyze request: domain={request.domain}, policies={request.policies}, "
            f"user_id={user_id}, org_id={org_id}, api_key_id={resolved_api_key_id[:8]}..."
        )
        
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
        
        # Deep analysis with 3-stage gated pipeline
        # Role: "proxy" for full Proxy, "proxy_lite" for Proxy Lite
        analysis_result = await analyze_content_deep(
            content=request.content,
            domain=request.domain,
            policies=request.policies,
            provider=request.provider,
            role="proxy"  # Full Proxy - max 4 paragraphs in Stage-1
        )
        
        # Calculate latency
        latency_ms = (time.time() - start_time) * 1000
        
        # PRIMARY RISK PATTERN & VIOLATION COLLAPSING
        # NOTE: risk_locations are already collapsed by narrative intent in group_violations()
        # Each risk_location represents ONE primary risk pattern with multiple policies
        risk_flags_severity = []
        policy_trace = []
        justification = []
        
        for loc in analysis_result.get("risk_locations", []):
            # Get primary risk pattern (collapsed)
            primary_risk_type = loc.get("primary_risk_pattern") or loc.get("type", "unknown")
            severity_str = loc.get("severity", "medium")
            severity_value = {"low": 0.3, "medium": 0.6, "high": 0.9}.get(severity_str, 0.5)
            
            # Get policies array (collapsed violations have multiple policies)
            policies_array = loc.get("policies", [])
            if not policies_array:
                # Fallback: use single policy or construct from domain/type
                single_policy = loc.get("policy")
                if not single_policy:
                    single_policy = f"{request.domain.upper()}-{primary_risk_type.upper()}" if request.domain else "GENERAL-01"
                policies_array = [single_policy]
            
            # Evidence is consolidated (contextual, meaning-based)
            evidence = loc.get("evidence", f"{primary_risk_type} risk detected")
            
            # Create ONE RiskFlagSeverity per primary risk pattern
            # Use primary policy (first in array) for backward compatibility
            primary_policy = policies_array[0]
            
            risk_flag = RiskFlagSeverity(
                flag=primary_risk_type,  # Primary risk pattern (not individual policy)
                severity=severity_value,  # Single severity (highest)
                policy=primary_policy,  # Primary policy (for backward compatibility)
                evidence=evidence  # Consolidated contextual evidence
            )
            risk_flags_severity.append(risk_flag)
            
            # Add all policies to policy trace (for audit)
            occurrence_count = loc.get("occurrence_count", 1)
            for policy_code in policies_array:
                policy_trace.append({
                    "policy": policy_code,
                    "severity": severity_str,
                    "occurrence_count": occurrence_count,
                    "primary_risk_pattern": primary_risk_type  # Link to primary pattern
                })
            
            # Create ONE DecisionJustification per primary risk pattern
            # Consolidate all policies into single rationale
            policies_display = ", ".join(policies_array) if len(policies_array) > 1 else policies_array[0]
            violation_label = f"{primary_risk_type} risk pattern"
            if len(policies_array) > 1:
                violation_label += f" ({len(policies_array)} policy references)"
            
            # Generate consolidated decision rationale
            decision_rationale = evidence  # Use consolidated evidence as rationale
            if len(policies_array) > 1:
                decision_rationale = f"{evidence} (İlgili politikalar: {policies_display})"
            
            # Create DecisionJustification with policies array
            just_obj = DecisionJustification(
                violation=violation_label,
                policy=primary_policy,  # Primary policy (for backward compatibility)
                evidence=decision_rationale,  # Consolidated decision rationale
                severity=severity_value
            )
            # Attach policies array to object (for response serialization)
            just_obj.policies = policies_array if len(policies_array) > 1 else None
            justification.append(just_obj)
        
        # Get org_id from authenticated context (already validated by require_proxy_auth_production)
        org_id = current_user.get("org_id") or current_user.get("company_id")
        
        if not org_id:
            logger.error(f"[Proxy] Missing organization_id in user context. user_id={user_id}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Organizasyon bağlamı eksik. Lütfen geçerli bir organizasyon seçin."
            )
        
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
        
        # Publish telemetry message
        from backend.routers.telemetry_websocket import publish_telemetry_message
        
        # Convert risk flags to telemetry format
        telemetry_flags = []
        for flag in risk_flags_severity:
            # Map severity to High/Medium/Low
            severity_map = {0.7: "High", 0.4: "Medium", 0.3: "Low"}
            severity_str = "Medium"
            if flag.severity >= 0.7:
                severity_str = "High"
            elif flag.severity >= 0.4:
                severity_str = "Medium"
            else:
                severity_str = "Low"
            
            telemetry_flags.append({
                "type": flag.flag,
                "severity": severity_str,
            })
        
        # Determine fail-safe status
        ethical_score = analysis_result["overall_scores"].get("ethical_index", 50)
        fail_safe_triggered = ethical_score < 50
        fail_reason = None
        if fail_safe_triggered:
            # Find highest severity flag
            if risk_flags_severity:
                highest_flag = max(risk_flags_severity, key=lambda f: f.severity)
                fail_reason = f"{highest_flag.flag}-Risk"
        
        # Estimate token usage breakdown
        token_usage_breakdown = {
            "input": int(len(request.content.split()) * 1.3 * 0.7),
            "output": int(len(request.content.split()) * 1.3 * 0.3),
        }
        
        # Get user_id from current_user if available (convert to string)
        user_id_raw = current_user.get("user_id") or current_user.get("sub")
        user_id = str(user_id_raw) if user_id_raw is not None else None
        
        # Audit log: Log analyze request with all required fields
        resolved_api_key_id = current_user.get("resolved_api_key_id", "unknown")
        logger.info(
            f"[Proxy] Analyze audit: user_id={user_id}, org_id={org_id}, "
            f"api_key_id={resolved_api_key_id[:8]}..., analysis_id={analysis_id}, "
            f"timestamp={time.time()}, outcome=success"
        )
        
        # Audit log: analysis_previewed (Draft analysis - not saved)
        # Import here to avoid circular dependency
        from backend.routers.proxy_analysis import log_analysis_audit
        try:
            await log_analysis_audit(
                db=db,
                event_type="analysis_previewed",
                user_id=str(user_id) if user_id else "unknown",
                org_id=str(org_id) if org_id else "unknown",
                record_id=analysis_id,  # Use record_id, not analysis_id
                metadata={
                    "domain": request.domain,
                    "policies": request.policies,
                    "provider": request.provider,
                    "status": "DRAFT"  # This is a draft/preview, not saved
                }
            )
        except Exception as audit_error:
            # Don't fail the analysis if audit logging fails
            logger.warning(f"[Proxy] Audit logging failed: {audit_error}")
        
        publish_telemetry_message(
            org_id=org_id or "unknown",
            content_id=analysis_id,
            risk_score=ethical_score,
            flags=telemetry_flags,
            latency_ms=latency_ms,
            token_usage=token_usage_breakdown,
            provider=request.provider,
            fail_safe_triggered=fail_safe_triggered,
            fail_reason=fail_reason,
            user_id=user_id,
            source="proxy_ui",  # From Proxy UI
            data_type="real",  # Real analysis data (CRITICAL: Only real data affects SLA/Alerting)
        )
        
        # Create fail-safe alert if triggered
        if fail_safe_triggered:
            # Update global fail-safe state (for pipeline diagram)
            from backend.routers.proxy_pipeline import failsafe_state
            import datetime
            failsafe_state["active"] = True
            failsafe_state["triggered_at"] = datetime.datetime.utcnow().isoformat()
            failsafe_state["reason"] = fail_reason or "High risk content detected (Ethical score < 50)"
            
            # Update telemetry state
            update_telemetry_state(fail_safe_state=True)
            
            from backend.services.alerting_service import create_alert_event
            import asyncio
            try:
                # Fire and forget async task
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.create_task(create_alert_event(
                        org_id=org_id or "unknown",
                        alert_type="FAIL_SAFE",
                        severity="critical",
                        message=f"Fail-safe triggered: {fail_reason or 'High risk content detected'}",
                        details={
                            "org_id": org_id,
                            "content_id": analysis_id,
                            "risk_score": ethical_score,
                            "fail_reason": fail_reason,
                            "provider": request.provider,
                            "suggested_action": "Review content",
                        }
                    ))
                else:
                    loop.run_until_complete(create_alert_event(
                        org_id=org_id or "unknown",
                        alert_type="FAIL_SAFE",
                        severity="critical",
                        message=f"Fail-safe triggered: {fail_reason or 'High risk content detected'}",
                        details={
                            "org_id": org_id,
                            "content_id": analysis_id,
                            "risk_score": ethical_score,
                            "fail_reason": fail_reason,
                            "provider": request.provider,
                            "suggested_action": "Review content",
                        }
                    ))
            except Exception as e:
                logger.error(f"[Alerting] Error creating fail-safe alert: {e}")
        else:
            # If no fail-safe triggered, ensure state is cleared (if it was previously active)
            # Note: We don't auto-reset here, only manual reset via /failsafe/reset endpoint
            pass
        
        # Update telemetry state (for /ws/telemetry endpoint)
        # Track successful analysis for LLM provider success rate
        update_telemetry_state(
            pipeline_delay_ms=int(latency_ms),  # Current analysis latency (milliseconds)
            provider=request.provider,  # LLM provider name
            success=True,  # Analysis completed successfully
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
                    policies=getattr(j, 'policies', None),  # Policies array if available
                    evidence=j.evidence,
                    severity=j.severity
                ) for j in justification
            ] if justification else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        # Audit log: Log failure
        user_id = current_user.get('user_id', 'unknown')
        org_id = current_user.get('org_id', 'unknown')
        resolved_api_key_id = current_user.get('resolved_api_key_id', 'unknown')
        logger.error(
            f"[Proxy] Analyze audit: user_id={user_id}, org_id={org_id}, "
            f"api_key_id={resolved_api_key_id[:8]}..., outcome=fail, error={str(e)}"
        )
        logger.error(f"[Proxy] Analysis error: {str(e)}", exc_info=True)
        
        # Track failure for LLM provider success rate
        try:
            provider = getattr(request, 'provider', 'unknown')
            update_telemetry_state(
                provider=provider,
                success=False  # Analysis failed
            )
        except Exception:
            pass  # Don't fail if telemetry update fails
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analiz hatası: {str(e)}"
        )


@router.post("/rewrite", response_model=ProxyRewriteResponse)
async def proxy_rewrite(
    request: ProxyRewriteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production),
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
        
        # Rewrite content (with context preservation check)
        from backend.services.proxy_rewrite_engine import CONTEXT_PRESERVATION_FAILED_MESSAGE
        
        rewritten_content = await rewrite_content(
            content=request.content,
            mode=request.mode,
            policies=request.policies,
            domain=request.domain,
            provider=request.provider
        )
        
        # Check if rewrite was rejected due to context preservation failure
        context_preservation_failed = rewritten_content == CONTEXT_PRESERVATION_FAILED_MESSAGE
        
        # Auto re-analyze if requested AND context was preserved
        new_scores = None
        improvement = None
        
        if request.auto_reanalyze and not context_preservation_failed:
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
        
        # Log to telemetry (only if rewrite succeeded)
        if not context_preservation_failed:
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
            
            # Create Intent Log for rewrite action (fire and forget)
            # Import here to avoid circular dependency
            try:
                from backend.routers.proxy_analysis import create_intent_log, CreateIntentLogRequest
                
                # Create analysis result structure for Intent Log
                # IMPORTANT: Store BOTH original AND rewritten content
                # Intent Log represents the complete rewrite operation
                rewrite_analysis_result = {
                    "overall_scores": original_scores,  # Original scores (before rewrite)
                    "flags": original_analysis.get("flags", []),  # Original flags
                    "risk_locations": original_analysis.get("risk_locations", []),  # Original risk locations
                    "content": request.content,  # ORIGINAL content
                    "input_text": request.content,  # ORIGINAL content
                    "rewritten_content": rewritten_content,  # REWRITTEN content (if rewrite succeeded)
                    "rewrite_scores": new_scores,  # Scores after rewrite (if re-analyzed)
                    "rewrite_improvement": improvement  # Score improvements (if re-analyzed)
                }
                
                # Create Intent Log request
                intent_request = CreateIntentLogRequest(
                    analysis_result=rewrite_analysis_result,
                    trigger_action="rewrite",
                    sector=request.domain,
                    policies=request.policies
                )
                
                # Create Intent Log asynchronously (don't block rewrite response)
                # Use background task to avoid blocking
                import asyncio
                try:
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        # If loop is running, create background task
                        asyncio.create_task(
                            create_intent_log(
                                request=intent_request,
                                db=db,
                                current_user=current_user,
                                x_org_id=current_user.get("org_id")
                            )
                        )
                    else:
                        # If loop is not running, schedule it
                        loop.run_until_complete(
                            create_intent_log(
                                request=intent_request,
                                db=db,
                                current_user=current_user,
                                x_org_id=current_user.get("org_id")
                            )
                        )
                except RuntimeError:
                    # If no event loop, log warning but don't fail
                    logger.warning("[Proxy] No event loop available for Intent Log creation")
            except Exception as e:
                # Don't fail rewrite if Intent Log creation fails
                logger.warning(f"[Proxy] Intent Log creation failed for rewrite: {e}")
        else:
            logger.info("[Proxy] Rewrite rejected due to context preservation failure. No telemetry or Intent Log created.")
        
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
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
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
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
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

