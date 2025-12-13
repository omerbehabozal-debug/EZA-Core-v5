# -*- coding: utf-8 -*-
"""
Live Telemetry Hub
WebSocket-based real-time telemetry broadcasting
"""

import asyncio
import json
import logging
from typing import Literal, Set, Dict, Any
from datetime import datetime
from uuid import UUID

from fastapi import WebSocket
from backend.telemetry.schemas import TelemetryEventRead

logger = logging.getLogger(__name__)


class LiveTelemetryHub:
    """
    Thread-safe WebSocket hub for broadcasting telemetry events
    
    Channels:
    - "live": All events
    - "corporate": Corporate-relevant events
    - "regulator": Policy violations and high-risk events
    """
    
    def __init__(self):
        # Channel-based WebSocket connections
        self._live_connections: Set[WebSocket] = set()
        self._corporate_connections: Set[WebSocket] = set()
        self._regulator_connections: Set[WebSocket] = set()
        
        # Lock for thread-safe operations
        self._lock = asyncio.Lock()
    
    async def register(self, websocket: WebSocket, channel: Literal["live", "corporate", "regulator"]):
        """
        Register a WebSocket connection to a channel
        
        Args:
            websocket: WebSocket connection
            channel: Channel name ("live", "corporate", or "regulator")
        """
        async with self._lock:
            if channel == "live":
                self._live_connections.add(websocket)
            elif channel == "corporate":
                self._corporate_connections.add(websocket)
            elif channel == "regulator":
                self._regulator_connections.add(websocket)
            
            logger.info(f"WebSocket registered to {channel} channel (total: {self._get_connection_count(channel)})")
    
    async def unregister(self, websocket: WebSocket):
        """
        Unregister a WebSocket connection from all channels
        
        Args:
            websocket: WebSocket connection to remove
        """
        async with self._lock:
            removed = False
            if websocket in self._live_connections:
                self._live_connections.remove(websocket)
                removed = True
            if websocket in self._corporate_connections:
                self._corporate_connections.remove(websocket)
                removed = True
            if websocket in self._regulator_connections:
                self._regulator_connections.remove(websocket)
                removed = True
            
            if removed:
                logger.info(f"WebSocket unregistered from all channels")
    
    def _get_connection_count(self, channel: Literal["live", "corporate", "regulator"]) -> int:
        """Get connection count for a channel"""
        if channel == "live":
            return len(self._live_connections)
        elif channel == "corporate":
            return len(self._corporate_connections)
        elif channel == "regulator":
            return len(self._regulator_connections)
        return 0
    
    def _should_broadcast_to_channel(
        self,
        event: TelemetryEventRead,
        channel: Literal["live", "corporate", "regulator"]
    ) -> bool:
        """
        Determine if an event should be broadcast to a channel
        
        Args:
            event: Telemetry event
            channel: Channel name
        
        Returns:
            True if event should be broadcast to this channel
        """
        if channel == "live":
            # Live channel: broadcast all events
            return True
        
        elif channel == "corporate":
            # Corporate channel: all events (can be filtered later if needed)
            return True
        
        elif channel == "regulator":
            # Regulator channel: only events with policy violations or high/medium risk
            has_policy_violations = event.policy_violations is not None and len(event.policy_violations) > 0
            is_high_risk = event.risk_level in ["high", "medium"]
            is_standalone_or_proxy = event.mode in ["standalone", "proxy"]
            
            return (has_policy_violations or is_high_risk) and is_standalone_or_proxy
        
        return False
    
    async def broadcast(self, event: TelemetryEventRead):
        """
        Broadcast a telemetry event to all relevant channels
        
        Args:
            event: Telemetry event to broadcast
        """
        # Convert event to JSON
        try:
            event_dict = event.model_dump()
            # Convert UUID and datetime to strings for JSON serialization
            if "id" in event_dict and isinstance(event_dict["id"], UUID):
                event_dict["id"] = str(event_dict["id"])
            if "timestamp" in event_dict and isinstance(event_dict["timestamp"], datetime):
                event_dict["timestamp"] = event_dict["timestamp"].isoformat()
            
            event_json = json.dumps(event_dict)
        except Exception as e:
            logger.error(f"Failed to serialize event for broadcast: {str(e)}")
            return
        
        # Broadcast to live channel
        if self._should_broadcast_to_channel(event, "live"):
            await self._broadcast_to_channel(event_json, self._live_connections, "live")
        
        # Broadcast to corporate channel
        if self._should_broadcast_to_channel(event, "corporate"):
            await self._broadcast_to_channel(event_json, self._corporate_connections, "corporate")
        
        # Broadcast to regulator channel
        if self._should_broadcast_to_channel(event, "regulator"):
            await self._broadcast_to_channel(event_json, self._regulator_connections, "regulator")
    
    async def _broadcast_to_channel(
        self,
        message: str,
        connections: Set[WebSocket],
        channel_name: str
    ):
        """
        Broadcast a message to all connections in a channel
        
        Args:
            message: JSON string message
            connections: Set of WebSocket connections
            channel_name: Channel name for logging
        """
        if not connections:
            return
        
        # Create a copy of connections to avoid modification during iteration
        async with self._lock:
            connections_copy = connections.copy()
        
        # Broadcast to all connections
        disconnected = []
        for connection in connections_copy:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.warning(f"Failed to send message to WebSocket in {channel_name} channel: {str(e)}")
                disconnected.append(connection)
        
        # Remove disconnected connections
        if disconnected:
            async with self._lock:
                for conn in disconnected:
                    if conn in connections:
                        connections.remove(conn)
            logger.info(f"Removed {len(disconnected)} disconnected WebSocket(s) from {channel_name} channel")
    
    def get_stats(self) -> Dict[str, int]:
        """Get connection statistics"""
        return {
            "live": len(self._live_connections),
            "corporate": len(self._corporate_connections),
            "regulator": len(self._regulator_connections),
            "total": (
                len(self._live_connections) +
                len(self._corporate_connections) +
                len(self._regulator_connections)
            )
        }


# Global hub instance
telemetry_hub = LiveTelemetryHub()

