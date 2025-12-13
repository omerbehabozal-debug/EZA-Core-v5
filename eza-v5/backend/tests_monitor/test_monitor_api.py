# -*- coding: utf-8 -*-
"""
Monitor API Tests
Tests for live telemetry feed endpoints
"""

import pytest
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import uuid4

from backend.telemetry.models import TelemetryEvent
from backend.telemetry.repository import create_event, get_latest_events, get_events_for_regulator
from backend.telemetry.schemas import TelemetryEventCreate
from backend.telemetry.service import record_telemetry_event
from backend.core.utils.dependencies import AsyncSessionLocal


@pytest.fixture
async def db_session():
    """Create a test database session"""
    async with AsyncSessionLocal() as session:
        yield session
        await session.rollback()


@pytest.mark.asyncio
async def test_live_feed_returns_events(db_session):
    """Test that live feed endpoint returns events"""
    # Create a test telemetry event
    event_data = TelemetryEventCreate(
        mode="standalone",
        source="standalone-api",
        user_input="Test input",
        safe_answer="Test answer",
        eza_score=75.0,
        risk_level="low",
        policy_violations=None,
        model_votes=None,
        meta=None
    )
    
    created_event = await create_event(db_session, event_data)
    assert created_event.id is not None
    
    # Get events
    events = await get_latest_events(db_session, limit=10)
    assert len(events) > 0
    
    # Check that our event is in the list
    event_ids = [e.id for e in events]
    assert created_event.id in event_ids


@pytest.mark.asyncio
async def test_live_feed_filters_by_mode(db_session):
    """Test that live feed can filter by mode"""
    # Create events for different modes
    standalone_event = await create_event(
        db_session,
        TelemetryEventCreate(
            mode="standalone",
            source="standalone-api",
            user_input="Standalone test",
            eza_score=80.0,
            risk_level="low"
        )
    )
    
    proxy_event = await create_event(
        db_session,
        TelemetryEventCreate(
            mode="proxy",
            source="proxy-api",
            user_input="Proxy test",
            eza_score=70.0,
            risk_level="medium"
        )
    )
    
    # Get only standalone events
    standalone_events = await get_latest_events(db_session, limit=10, mode="standalone")
    standalone_ids = [e.id for e in standalone_events]
    
    assert standalone_event.id in standalone_ids
    assert proxy_event.id not in standalone_ids


@pytest.mark.asyncio
async def test_regulator_feed_filters_events(db_session):
    """Test that regulator feed filters for relevant events"""
    # Create a low-risk event (should not appear in regulator feed)
    low_risk_event = await create_event(
        db_session,
        TelemetryEventCreate(
            mode="proxy-lite",
            source="proxy-lite-api",
            user_input="Low risk test",
            eza_score=90.0,
            risk_level="low",
            policy_violations=None
        )
    )
    
    # Create a high-risk event with policy violations (should appear)
    high_risk_event = await create_event(
        db_session,
        TelemetryEventCreate(
            mode="standalone",
            source="standalone-api",
            user_input="High risk test",
            eza_score=30.0,
            risk_level="high",
            policy_violations=["A1", "F2"]
        )
    )
    
    # Create a proxy mode event (should appear)
    proxy_event = await create_event(
        db_session,
        TelemetryEventCreate(
            mode="proxy",
            source="proxy-api",
            user_input="Proxy test",
            eza_score=60.0,
            risk_level="medium",
            policy_violations=None
        )
    )
    
    # Get regulator feed
    regulator_events = await get_events_for_regulator(db_session, limit=100)
    regulator_ids = [e.id for e in regulator_events]
    
    # High-risk and proxy events should be in regulator feed
    assert high_risk_event.id in regulator_ids
    assert proxy_event.id in regulator_ids
    
    # Low-risk proxy-lite event should not be in regulator feed
    assert low_risk_event.id not in regulator_ids


@pytest.mark.asyncio
async def test_record_telemetry_called_from_pipeline(db_session):
    """Test that telemetry recording works from pipeline result"""
    # Create a mock pipeline result
    pipeline_result = {
        "ok": True,
        "mode": "standalone",
        "eza_score": 75.0,
        "risk_level": "low",
        "policy_violations": [],
        "data": {
            "safe_answer": "This is a safe answer",
            "input_analysis": {
                "raw_text": "Test user input"
            }
        }
    }
    
    # Record telemetry event
    await record_telemetry_event(
        pipeline_result=pipeline_result,
        mode="standalone",
        source="standalone-api",
        db_session=db_session,
        user_input="Test user input"
    )
    
    # Verify event was created
    events = await get_latest_events(db_session, limit=1)
    assert len(events) > 0
    
    event = events[0]
    assert event.mode == "standalone"
    assert event.source == "standalone-api"
    assert event.user_input == "Test user input"
    assert event.eza_score == 75.0
    assert event.risk_level == "low"


@pytest.mark.asyncio
async def test_telemetry_event_with_meta(db_session):
    """Test telemetry event with metadata (alignment, deep_analysis)"""
    pipeline_result = {
        "ok": True,
        "mode": "proxy",
        "eza_score": 65.0,
        "risk_level": "medium",
        "policy_violations": ["A1"],
        "eza_score_breakdown": {
            "base_score": 70.0,
            "final_score": 65.0,
            "safety_level": "yellow"
        },
        "data": {
            "safe_answer": "Safe answer",
            "input_analysis": {
                "raw_text": "Test input"
            },
            "alignment": {
                "verdict": "aligned",
                "alignment_score": 0.8,
                "label": "Safe"
            },
            "deep_analysis": {
                "deception": {"score": 0.2},
                "legal_risk": {"risk_score": 0.3},
                "psych_pressure": {"score": 0.1}
            },
            "safety_label": "Safe"
        }
    }
    
    await record_telemetry_event(
        pipeline_result=pipeline_result,
        mode="proxy",
        source="proxy-api",
        db_session=db_session,
        user_input="Test input"
    )
    
    # Verify event was created with meta
    events = await get_latest_events(db_session, limit=1)
    assert len(events) > 0
    
    event = events[0]
    assert event.meta is not None
    assert "alignment" in event.meta
    assert "deep_analysis" in event.meta
    assert "score_breakdown" in event.meta
    assert event.meta["alignment"]["verdict"] == "aligned"
    assert event.meta["deep_analysis"]["deception_score"] == 0.2

