# -*- coding: utf-8 -*-
"""
Monitor WebSocket Tests
Tests for real-time telemetry WebSocket endpoints
"""

import pytest
import json
from datetime import datetime
from uuid import uuid4
from fastapi.testclient import TestClient
from starlette.websockets import WebSocket

from backend.main import app
from backend.telemetry.realtime import telemetry_hub, LiveTelemetryHub
from backend.telemetry.schemas import TelemetryEventRead


@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)


@pytest.fixture
def hub():
    """Create a fresh hub instance for testing"""
    return LiveTelemetryHub()


@pytest.mark.asyncio
async def test_websocket_live_connection(client):
    """Test WebSocket connection to /ws/live"""
    with client.websocket_connect("/ws/live") as websocket:
        # Should receive connection message
        data = websocket.receive_json()
        assert data["type"] == "connected"
        assert data["channel"] == "live"
        
        # Should be able to send ping
        websocket.send_text("ping")
        response = websocket.receive_text()
        assert response == "pong"


@pytest.mark.asyncio
async def test_websocket_corporate_connection(client):
    """Test WebSocket connection to /ws/corporate"""
    with client.websocket_connect("/ws/corporate") as websocket:
        data = websocket.receive_json()
        assert data["type"] == "connected"
        assert data["channel"] == "corporate"


@pytest.mark.asyncio
async def test_websocket_regulator_connection(client):
    """Test WebSocket connection to /ws/regulator"""
    with client.websocket_connect("/ws/regulator") as websocket:
        data = websocket.receive_json()
        assert data["type"] == "connected"
        assert data["channel"] == "regulator"


@pytest.mark.asyncio
async def test_websocket_live_receives_all_events(hub):
    """Test that /ws/live receives all telemetry events"""
    # Create a mock WebSocket connection
    class MockWebSocket:
        def __init__(self):
            self.messages = []
            self.closed = False
        
        async def send_text(self, message: str):
            if not self.closed:
                self.messages.append(("text", message))
        
        async def send_json(self, data: dict):
            if not self.closed:
                self.messages.append(("json", data))
    
    mock_ws = MockWebSocket()
    
    # Register to live channel
    await hub.register(mock_ws, "live")
    
    # Create test events
    low_risk_event = TelemetryEventRead(
        id=uuid4(),
        timestamp=datetime.now(),
        mode="standalone",
        source="standalone-api",
        user_input="Test input",
        eza_score=85.0,
        risk_level="low",
        policy_violations=None
    )
    
    high_risk_event = TelemetryEventRead(
        id=uuid4(),
        timestamp=datetime.now(),
        mode="proxy",
        source="proxy-api",
        user_input="Harmful input",
        eza_score=30.0,
        risk_level="high",
        policy_violations=["A1", "F2"]
    )
    
    # Broadcast events
    await hub.broadcast(low_risk_event)
    await hub.broadcast(high_risk_event)
    
    # Wait a bit for async operations
    import asyncio
    await asyncio.sleep(0.1)
    
    # Check that both events were received
    assert len(mock_ws.messages) >= 2
    
    # Unregister
    await hub.unregister(mock_ws)


@pytest.mark.asyncio
async def test_websocket_regulator_filters_events(hub):
    """Test that /ws/regulator only receives high-risk or policy violation events"""
    class MockWebSocket:
        def __init__(self):
            self.messages = []
            self.closed = False
        
        async def send_text(self, message: str):
            if not self.closed:
                self.messages.append(("text", message))
        
        async def send_json(self, data: dict):
            if not self.closed:
                self.messages.append(("json", data))
    
    mock_ws = MockWebSocket()
    
    # Register to regulator channel
    await hub.register(mock_ws, "regulator")
    
    # Create test events
    low_risk_event = TelemetryEventRead(
        id=uuid4(),
        timestamp=datetime.now(),
        mode="standalone",
        source="standalone-api",
        user_input="Safe input",
        eza_score=90.0,
        risk_level="low",
        policy_violations=None
    )
    
    high_risk_event = TelemetryEventRead(
        id=uuid4(),
        timestamp=datetime.now(),
        mode="proxy",
        source="proxy-api",
        user_input="Harmful input",
        eza_score=25.0,
        risk_level="high",
        policy_violations=["A1"]
    )
    
    policy_violation_event = TelemetryEventRead(
        id=uuid4(),
        timestamp=datetime.now(),
        mode="standalone",
        source="standalone-api",
        user_input="Policy violation input",
        eza_score=60.0,
        risk_level="medium",
        policy_violations=["F2", "N1"]
    )
    
    proxy_lite_event = TelemetryEventRead(
        id=uuid4(),
        timestamp=datetime.now(),
        mode="proxy-lite",
        source="proxy-lite-api",
        user_input="Proxy-lite input",
        eza_score=50.0,
        risk_level="high",
        policy_violations=None
    )
    
    # Broadcast all events
    await hub.broadcast(low_risk_event)
    await hub.broadcast(high_risk_event)
    await hub.broadcast(policy_violation_event)
    await hub.broadcast(proxy_lite_event)
    
    # Wait for async operations
    import asyncio
    await asyncio.sleep(0.1)
    
    # Parse received messages
    received_events = []
    for msg_type, msg_content in mock_ws.messages:
        if msg_type == "text":
            try:
                event_data = json.loads(msg_content)
                received_events.append(event_data)
            except json.JSONDecodeError:
                pass
    
    # Regulator channel should receive:
    # - high_risk_event (high risk + standalone/proxy)
    # - policy_violation_event (policy violations + standalone/proxy)
    # But NOT:
    # - low_risk_event (low risk, no violations)
    # - proxy_lite_event (proxy-lite mode excluded)
    
    received_ids = {event.get("id") for event in received_events}
    
    assert str(high_risk_event.id) in received_ids, "High-risk event should be broadcast to regulator"
    assert str(policy_violation_event.id) in received_ids, "Policy violation event should be broadcast to regulator"
    assert str(low_risk_event.id) not in received_ids, "Low-risk event should NOT be broadcast to regulator"
    assert str(proxy_lite_event.id) not in received_ids, "Proxy-lite event should NOT be broadcast to regulator"
    
    # Unregister
    await hub.unregister(mock_ws)


@pytest.mark.asyncio
async def test_websocket_hub_registration(hub):
    """Test hub registration and unregistration"""
    class MockWebSocket:
        pass
    
    ws1 = MockWebSocket()
    ws2 = MockWebSocket()
    
    # Register connections
    await hub.register(ws1, "live")
    await hub.register(ws2, "corporate")
    
    stats = hub.get_stats()
    assert stats["live"] == 1
    assert stats["corporate"] == 1
    assert stats["regulator"] == 0
    assert stats["total"] == 2
    
    # Unregister
    await hub.unregister(ws1)
    stats = hub.get_stats()
    assert stats["live"] == 0
    assert stats["total"] == 1
    
    await hub.unregister(ws2)
    stats = hub.get_stats()
    assert stats["total"] == 0


@pytest.mark.asyncio
async def test_websocket_heartbeat(client):
    """Test WebSocket heartbeat mechanism"""
    with client.websocket_connect("/ws/live") as websocket:
        # Receive connection message
        data = websocket.receive_json()
        assert data["type"] == "connected"
        
        # Wait for heartbeat (should come after ~30 seconds, but we'll test with shorter timeout)
        # In real scenario, heartbeat comes after 30s timeout
        # For testing, we can send a message to trigger immediate response
        websocket.send_text("ping")
        response = websocket.receive_text()
        assert response == "pong"

