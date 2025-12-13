# -*- coding: utf-8 -*-
"""
EZA Proxy - Telemetry WebSocket Endpoints
Real-time risk, performance, and security telemetry
"""

import logging
import json
import uuid
from datetime import datetime
from typing import Dict, Any, List, Set, Optional
from fastapi import WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from collections import deque

from backend.auth.proxy_auth import require_proxy_auth

logger = logging.getLogger(__name__)

# WebSocket connection managers
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.org_connections: Dict[str, Set[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, channel: str, org_id: Optional[str] = None):
        await websocket.accept()
        
        if channel not in self.active_connections:
            self.active_connections[channel] = set()
        self.active_connections[channel].add(websocket)
        
        if org_id:
            if org_id not in self.org_connections:
                self.org_connections[org_id] = set()
            self.org_connections[org_id].add(websocket)
        
        logger.info(f"[WS] Client connected to {channel}, org_id: {org_id}")
    
    def disconnect(self, websocket: WebSocket, channel: str, org_id: Optional[str] = None):
        if channel in self.active_connections:
            self.active_connections[channel].discard(websocket)
        
        if org_id and org_id in self.org_connections:
            self.org_connections[org_id].discard(websocket)
        
        logger.info(f"[WS] Client disconnected from {channel}, org_id: {org_id}")
    
    async def broadcast(self, channel: str, message: Dict[str, Any], org_id: Optional[str] = None):
        """Broadcast message to all connections in channel, optionally filtered by org_id"""
        disconnected = set()
        
        # Get target connections
        if org_id and org_id in self.org_connections:
            targets = self.org_connections[org_id]
        elif channel in self.active_connections:
            targets = self.active_connections[channel]
        else:
            return
        
        for connection in targets:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"[WS] Error sending message: {e}")
                disconnected.add(connection)
        
        # Clean up disconnected connections
        for conn in disconnected:
            self.disconnect(conn, channel, org_id)


# Global managers
live_manager = ConnectionManager()
corporate_manager = ConnectionManager()
regulator_manager = ConnectionManager()

# SLA metrics storage (sliding window)
sla_metrics: Dict[str, Dict[str, Any]] = {}  # org_id -> metrics
message_history: Dict[str, deque] = {}  # org_id -> deque of last 20 messages

# SLA thresholds by plan
SLA_THRESHOLDS = {
    "free": {
        "uptime": 97.0,
        "latency_ms": 1500,
    },
    "pro": {
        "uptime": 99.5,
        "latency_ms": 800,
    },
    "enterprise": {
        "uptime": 99.9,
        "latency_ms": 500,
    },
}


def calculate_sla_metrics(org_id: str, plan: str = "free") -> Dict[str, Any]:
    """Calculate real-time SLA metrics"""
    threshold = SLA_THRESHOLDS.get(plan, SLA_THRESHOLDS["free"])
    
    if org_id not in message_history or len(message_history[org_id]) == 0:
        return {
            "uptime": 100.0,
            "avg_latency": 0.0,
            "error_rate": 0.0,
            "compliance": "compliant",
        }
    
    messages = list(message_history[org_id])
    total = len(messages)
    
    # Calculate uptime (1-minute sliding window)
    now = datetime.utcnow()
    recent_messages = [m for m in messages if (now - datetime.fromisoformat(m["timestamp"])).total_seconds() < 60]
    recent_total = len(recent_messages)
    recent_failures = sum(1 for m in recent_messages if m.get("fail_safe_triggered", False))
    uptime = ((recent_total - recent_failures) / recent_total * 100) if recent_total > 0 else 100.0
    
    # Calculate average latency (last 20 messages)
    latencies = [m.get("latency_ms", 0) for m in messages[-20:]]
    avg_latency = sum(latencies) / len(latencies) if latencies else 0.0
    
    # Calculate error rate
    failures = sum(1 for m in messages if m.get("fail_safe_triggered", False))
    error_rate = (failures / total * 100) if total > 0 else 0.0
    
    # Determine compliance
    if uptime >= threshold["uptime"] and avg_latency <= threshold["latency_ms"]:
        compliance = "compliant"
    elif uptime >= threshold["uptime"] * 0.9 or avg_latency <= threshold["latency_ms"] * 1.2:
        compliance = "partial"
    else:
        compliance = "violation"
    
    metrics = {
        "uptime": round(uptime, 2),
        "avg_latency": round(avg_latency, 2),
        "error_rate": round(error_rate, 2),
        "compliance": compliance,
        "threshold": threshold,
    }
    
    # Evaluate alerts based on metrics (async task)
    try:
        from backend.services.alerting_service import evaluate_alerts_for_org
        import asyncio
        # Run alert evaluation asynchronously (fire and forget)
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(evaluate_alerts_for_org(org_id, metrics, plan))
            else:
                loop.run_until_complete(evaluate_alerts_for_org(org_id, metrics, plan))
        except RuntimeError:
            # No event loop, create new one
            asyncio.run(evaluate_alerts_for_org(org_id, metrics, plan))
    except Exception as e:
        logger.error(f"[Alerting] Error evaluating alerts: {e}")
    
    return metrics


