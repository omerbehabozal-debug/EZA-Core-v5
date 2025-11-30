# -*- coding: utf-8 -*-
"""
Monitor WebSocket Router
Real-time telemetry feed via WebSocket
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Literal
import logging
import asyncio

from backend.telemetry.realtime import telemetry_hub

logger = logging.getLogger(__name__)

router = APIRouter()


async def websocket_endpoint(websocket: WebSocket, channel: Literal["live", "corporate", "regulator"]):
    """
    WebSocket endpoint handler
    
    Args:
        websocket: WebSocket connection
        channel: Channel name
    """
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
async def websocket_live(websocket: WebSocket):
    """
    WebSocket endpoint for live telemetry feed
    
    Broadcasts all telemetry events (standalone, proxy, proxy-lite)
    
    TODO: Add JWT authentication
    """
    await websocket_endpoint(websocket, "live")


@router.websocket("/corporate")
async def websocket_corporate(websocket: WebSocket):
    """
    WebSocket endpoint for corporate telemetry feed
    
    Broadcasts all telemetry events for corporate panel monitoring
    
    TODO: Add JWT authentication and corporate user verification
    """
    await websocket_endpoint(websocket, "corporate")


@router.websocket("/regulator")
async def websocket_regulator(websocket: WebSocket):
    """
    WebSocket endpoint for regulator telemetry feed
    
    Broadcasts only events with:
    - Policy violations, OR
    - High/medium risk level, AND
    - Mode is standalone or proxy (excludes proxy-lite)
    
    TODO: Add JWT authentication and regulator user verification
    """
    await websocket_endpoint(websocket, "regulator")

