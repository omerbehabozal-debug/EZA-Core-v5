# -*- coding: utf-8 -*-
"""
EZA Proxy - SLA & Alerting System
Uptime, latency monitoring, alert triggers
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.utils.dependencies import get_db
from backend.auth.proxy_auth import require_proxy_auth
from backend.auth.rbac import require_permission
from backend.models.production import IntentLog
from sqlalchemy import select
import uuid

router = APIRouter()
logger = logging.getLogger(__name__)

# SLA thresholds
SLA_THRESHOLDS = {
    "pro": {
        "uptime": 99.5,
        "latency_ms": 800,
    },
    "enterprise": {
        "uptime": 99.9,
        "latency_ms": 500,
    },
}

# Alert store (in production, use database)
alerts: Dict[str, List[Dict[str, Any]]] = {}  # org_id -> alerts


class SLAStatus(BaseModel):
    org_id: str
    plan: str
    uptime: float
    avg_latency: float
    error_rate: float
    fail_safe_triggers: int
    sla_met: bool
    alerts: List[Dict[str, Any]]


class AlertRequest(BaseModel):
    type: str  # latency | success_rate | failsafe
    severity: str  # warning | error
    message: str
    metadata: Optional[Dict[str, Any]] = None


async def calculate_sla_metrics(db: AsyncSession, org_id: str, plan: str) -> Dict[str, Any]:
    """Calculate SLA metrics for organization from database"""
    try:
        org_uuid = uuid.UUID(org_id)
    except ValueError:
        logger.warning(f"[SLA] Invalid org_id format: {org_id}")
        return {
            "uptime": 100.0,
            "avg_latency": 0.0,
            "error_rate": 0.0,
            "fail_safe_triggers": 0,
        }
    
    # Get last 30 days of entries
    from_date = datetime.utcnow() - timedelta(days=30)
    
    # Query IntentLog entries
    intent_query = select(IntentLog).where(
        IntentLog.organization_id == org_uuid,
        IntentLog.created_at >= from_date
    )
    
    intent_result = await db.execute(intent_query)
    intent_logs = intent_result.scalars().all()
    
    if not intent_logs:
        return {
            "uptime": 100.0,
            "avg_latency": 0.0,
            "error_rate": 0.0,
            "fail_safe_triggers": 0,
        }
    
    # Calculate metrics
    total_requests = len(intent_logs)
    error_count = 0
    total_latency = 0.0
    fail_safe_count = 0
    
    for intent in intent_logs:
        scores = intent.risk_scores or {}
        
        # Error if ethical_index < 50
        if scores.get("ethical_index", 50) < 50:
            error_count += 1
        
        # Note: IntentLog doesn't store latency or fail_safe_triggered
        # These would come from TelemetryEvent in production
        # For now, we'll use default values
        latency = 0  # Would come from TelemetryEvent
        total_latency += latency
        
        # Check for fail-safe trigger (would come from TelemetryEvent)
        fail_safe_triggered = False  # Would come from TelemetryEvent
        if fail_safe_triggered:
            fail_safe_count += 1
    
    uptime = ((total_requests - error_count) / total_requests) * 100 if total_requests > 0 else 100.0
    avg_latency = total_latency / total_requests if total_requests > 0 else 0.0
    error_rate = (error_count / total_requests) * 100 if total_requests > 0 else 0.0
    
    return {
        "uptime": uptime,
        "avg_latency": avg_latency,
        "error_rate": error_rate,
        "fail_safe_triggers": fail_safe_count,
    }


def check_sla_violations(org_id: str, plan: str, metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Check for SLA violations and create alerts"""
    threshold = SLA_THRESHOLDS.get(plan, SLA_THRESHOLDS["pro"])
    violations = []
    
    # Check latency
    if metrics["avg_latency"] > threshold["latency_ms"]:
        violations.append({
            "type": "latency",
            "severity": "error",
            "message": f"Latency {metrics['avg_latency']:.0f}ms exceeds SLA threshold {threshold['latency_ms']}ms",
            "value": metrics["avg_latency"],
            "threshold": threshold["latency_ms"],
        })
    
    # Check uptime
    if metrics["uptime"] < threshold["uptime"]:
        violations.append({
            "type": "uptime",
            "severity": "error",
            "message": f"Uptime {metrics['uptime']:.2f}% below SLA threshold {threshold['uptime']}%",
            "value": metrics["uptime"],
            "threshold": threshold["uptime"],
        })
    
    # Check error rate
    if metrics["error_rate"] > 5.0:  # 5% error rate threshold
        violations.append({
            "type": "error_rate",
            "severity": "warning",
            "message": f"Error rate {metrics['error_rate']:.2f}% exceeds 5% threshold",
            "value": metrics["error_rate"],
            "threshold": 5.0,
        })
    
    # Check fail-safe triggers
    if metrics["fail_safe_triggers"] > 0:
        violations.append({
            "type": "failsafe",
            "severity": "error",
            "message": f"Fail-safe triggered {metrics['fail_safe_triggers']} times",
            "value": metrics["fail_safe_triggers"],
            "threshold": 0,
        })
    
    return violations


