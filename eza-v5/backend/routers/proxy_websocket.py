# -*- coding: utf-8 -*-
"""
EZA Proxy - WebSocket Endpoints
Real-time telemetry, regulator feed, and fail-safe logs
"""

import json
import asyncio
import logging
from datetime import datetime
from typing import Dict, Set, Any
from fastapi import WebSocket, WebSocketDisconnect, Depends
from fastapi.routing import APIRouter

from backend.auth.proxy_auth import require_proxy_auth

router = APIRouter()
logger = logging.getLogger(__name__)

# Connection managers
class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"[WebSocket] Client connected. Total: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"[WebSocket] Client disconnected. Total: {len(self.active_connections)}")
    
    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        disconnected = set()
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"[WebSocket] Broadcast error: {str(e)}")
                disconnected.add(connection)
        
        # Remove disconnected clients
        for conn in disconnected:
            self.disconnect(conn)

# Global connection managers
telemetry_manager = ConnectionManager()
regulator_manager = ConnectionManager()
logs_manager = ConnectionManager()

# Global state for telemetry
telemetry_state = {
    "pipeline_delay_ms": 0,
    "llm_provider_success_rate": 100.0,
    "risk_flag_distribution": {},
    "last_policy_triggered": None,
    "fail_safe_state": False,
}

# Background task for telemetry updates
async def telemetry_broadcaster():
    """Continuously broadcast telemetry updates"""
    while True:
        try:
            await telemetry_manager.broadcast({
                "type": "telemetry",
                "timestamp": datetime.utcnow().isoformat(),
                "data": telemetry_state
            })
            await asyncio.sleep(2)  # Update every 2 seconds
        except Exception as e:
            logger.error(f"[WebSocket] Telemetry broadcaster error: {str(e)}")
            await asyncio.sleep(5)

# Start broadcaster on module load
_telemetry_task = None

def start_telemetry_broadcaster():
    global _telemetry_task
    if _telemetry_task is None:
        _telemetry_task = asyncio.create_task(telemetry_broadcaster())

@router.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    """
    WebSocket endpoint for real-time telemetry
    Broadcasts: pipeline_delay_ms, llm_provider_success_rate, risk_flag_distribution, etc.
    """
    await telemetry_manager.connect(websocket)
    start_telemetry_broadcaster()
    
    try:
        while True:
            # Keep connection alive, client can send ping
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        telemetry_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"[WebSocket] Telemetry error: {str(e)}")
        telemetry_manager.disconnect(websocket)

@router.websocket("/ws/regulator")
async def websocket_regulator(websocket: WebSocket):
    """
    WebSocket endpoint for regulator feed
    Broadcasts anonymized risk scores and compliance data
    """
    await regulator_manager.connect(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        regulator_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"[WebSocket] Regulator error: {str(e)}")
        regulator_manager.disconnect(websocket)

@router.websocket("/ws/logs")
async def websocket_logs(websocket: WebSocket):
    """
    WebSocket endpoint for fail-safe violation logs
    Real-time alerts for critical issues
    """
    await logs_manager.connect(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        logs_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"[WebSocket] Logs error: {str(e)}")
        logs_manager.disconnect(websocket)

# Helper function to broadcast regulator data
async def broadcast_regulator_data(data: dict):
    """Broadcast anonymized data to regulator channel"""
    await regulator_manager.broadcast({
        "type": "regulator_data",
        "timestamp": datetime.utcnow().isoformat(),
        "data": data
    })

# Helper function to broadcast fail-safe alerts
async def broadcast_failsafe_alert(alert: dict):
    """Broadcast fail-safe alert to logs channel"""
    await logs_manager.broadcast({
        "type": "failsafe_alert",
        "timestamp": datetime.utcnow().isoformat(),
        "alert": alert
    })

# Helper function to update telemetry state
def update_telemetry_state(**kwargs):
    """Update global telemetry state"""
    telemetry_state.update(kwargs)

