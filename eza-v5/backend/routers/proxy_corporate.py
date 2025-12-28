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
    analyze_all_paragraphs: bool = False  # If True, analyze all paragraphs regardless of risk detection


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
    ethical_index: Optional[int] = None  # Optional for unanalyzed paragraphs
    compliance_score: Optional[int] = None  # Optional for unanalyzed paragraphs
    manipulation_score: Optional[int] = None  # Optional for unanalyzed paragraphs
    bias_score: Optional[int] = None  # Optional for unanalyzed paragraphs
    legal_risk_score: Optional[int] = None  # Optional for unanalyzed paragraphs
    flags: List[str] = []
    risk_locations: List[RiskLocation] = []
    analysis_level: Optional[str] = None  # Premium Unified Flow: "light" | "deep"
    summary: Optional[str] = None  # Premium Unified Flow: analysis summary


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
    # UI Response Contract: Staged responses
    _staged_response: Optional[Dict[str, Any]] = None  # Stage-0 immediate score, Stage-1 risk summary, final details
    _score_kind: Optional[str] = "final"  # "preliminary" | "final" - for UI consistency
    _partial: bool = False  # True if response is partial (rate limit or circuit breaker)


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
    status_message: Optional[str] = None  # NEW: User-friendly message explaining rewrite result


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
    # Block regulator roles from triggering analysis
    user_role = current_user.get('role', '')
    if user_role in ['REGULATOR_READONLY', 'REGULATOR_AUDITOR']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Regulator panel is READ-ONLY. Analysis cannot be triggered by regulators."
        )
    
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
        
        # Circuit Breaker: Check before Stage-1
        from backend.infra.circuit_breaker import get_circuit_breaker, CircuitBreakerOpenError
        cb = get_circuit_breaker("proxy_analysis")
        circuit_breaker_open = False
        
        # STAGE-0: Always runs first (rate limit independent)
        from backend.services.proxy_analyzer_stage0 import stage0_fast_risk_scan
        logger.info(f"[Proxy] Starting Stage-0 (rate limit independent, org_id={org_id})")
        stage0_result = await stage0_fast_risk_scan(
            content=request.content,
            domain=request.domain,
            provider=request.provider,
            org_id=org_id
        )
        logger.info(f"[Proxy] Stage-0 completed: risk_band={stage0_result.get('risk_band', 'unknown')}")
        
        # Rate Limiter: Check AFTER Stage-0, BEFORE Stage-1
        # This determines Stage-1 mode (light vs deep), but Stage-1 ALWAYS runs
        from backend.services.proxy_rate_limiter import check_rate_limit
        allowed, rate_limit_reason = check_rate_limit(org_id, estimated_tokens=len(request.content.split()))
        
        # Determine Stage-1 mode based on rate limit
        if not allowed:
            logger.info(f"[Proxy] Rate limit exceeded for org_id={org_id}: {rate_limit_reason}. Stage-1 will run in LIGHT mode.")
            logger.info(f"[Proxy] Event: stage1_light_mode, reason: rate_limit_exceeded, analysis_id={analysis_id}")
            stage1_mode = "light"
            # Mark rate limit in stage0_result for Stage-1 to use
            stage0_result["_rate_limit_exceeded"] = True
        else:
            # Normal flow: use risk_band to determine mode
            risk_band = stage0_result.get("risk_band", "low")
            stage1_mode = "light" if risk_band == "low" else "deep"
            logger.info(f"[Proxy] Rate limit OK. Stage-1 will run in {stage1_mode.upper()} mode (risk_band={risk_band})")
            stage0_result["_rate_limit_exceeded"] = False
        
        try:
            # Deep analysis with 3-stage gated pipeline
            # Role: "proxy" for full Proxy, "proxy_lite" for Proxy Lite
            # CRITICAL: Stage-1 ALWAYS runs, only mode changes
            logger.info(f"[Proxy] Calling analyze_content_deep via circuit breaker (org_id={org_id}, stage1_mode={stage1_mode})")
            analysis_result = await cb.call_async(
                analyze_content_deep,
                content=request.content,
                domain=request.domain,
                policies=request.policies,
                provider=request.provider,
                role="proxy",  # Full Proxy - max 4 paragraphs in Stage-1 (or all if analyze_all_paragraphs=True)
                org_id=org_id,
                analyze_all_paragraphs=getattr(request, 'analyze_all_paragraphs', False),  # Analyze all paragraphs if requested
                stage1_mode=stage1_mode  # NEW: Explicit mode control (light or deep)
            )
            logger.info(f"[Proxy] analyze_content_deep completed: has_paragraphs={'paragraphs' in analysis_result}, paragraphs_count={len(analysis_result.get('paragraphs', []))}")
        except CircuitBreakerOpenError:
            logger.warning(f"[Proxy] Circuit breaker OPEN for org_id={org_id}, returning Stage-0 only")
            circuit_breaker_open = True
            # Return Stage-0 only (partial response)
            from backend.services.proxy_analyzer_stage0 import stage0_fast_risk_scan
            stage0_result = await stage0_fast_risk_scan(
                content=request.content,
                domain=request.domain,
                provider=request.provider,
                org_id=org_id
            )
            estimated_range = stage0_result.get("estimated_score_range", [50, 70])
            avg_score = sum(estimated_range) // 2
            analysis_result = {
                "overall_scores": {
                    "ethical_index": avg_score,
                    "compliance_score": avg_score + 10,
                    "manipulation_score": avg_score - 5,
                    "bias_score": avg_score,
                    "legal_risk_score": avg_score + 5,
                },
                "paragraphs": [],
                "flags": [],
                "risk_locations": [],
                "_stage0_result": stage0_result,
                "_performance_metrics": {
                    "stage0_latency_ms": stage0_result.get("_stage0_latency_ms", 0),
                    "stage1_latency_ms": 0,
                    "total_latency_ms": stage0_result.get("_stage0_latency_ms", 0)
                }
            }
            # Create staged_response for circuit breaker case
            if circuit_breaker_open:
                estimated_range = stage0_result.get("estimated_score_range", [50, 70])
                avg_score = sum(estimated_range) // 2
                staged_response = {
                    "stage0_immediate": {
                        "status": "score_ready",
                        "score": avg_score,
                        "score_range": estimated_range,
                        "risk_band": stage0_result.get("risk_band", "low"),
                        "latency_ms": stage0_result.get("_stage0_latency_ms", 0)
                    }
                }
                score_kind = "preliminary"
        except Exception as e:
            logger.error(f"[Proxy] analyze_content_deep failed with exception: {str(e)}", exc_info=True)
            # Fallback: Return Stage-0 only
            from backend.services.proxy_analyzer_stage0 import stage0_fast_risk_scan
            stage0_result = await stage0_fast_risk_scan(
                content=request.content,
                domain=request.domain,
                provider=request.provider,
                org_id=org_id
            )
            estimated_range = stage0_result.get("estimated_score_range", [50, 70])
            avg_score = sum(estimated_range) // 2
            analysis_result = {
                "overall_scores": {
                    "ethical_index": avg_score,
                    "compliance_score": avg_score + 10,
                    "manipulation_score": avg_score - 5,
                    "bias_score": avg_score,
                    "legal_risk_score": avg_score + 5,
                },
                "paragraphs": [],  # Empty paragraphs on error
                "flags": [],
                "risk_locations": [],
                "_stage0_result": stage0_result,
                "_performance_metrics": {
                    "stage0_latency_ms": stage0_result.get("_stage0_latency_ms", 0),
                    "stage1_latency_ms": 0,
                    "total_latency_ms": stage0_result.get("_stage0_latency_ms", 0)
                }
            }
            circuit_breaker_open = True
        
        # Calculate latency
        latency_ms = (time.time() - start_time) * 1000
        
        # ENFORCEMENT: Stage-1 must have run (response must include _stage1_status)
        assert "_stage1_status" in analysis_result, "[ENFORCEMENT] Analysis result must include _stage1_status (Stage-1 must have run)"
        assert analysis_result["_stage1_status"]["status"] == "done", "[ENFORCEMENT] Stage-1 status must be 'done'"
        assert analysis_result["_stage1_status"]["mode"] in ["light", "deep"], f"[ENFORCEMENT] Stage-1 mode must be 'light' or 'deep', got: {analysis_result['_stage1_status']['mode']}"
        
        # ENFORCEMENT: paragraphs must never be empty
        paragraphs_count = len(analysis_result.get("paragraphs", []))
        assert paragraphs_count > 0, f"[ENFORCEMENT] Analysis result paragraphs must not be empty. Got {paragraphs_count} paragraphs."
        
        # DEBUG: Log analysis result structure
        logger.info(f"[Proxy] Analysis result structure: paragraphs_count={paragraphs_count}, has_paragraphs_key={'paragraphs' in analysis_result}, keys={list(analysis_result.keys())}")
        
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
        
        # UI Response Contract: Build staged response
        stage0_result = analysis_result.get("_stage0_result", {})
        performance_metrics = analysis_result.get("_performance_metrics", {})
        
        # Stage 1: Immediate score (from Stage-0)
        estimated_range = stage0_result.get("estimated_score_range", [50, 70])
        immediate_score = sum(estimated_range) // 2
        
        # Stage 2: Risk summary (from Stage-0)
        primary_risk_types = stage0_result.get("primary_risk_types", [])
        risk_band = stage0_result.get("risk_band", "low")
        
        # Stage 3: Final analysis (complete result)
        staged_response = {
            "stage0_immediate": {
                "status": "score_ready",
                "score": immediate_score,
                "score_range": estimated_range,
                "risk_band": risk_band,
                "latency_ms": performance_metrics.get("stage0_latency_ms", 0)
            },
            "stage0_risk_summary": {
                "status": "risk_summary",
                "types": primary_risk_types,
                "risk_band": risk_band,
                "risk_detected": stage0_result.get("risk_detected", False)
            },
            "stage1_complete": {
                "status": "analysis_complete",
                "details": {
                    "overall_scores": analysis_result["overall_scores"],
                    "paragraphs_count": len(analysis_result.get("paragraphs", [])),
                    "flags_count": len(analysis_result.get("flags", [])),
                    "risk_locations_count": len(analysis_result.get("risk_locations", [])),
                    "total_latency_ms": performance_metrics.get("total_latency_ms", 0),
                    "stage0_latency_ms": performance_metrics.get("stage0_latency_ms", 0),
                    "stage1_latency_ms": performance_metrics.get("stage1_latency_ms", 0)
                }
            }
        }
        
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
        
        # UI Staged Response Consistency: Add score_kind
        score_kind = "final"  # Full analysis complete
        if staged_response and staged_response.get("stage0_immediate"):
            # If only Stage-0 is available (e.g., rate limit or circuit breaker), mark as preliminary
            stage1_complete = staged_response.get("stage1_complete")
            if not stage1_complete or not stage1_complete.get("details"):
                score_kind = "preliminary"
        
        # DEBUG: Log paragraphs before mapping
        paragraphs_raw = analysis_result.get("paragraphs", [])
        logger.info(f"[Proxy] Mapping paragraphs: raw_count={len(paragraphs_raw)}, type={type(paragraphs_raw)}")
        if paragraphs_raw:
            logger.info(f"[Proxy] First paragraph sample: {paragraphs_raw[0] if isinstance(paragraphs_raw, list) else 'not a list'}")
        
        return ProxyAnalyzeResponse(
            ok=True,
            overall_scores=analysis_result["overall_scores"],
            paragraphs=[
                ParagraphAnalysis(
                    paragraph_index=para.get("paragraph_index", 0),
                    text=para.get("text", ""),
                    ethical_index=para.get("ethical_index"),  # Optional
                    compliance_score=para.get("compliance_score"),  # Optional
                    manipulation_score=para.get("manipulation_score"),  # Optional
                    bias_score=para.get("bias_score"),  # Optional
                    legal_risk_score=para.get("legal_risk_score"),  # Optional
                    flags=para.get("flags", []),
                    risk_locations=para.get("risk_locations", []),
                    analysis_level=para.get("analysis_level"),  # Premium Unified Flow
                    summary=para.get("summary")  # Premium Unified Flow
                ) for para in paragraphs_raw
            ],
            flags=analysis_result["flags"],
            risk_locations=[
                RiskLocation(**loc) for loc in analysis_result["risk_locations"]
            ],
            report=report,
            _staged_response=staged_response,
            _score_kind=score_kind,  # "preliminary" | "final"
            _partial=circuit_breaker_open,  # True if circuit breaker opened
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
    # Block regulator roles from triggering rewrite
    user_role = current_user.get('role', '')
    if user_role in ['REGULATOR_READONLY', 'REGULATOR_AUDITOR']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Regulator panel is READ-ONLY. Rewrite cannot be triggered by regulators."
        )
    
    try:
        logger.info(f"[Proxy] Rewrite request: mode={request.mode}, domain={request.domain}, user_id={current_user.get('user_id')}")
        
        # Stage-2: Span-Based Rewrite
        # First, analyze original content to get risky spans
        original_analysis = await analyze_content_deep(
            content=request.content,
            domain=request.domain,
            policies=request.policies,
            provider=request.provider,
            role="proxy"  # Full Proxy for rewrite
        )
        original_scores = original_analysis["overall_scores"]
        
        # Stage-2: Span-based rewrite (only risky spans)
        from backend.services.proxy_analyzer_stage2 import stage2_span_based_rewrite
        from backend.services.proxy_rewrite_engine import CONTEXT_PRESERVATION_FAILED_MESSAGE
        
        rewrite_result = await stage2_span_based_rewrite(
            content=request.content,
            analysis_result=original_analysis,
            mode=request.mode,
            policies=request.policies,
            domain=request.domain,
            provider=request.provider,
            max_spans=5  # Maximum 5 spans to rewrite
        )
        
        rewritten_content = rewrite_result["rewritten_content"]
        rewritten_spans = rewrite_result["rewritten_spans"]
        failed_spans = rewrite_result["failed_spans"]
        
        # Check if rewrite was rejected (all spans failed)
        context_preservation_failed = len(rewritten_spans) == 0 and len(failed_spans) > 0
        
        # Determine status message based on rewrite result
        status_message = None
        
        # Check if content actually changed
        content_changed = rewritten_content != request.content
        
        # Auto re-analyze if requested AND context was preserved
        new_scores = None
        improvement = None
        
        if request.auto_reanalyze and not context_preservation_failed and len(rewritten_spans) > 0:
            # Re-analyze rewritten content
            new_analysis = await analyze_content_deep(
                content=rewritten_content,
                domain=request.domain,
                policies=request.policies,
                provider=request.provider,
                role="proxy"
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
            
            # Determine status message based on scores and improvement
            original_ethical = original_scores.get("ethical_index", 50)
            improvement_ethical = improvement.get("ethical_index", 0)
            
            if not content_changed:
                # Content didn't change - check why
                if original_ethical >= 80:
                    status_message = "Metin etik olarak risk sınırının üzerinde. Metin aynı şekilde korundu, değiştirilmedi."
                elif len(rewritten_spans) == 0:
                    status_message = "Risk tespit edilmedi. Metin değiştirilmedi."
                else:
                    status_message = "Metin değiştirilmedi (context preservation nedeniyle)."
            elif improvement_ethical <= 0 and original_ethical >= 75:
                # Content changed but no improvement, and original was already good
                status_message = "Metin etik olarak risk sınırının üzerindeydi. İyileştirilecek bir şey bulunamadı, metin korundu."
            elif improvement_ethical > 0:
                # Improvement achieved
                status_message = f"Metin başarıyla yeniden yazıldı. Etik skor {improvement_ethical:+d} puan iyileşti."
            else:
                # Content changed but no improvement
                status_message = "Metin yeniden yazıldı ancak skor iyileşmedi."
        else:
            # No re-analysis requested or rewrite failed
            if not content_changed:
                original_ethical = original_scores.get("ethical_index", 50)
                if original_ethical >= 80:
                    status_message = "Metin etik olarak risk sınırının üzerinde. Metin aynı şekilde korundu, değiştirilmedi."
                elif len(rewritten_spans) == 0:
                    status_message = "Risk tespit edilmedi. Metin değiştirilmedi."
                else:
                    status_message = "Metin değiştirilmedi (context preservation nedeniyle)."
            elif content_changed and len(rewritten_spans) > 0:
                # Content changed but no re-analysis
                status_message = "Metin yeniden yazıldı. İyileşme analizi yapılmadı."
        
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
            provider="EZA-Core",
            status_message=status_message
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Proxy] Rewrite error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Yeniden yazma hatası: {str(e)}"
        )


@router.get("/performance-metrics")
async def get_performance_metrics(
    time_window_minutes: int = 60,
    role: str = "proxy",
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Get performance metrics (P50/P90/P99) for analysis pipeline
    
    Returns:
        - Metrics summary for all stages
        - SLA compliance status
        - Percentile calculations
    """
    from backend.services.proxy_performance_metrics import (
        get_all_metrics_summary,
        check_sla_compliance
    )
    
    summary = get_all_metrics_summary(time_window_minutes=time_window_minutes)
    sla_status = check_sla_compliance(role=role)
    
    return {
        "ok": True,
        "time_window_minutes": time_window_minutes,
        "role": role,
        "metrics": summary,
        "sla_compliance": sla_status,
        "targets": {
            "proxy_lite": {
                "total_p50_ms": 800,
                "total_p90_ms": 1500
            },
            "proxy": {
                "total_p50_ms": 1500,
                "total_p90_ms": 3000
            },
            "rewrite_p50_ms": 1200,
            "stage0_p50_ms": 500
        }
    }


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

