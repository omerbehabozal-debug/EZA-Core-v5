# -*- coding: utf-8 -*-
"""
EZA Proxy - Telemetry Service
Corporate dashboard data flow
"""

import logging
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.production import TelemetryEvent

logger = logging.getLogger(__name__)


async def log_analysis(
    db: AsyncSession,
    content_hash: str,
    scores: Dict[str, int],
    flags: List[str],
    domain: Optional[str] = None,
    policies: Optional[List[str]] = None,
    user_id: Optional[int] = None,
    company_id: Optional[int] = None,
    analysis_mode: Optional[str] = None,  # "fast" | "pro"
    # NEW: Additional fields for TelemetryEvent persistence
    analysis_id: Optional[str] = None,
    org_id: Optional[str] = None,
    risk_band: Optional[str] = None,
    latency_ms: Optional[int] = None,
    provider: Optional[str] = None,
    fail_safe_triggered: bool = False,
    fail_reason: Optional[str] = None,
    source: str = "proxy_ui",  # "proxy_ui" | "api"
    token_usage: Optional[Dict[str, int]] = None
) -> None:
    """
    Log analysis result to telemetry (structured logs + database)
    
    CRITICAL: Writes TelemetryEvent to database for regulator panels.
    This is called for EVERY analysis completion (FAST, PRO, rate-limited, etc.)
    """
    # Structured logging (existing behavior)
    try:
        logger.info(
            "[Proxy Telemetry] Analysis logged",
            extra={
                "content_hash": content_hash,
                "scores": scores,
                "flags": flags,
                "domain": domain,
                "policies": policies,
                "user_id": user_id,
                "company_id": company_id,
                "analysis_mode": analysis_mode,
                "analysis_id": analysis_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    except Exception as e:
        logger.error(f"[Proxy] Telemetry structured logging error: {str(e)}")
    
    # CRITICAL: Database persistence for regulator panels
    # This MUST NOT break analysis flow if it fails
    try:
        # Validate required fields for TelemetryEvent
        if not org_id:
            logger.warning("[Proxy Telemetry] Skipping TelemetryEvent write: org_id is required")
            return
        
        # Convert org_id to UUID if it's a string
        try:
            org_uuid = uuid.UUID(org_id) if isinstance(org_id, str) else org_id
        except (ValueError, TypeError):
            logger.warning(f"[Proxy Telemetry] Skipping TelemetryEvent write: invalid org_id format: {org_id}")
            return
        
        # Get overall score (ethical_index as primary risk score)
        risk_score = scores.get("ethical_index") if scores else None
        
        # Convert flags to JSON-serializable format
        # Store analysis_mode, risk_band, domain, and policy_pack in flags JSON
        # (since TelemetryEvent model doesn't have dedicated fields for these)
        flags_json = {
            "risk_flags": flags if flags else [],
            "analysis_mode": analysis_mode,  # "fast" | "pro"
            "risk_band": risk_band,  # "low" | "medium" | "high"
            "domain": domain,  # if available
            "policy_pack": policies if policies else []  # policy pack as list
        }
        
        # Create TelemetryEvent record
        telemetry_event = TelemetryEvent(
            org_id=org_uuid,
            source=source,  # "proxy_ui" or "api"
            data_type="real",  # Always "real" for actual analyses
            risk_score=risk_score,  # overall_score (ethical_index)
            latency_ms=latency_ms,
            provider=provider,
            content_id=analysis_id,  # Store analysis_id as content_id (no content stored)
            flags=flags_json,  # Risk flags + analysis_mode + risk_band + domain + policy_pack as JSON
            token_usage=token_usage,  # Token usage breakdown as JSON
            fail_safe_triggered=fail_safe_triggered,
            fail_reason=fail_reason
        )
        
        # Write to database
        db.add(telemetry_event)
        await db.commit()
        
        logger.info(
            f"[Proxy Telemetry] TelemetryEvent written: analysis_id={analysis_id}, "
            f"org_id={org_id}, analysis_mode={analysis_mode}, risk_score={risk_score}"
        )
        
    except Exception as e:
        # CRITICAL: TelemetryEvent write failure MUST NOT break analysis flow
        # Rollback the failed transaction
        try:
            await db.rollback()
        except Exception:
            pass  # Ignore rollback errors
        
        logger.error(
            f"[Proxy Telemetry] TelemetryEvent write failed: {str(e)}. "
            f"Analysis continues normally. analysis_id={analysis_id}, org_id={org_id}",
            exc_info=True
        )


async def log_rewrite(
    db: AsyncSession,
    original_hash: str,
    rewritten_hash: str,
    mode: str,
    score_before: Dict[str, int],
    score_after: Dict[str, int],
    improvement: Dict[str, int],
    user_id: Optional[int] = None,
    company_id: Optional[int] = None
) -> None:
    """Log rewrite result to telemetry"""
    try:
        logger.info(
            "[Proxy Telemetry] Rewrite logged",
            extra={
                "original_hash": original_hash,
                "rewritten_hash": rewritten_hash,
                "mode": mode,
                "score_before": score_before,
                "score_after": score_after,
                "improvement": improvement,
                "user_id": user_id,
                "company_id": company_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    except Exception as e:
        logger.error(f"[Proxy] Rewrite telemetry logging error: {str(e)}")


async def get_telemetry_metrics(
    db: AsyncSession,
    company_id: Optional[int] = None,
    hours: int = 24
) -> Dict[str, Any]:
    """
    Get telemetry metrics for corporate dashboard
    Returns aggregated metrics
    """
    try:
        # In a real implementation, this would query the telemetry table
        # For now, return mock data structure
        return {
            "average_risk_scores": {
                "ethical_index": 65,
                "compliance_score": 72,
                "manipulation_score": 68,
                "bias_score": 70,
                "legal_risk_score": 75
            },
            "department_usage": {},
            "risk_categories": [],
            "rewrite_success_rate": 0.85,
            "security_improvement_percentage": 15.3
        }
    except Exception as e:
        logger.error(f"[Proxy] Telemetry metrics error: {str(e)}")
        return {}


async def get_regulator_data(
    db: AsyncSession,
    hours: int = 1
) -> Dict[str, Any]:
    """
    Get regulator-appropriate data (anonymized scores only)
    No content shared
    """
    try:
        return {
            "hourly_risk_fluctuation": [
                {"hour": "00:00", "avg_ethical": 65, "avg_compliance": 72},
                {"hour": "01:00", "avg_ethical": 67, "avg_compliance": 74},
                # ...
            ],
            "sector_compliance_score": {
                "finance": 78,
                "health": 82,
                "media": 71,
                "retail": 75
            }
        }
    except Exception as e:
        logger.error(f"[Proxy] Regulator data error: {str(e)}")
        return {}