def publish_telemetry_message(
    org_id: str,
    content_id: str,
    risk_score: int,
    flags: List[Dict[str, Any]],
    latency_ms: float,
    token_usage: Dict[str, int],
    provider: str,
    fail_safe_triggered: bool = False,
    fail_reason: Optional[str] = None,
):
    """Publish telemetry message to all relevant channels"""
    message = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.utcnow().isoformat(),
        "org_id": org_id,
        "content_id": content_id,
        "risk_score": risk_score,
        "flags": flags,
        "latency_ms": latency_ms,
        "token_usage": token_usage,
        "provider": provider,
        "fail_safe_triggered": fail_safe_triggered,
        "fail_reason": fail_reason,
    }
    
    # Store in history (sliding window of 20)
    if org_id not in message_history:
        message_history[org_id] = deque(maxlen=20)
    message_history[org_id].append(message)
    
    # Broadcast to /ws/live (all connections)
    import asyncio
    asyncio.create_task(live_manager.broadcast("live", message))
    
    # Broadcast to /ws/corporate (org-specific)
    asyncio.create_task(corporate_manager.broadcast("corporate", message, org_id))
    
    # Broadcast to /ws/regulator (only if high risk)
    if fail_safe_triggered or risk_score >= 70:
        asyncio.create_task(regulator_manager.broadcast("regulator", message))
    
    # Update SLA metrics
    # Get plan from org_billing (would need to import, but for now use default)
    plan = "free"  # TODO: Get from org_billing
    sla_metrics[org_id] = calculate_sla_metrics(org_id, plan)
    
    # Evaluate alerts if fail-safe triggered
    if fail_safe_triggered:
        from backend.services.alerting_service import create_alert_event
        import asyncio
        try:
            asyncio.create_task(create_alert_event(
                org_id=org_id,
                alert_type="FAIL_SAFE",
                severity="critical",
                message=f"Fail-safe triggered: {fail_reason or 'High risk content detected'}",
                details={
                    "org_id": org_id,
                    "content_id": content_id,
                    "risk_score": risk_score,
                    "fail_reason": fail_reason,
                    "provider": provider,
                    "suggested_action": "Review content",
                }
            ))
        except Exception as e:
            logger.error(f"[Alerting] Error creating fail-safe alert: {e}")
    
    logger.info(f"[Telemetry] Published message for org {org_id}, risk: {risk_score}, fail_safe: {fail_safe_triggered}")


async def get_current_user_from_ws(websocket: WebSocket) -> Dict[str, Any]:
    """Extract user info from WebSocket query params or headers"""
    # In production, verify JWT from query params or headers
    # For now, return dummy user
    org_id = websocket.query_params.get("org_id")
    user_role = websocket.query_params.get("role", "admin")
    
    return {
        "org_id": org_id,
        "role": user_role,
    }


# WebSocket router
from fastapi.routing import APIRouter
router = APIRouter()

@router.websocket("/live")
async def websocket_live(websocket: WebSocket):
    """WebSocket endpoint for live telemetry (all connections)"""
    await live_manager.connect(websocket, "live")
    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
            # Echo back or handle ping/pong
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        live_manager.disconnect(websocket, "live")
    except Exception as e:
        logger.error(f"[WS] Live connection error: {e}")
        live_manager.disconnect(websocket, "live")


@router.websocket("/corporate")
async def websocket_corporate(websocket: WebSocket):
    """WebSocket endpoint for corporate telemetry (org-specific)"""
    user = await get_current_user_from_ws(websocket)
    org_id = user.get("org_id")
    
    if not org_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="org_id required")
        return
    
    await corporate_manager.connect(websocket, "corporate", org_id)
    
    try:
        # Send initial SLA metrics
        if org_id in sla_metrics:
            await websocket.send_json({
                "type": "sla_metrics",
                "data": sla_metrics[org_id],
            })
        
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        corporate_manager.disconnect(websocket, "corporate", org_id)
    except Exception as e:
        logger.error(f"[WS] Corporate connection error: {e}")
        corporate_manager.disconnect(websocket, "corporate", org_id)


@router.websocket("/regulator")
async def websocket_regulator(websocket: WebSocket):
    """WebSocket endpoint for regulator telemetry (high-risk only)"""
    user = await get_current_user_from_ws(websocket)
    user_role = user.get("role")
    
    # Only regulator role can access
    if user_role != "regulator":
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Regulator access only")
        return
    
    await regulator_manager.connect(websocket, "regulator")
    
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        regulator_manager.disconnect(websocket, "regulator")
    except Exception as e:
        logger.error(f"[WS] Regulator connection error: {e}")
        regulator_manager.disconnect(websocket, "regulator")

