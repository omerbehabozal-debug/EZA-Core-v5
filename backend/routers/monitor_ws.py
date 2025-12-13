# -*- coding: utf-8 -*-
"""
Monitor WebSocket Router
Real-time telemetry feed via WebSocket
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Literal, Optional
import logging
import asyncio

from backend.telemetry.realtime import telemetry_hub
from backend.auth.jwt import get_user_from_token
from backend.security.rate_limit import rate_limit

logger = logging.getLogger(__name__)

router = APIRouter()


async def websocket_endpoint(
    websocket: WebSocket,
    channel: Literal["live", "corporate", "regulator"],
    token: Optional[str] = Query(None),
    required_roles: list[str] = None
):
    """
    WebSocket endpoint handler with authentication
    
    Args:
        websocket: WebSocket connection
        channel: Channel name
        token: JWT token from query parameter
        required_roles: List of allowed roles for this channel
    """
    # Authenticate before accepting connection
    if required_roles:
        if not token:
            await websocket.close(code=4401, reason="unauthorized: token required")
            return
        
        user_info = get_user_from_token(token)
        if user_info is None:
            await websocket.close(code=4401, reason="unauthorized: invalid token")
            return
        
        user_role = user_info.get("role")
        if user_role not in required_roles:
            await websocket.close(code=4401, reason=f"unauthorized: role {user_role} not allowed")
            return
        
        logger.info(f"WebSocket authenticated: user {user_info.get('user_id')} with role {user_role}")
    
    await websocket.accept()
    
    # Register connection
    await telemetry_hub.register(websocket, channel)
    
    logger.info(f"WebSocket connected to {channel} channel")
    
    try:
        # Send initial connection message
        await websocket.send_json({
            "type": "connected",
            "channel": channel,
            "message": f"Connected to {channel} telemetry feed"
        })
        
        # Heartbeat/ping-pong loop
        while True:
            try:
                # Wait for ping or any message (with timeout)
                # If client sends ping, respond with pong
                # If no message for 30 seconds, send heartbeat
                try:
                    message = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                    if message == "ping":
                        await websocket.send_text("pong")
                except asyncio.TimeoutError:
                    # Send heartbeat to keep connection alive
                    await websocket.send_json({
                        "type": "heartbeat",
                        "timestamp": asyncio.get_event_loop().time()
                    })
            
            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected from {channel} channel")
                break
            except Exception as e:
                logger.error(f"WebSocket error in {channel} channel: {str(e)}")
                break
    
    finally:
        # Unregister connection
        await telemetry_hub.unregister(websocket)
        logger.info(f"WebSocket unregistered from {channel} channel")


@router.websocket("/live")
async def websocket_live(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """
    WebSocket endpoint for live telemetry feed
    
    Broadcasts all telemetry events (standalone, proxy, proxy-lite)
    
    Requires: admin role
    """
    # Rate limiting (check before authentication)
    # Extract IP from WebSocket connection
    client_ip = "unknown"
    if hasattr(websocket, 'client') and websocket.client:
        client_ip = websocket.client.host
    
    # Use direct rate limit check with mock request
    from fastapi import Request
    
    class MockRequest:
        def __init__(self, ip: str):
            self.headers = {}
            self.client = type('obj', (object,), {'host': ip})()
    
    try:
        await rate_limit(MockRequest(client_ip), limit=20, window=120, key_prefix="ws_handshake")
    except Exception as e:
        await websocket.close(code=4401, reason="rate_limit_exceeded")
        return
    
    await websocket_endpoint(websocket, "live", token=token, required_roles=["admin"])


@router.websocket("/corporate")
async def websocket_corporate(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """
    WebSocket endpoint for corporate telemetry feed
    
    Broadcasts all telemetry events for corporate panel monitoring
    
    Requires: corporate or admin role
    """
    # Rate limiting
    client_ip = "unknown"
    if hasattr(websocket, 'client') and websocket.client:
        client_ip = websocket.client.host
    
    from backend.security.rate_limit import rate_limit
    from fastapi import Request
    
    class MockRequest:
        def __init__(self, ip: str):
            self.headers = {}
            self.client = type('obj', (object,), {'host': ip})()
    
    try:
        await rate_limit(MockRequest(client_ip), limit=20, window=120, key_prefix="ws_handshake")
    except Exception as e:
        await websocket.close(code=4401, reason="rate_limit_exceeded")
        return
    
    await websocket_endpoint(websocket, "corporate", token=token, required_roles=["corporate", "admin"])


@router.websocket("/regulator")
async def websocket_regulator(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """
    WebSocket endpoint for regulator telemetry feed
    
    Broadcasts only events with:
    - Policy violations, OR
    - High/medium risk level, AND
    - Mode is standalone or proxy (excludes proxy-lite)
    
    Requires: regulator or admin role
    """
    # Rate limiting
    client_ip = "unknown"
    if hasattr(websocket, 'client') and websocket.client:
        client_ip = websocket.client.host
    
    from backend.security.rate_limit import rate_limit
    from fastapi import Request
    
    class MockRequest:
        def __init__(self, ip: str):
            self.headers = {}
            self.client = type('obj', (object,), {'host': ip})()
    
    try:
        await rate_limit(MockRequest(client_ip), limit=20, window=120, key_prefix="ws_handshake")
    except Exception as e:
        await websocket.close(code=4401, reason="rate_limit_exceeded")
        return
    
    await websocket_endpoint(websocket, "regulator", token=token, required_roles=["regulator", "admin"])