@router.get("/{org_id}/sla/status")
async def get_sla_status(
    org_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_permission("dashboard.read"))
):
    """
    Get SLA status for organization
    """
    # Verify org access
    user_org_id = current_user.get("org_id") or current_user.get("company_id")
    if user_org_id != org_id and current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    # Get plan from billing
    from backend.routers.billing import org_billing, BILLING_PLANS
    billing_data = org_billing.get(org_id, {"plan": "free"})
    plan = billing_data.get("plan", "free")
    
    # Calculate metrics
    metrics = await calculate_sla_metrics(db, org_id, plan)
    
    # Check SLA violations
    threshold = SLA_THRESHOLDS.get(plan, SLA_THRESHOLDS["pro"])
    sla_met = (
        metrics["uptime"] >= threshold["uptime"] and
        metrics["avg_latency"] <= threshold["latency_ms"]
    )
    
    # Get recent alerts
    org_alerts = alerts.get(org_id, [])
    recent_alerts = org_alerts[-10:]  # Last 10 alerts
    
    return SLAStatus(
        org_id=org_id,
        plan=plan,
        uptime=metrics["uptime"],
        avg_latency=metrics["avg_latency"],
        error_rate=metrics["error_rate"],
        fail_safe_triggers=metrics["fail_safe_triggers"],
        sla_met=sla_met,
        alerts=recent_alerts
    )


@router.post("/{org_id}/alerts/webhook")
async def create_alert(
    org_id: str,
    alert: AlertRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth)
):
    """
    Create alert for organization
    Can be called by system or webhook
    """
    if org_id not in alerts:
        alerts[org_id] = []
    
    alert_entry = {
        "id": f"alert-{datetime.utcnow().timestamp()}",
        "org_id": org_id,
        "type": alert.type,
        "severity": alert.severity,
        "message": alert.message,
        "metadata": alert.metadata or {},
        "created_at": datetime.utcnow().isoformat(),
    }
    
    alerts[org_id].append(alert_entry)
    
    # Keep only last 100 alerts per org
    if len(alerts[org_id]) > 100:
        alerts[org_id] = alerts[org_id][-100:]
    
    logger.warning(f"[SLA] Alert created for org {org_id}: {alert.message}")
    
    # In production, send to Slack/Email/Webhook
    # For now, just log
    
    return {
        "ok": True,
        "alert": alert_entry,
        "message": "Alert created"
    }


# Background task to check SLA violations periodically
async def check_sla_periodically():
    """Periodically check SLA violations for all organizations"""
    from backend.routers.billing import org_billing
    
    # Note: This background task would need database access
    # For now, it's disabled as it requires async db session
    # In production, use a proper background task system with db dependency injection
    logger.warning("[SLA] Background SLA check disabled - requires database access")
    # for org_id, billing_data in org_billing.items():
    #     plan = billing_data.get("plan", "free")
    #     metrics = await calculate_sla_metrics(db, org_id, plan)  # Would need db session
    #     violations = check_sla_violations(org_id, plan, metrics)
    #     for violation in violations:
    #         # Create alert
    #         alert_req = AlertRequest(
    #             type=violation["type"],
    #             severity=violation["severity"],
    #             message=violation["message"],
    #             metadata={
    #                 "value": violation["value"],
    #                 "threshold": violation["threshold"],
    #             }
    #         )
    #         # Call create_alert endpoint (would need to inject dependencies)
    #         # For now, just log
    #         logger.warning(f"[SLA] Violation detected for org {org_id}: {violation['message']}")

