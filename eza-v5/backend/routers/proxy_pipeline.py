# -*- coding: utf-8 -*-
"""
EZA Proxy - Pipeline & Fail-Safe Endpoints
Pipeline diagram, fail-safe triggers, LLM provider switching
"""

import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.utils.dependencies import get_db
from backend.auth.proxy_auth_production import require_proxy_auth_production
from backend.security.rate_limit import rate_limit_proxy_corporate

router = APIRouter()
logger = logging.getLogger(__name__)

# Global fail-safe state
failsafe_state = {
    "active": False,
    "triggered_at": None,
    "reason": None,
    "current_provider": "openai"
}

# Provider fallback chain
PROVIDER_FALLBACK = ["openai", "groq", "mistral"]


class PipelineNode(BaseModel):
    id: str
    label: str
    type: str  # "input", "llm", "engine", "policy", "output"
    status: str  # "active", "warning", "error"
    metadata: Optional[Dict[str, Any]] = None


class PipelineEdge(BaseModel):
    source: str
    target: str
    label: Optional[str] = None


class PipelineDiagram(BaseModel):
    nodes: List[PipelineNode]
    edges: List[PipelineEdge]
    failsafe_active: bool = False
    failsafe_reason: Optional[str] = None
    failsafe_triggered_at: Optional[str] = None


class FailSafeTrigger(BaseModel):
    reason: str
    severity: str  # "low", "medium", "high", "critical"
    provider: Optional[str] = None


@router.get("/pipeline/diagram", response_model=PipelineDiagram)
async def get_pipeline_diagram(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production),
    _: None = Depends(rate_limit_proxy_corporate)
):
    """
    Get pipeline diagram as DAG (Directed Acyclic Graph)
    Returns nodes and edges for visualization
    """
    nodes = [
        PipelineNode(
            id="input",
            label="Input",
            type="input",
            status="active",
            metadata={"type": "text"}
        ),
        PipelineNode(
            id="llm_provider",
            label=f"LLM Provider ({failsafe_state['current_provider']})",
            type="llm",
            status="active" if not failsafe_state["active"] else "warning",
            metadata={"provider": failsafe_state["current_provider"]}
        ),
        PipelineNode(
            id="eza_risk_engine",
            label="EZA Risk Engine",
            type="engine",
            status="active",
            metadata={"version": "1.0"}
        ),
        PipelineNode(
            id="policy_sets",
            label="Policy Sets",
            type="policy",
            status="active",
            metadata={"policies": ["TRT", "FINTECH", "HEALTH"]}
        ),
        PipelineNode(
            id="output",
            label="Output",
            type="output",
            status="active" if not failsafe_state["active"] else "error",
            metadata={}
        )
    ]
    
    edges = [
        PipelineEdge(source="input", target="llm_provider", label="Content"),
        PipelineEdge(source="llm_provider", target="eza_risk_engine", label="Analysis"),
        PipelineEdge(source="eza_risk_engine", target="policy_sets", label="Risk Scores"),
        PipelineEdge(source="policy_sets", target="output", label="Safe Content")
    ]
    
    return PipelineDiagram(
        nodes=nodes,
        edges=edges,
        failsafe_active=failsafe_state["active"],
        failsafe_reason=failsafe_state.get("reason"),
        failsafe_triggered_at=failsafe_state.get("triggered_at")
    )


@router.post("/failsafe/trigger")
async def trigger_failsafe(
    trigger: FailSafeTrigger,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Trigger fail-safe state
    Activates emergency protocols and switches LLM provider if needed
    """
    import datetime
    
    failsafe_state["active"] = True
    failsafe_state["triggered_at"] = datetime.datetime.utcnow().isoformat()
    failsafe_state["reason"] = trigger.reason
    
    if trigger.provider:
        failsafe_state["current_provider"] = trigger.provider
    else:
        # Auto-switch to next provider in fallback chain
        current_idx = PROVIDER_FALLBACK.index(failsafe_state["current_provider"])
        next_idx = (current_idx + 1) % len(PROVIDER_FALLBACK)
        failsafe_state["current_provider"] = PROVIDER_FALLBACK[next_idx]
    
    # Broadcast fail-safe alert
    from backend.routers.proxy_websocket import broadcast_failsafe_alert
    await broadcast_failsafe_alert({
        "reason": trigger.reason,
        "severity": trigger.severity,
        "provider": failsafe_state["current_provider"],
        "timestamp": failsafe_state["triggered_at"]
    })
    
    # Update telemetry
    from backend.routers.proxy_websocket import update_telemetry_state
    update_telemetry_state(fail_safe_state=True)
    
    logger.warning(f"[Fail-Safe] Triggered: {trigger.reason}, Provider switched to: {failsafe_state['current_provider']}")
    
    return {
        "ok": True,
        "failsafe_active": True,
        "reason": trigger.reason,
        "new_provider": failsafe_state["current_provider"],
        "timestamp": failsafe_state["triggered_at"]
    }


@router.post("/failsafe/reset")
async def reset_failsafe(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Reset fail-safe state
    """
    failsafe_state["active"] = False
    failsafe_state["triggered_at"] = None
    failsafe_state["reason"] = None
    
    from backend.routers.proxy_websocket import update_telemetry_state
    update_telemetry_state(fail_safe_state=False)
    
    return {
        "ok": True,
        "failsafe_active": False,
        "message": "Fail-safe durumu sıfırlandı"
    }


@router.post("/provider/switch")
async def switch_provider(
    provider: str = Query(..., description="New provider: openai, groq, or mistral"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Manually switch LLM provider
    """
    if provider not in PROVIDER_FALLBACK:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid provider. Must be one of: {', '.join(PROVIDER_FALLBACK)}"
        )
    
    old_provider = failsafe_state["current_provider"]
    failsafe_state["current_provider"] = provider
    
    logger.info(f"[Provider] Switched from {old_provider} to {provider}")
    
    return {
        "ok": True,
        "old_provider": old_provider,
        "new_provider": provider,
        "message": f"Sağlayıcı {old_provider} → {provider} olarak değiştirildi"
    }

