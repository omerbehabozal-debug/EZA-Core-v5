# -*- coding: utf-8 -*-
"""EZA Observation Architecture — experience event backbone tests."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.core.observation.experience_event_privacy import validate_experience_payload
from backend.core.observation.experience_event_service import ingest_experience_event
from backend.core.observation.log_experience_event import hash_guest_token
from backend.core.observation.normalize_experience_event import (
    ALLOWED_EXPERIENCE_EVENT_TYPES,
    resolve_universal_event_type,
)
from backend.core.events.event_logger import log_eza_event


def test_universal_mapping_classifies_without_decision():
    assert resolve_universal_event_type("mirror_created") == "content_generated"
    assert resolve_universal_event_type("mirror_shared") == "content_shared"
    assert resolve_universal_event_type("landing_viewed") == "content_engaged"
    assert resolve_universal_event_type("guest_conversation_started") == "session_started_from_content"
    assert resolve_universal_event_type("branch_opened") == "session_branched"
    assert resolve_universal_event_type("second_user_message_sent") == "session_continued"
    assert resolve_universal_event_type("unknown_event") is None


def test_privacy_rejects_raw_text_payload():
    ok, reason, _, _ = validate_experience_payload(
        {"rawMessage": "hello world"},
        None,
    )
    assert ok is False
    assert reason == "privacy_rejected"


def test_privacy_rejects_private_mirror_payload():
    ok, reason, _, _ = validate_experience_payload(
        {"mirrorBody": "secret mirror content"},
        None,
    )
    assert ok is False
    assert reason == "privacy_rejected"


def test_privacy_allows_safe_context():
    ok, reason, ctx, metrics = validate_experience_payload(
        {"surface": "mirror", "topic": "travel"},
        {"messageCount": 3},
    )
    assert ok is True
    assert reason is None
    assert ctx == {"surface": "mirror", "topic": "travel"}
    assert metrics == {"messageCount": 3}


def test_guest_token_is_hashed_not_stored_plain():
    token = "guest-token-abcdefghijklmnop"
    hashed = hash_guest_token(token)
    assert hashed != token
    assert len(hashed) == 64


@pytest.mark.asyncio
async def test_ingest_disabled_is_noop():
    db = AsyncMock()
    with patch("backend.core.observation.experience_event_service.get_settings") as mock_gs:
        mock_gs.return_value = MagicMock(EXPERIENCE_EVENT_LOGGING_ENABLED=False)
        result = await ingest_experience_event(
            db,
            {"productId": "saina", "eventType": "mirror_created"},
        )
    assert result == {"ok": False, "reason": "disabled"}
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_ingest_rejects_invalid_event_type():
    db = AsyncMock()
    with patch("backend.core.observation.experience_event_service.get_settings") as mock_gs:
        mock_gs.return_value = MagicMock(EXPERIENCE_EVENT_LOGGING_ENABLED=True)
        result = await ingest_experience_event(
            db,
            {"productId": "saina", "eventType": "not_allowed_event"},
        )
    assert result == {"ok": False, "reason": "invalid_event_type"}


@pytest.mark.asyncio
async def test_ingest_persists_experience_event_not_governance():
    db = AsyncMock()
    db.commit = AsyncMock()

    payload = {
        "productId": "saina",
        "eventType": "mirror_birth_suggested",
        "sessionId": "sess-1",
        "conversationId": "chat-1",
        "context": {"surface": "conversation"},
        "metrics": {"userMessageCount": 2},
    }

    with patch("backend.core.observation.experience_event_service.get_settings") as mock_gs:
        mock_gs.return_value = MagicMock(
            EXPERIENCE_EVENT_LOGGING_ENABLED=True,
            EXPERIENCE_EVENT_RETENTION_DAYS=30,
            EZA_ENV="dev",
            ENV="dev",
        )
        with patch(
            "backend.core.observation.experience_event_service.log_experience_event",
            new_callable=AsyncMock,
            return_value="evt-123",
        ) as mock_log:
            result = await ingest_experience_event(db, payload)

    assert result == {"ok": True}
    mock_log.assert_awaited_once()
    logged = mock_log.await_args.args[1]
    assert logged["product_id"] == "saina"
    assert logged["event_type"] == "mirror_birth_suggested"
    assert logged["universal_event_type"] == "prompt_surfaced"
    assert logged["conversation_id"] == "chat-1"


@pytest.mark.asyncio
async def test_ingest_hashes_guest_token_in_normalized_event():
    db = AsyncMock()

    with patch("backend.core.observation.experience_event_service.get_settings") as mock_gs:
        mock_gs.return_value = MagicMock(
            EXPERIENCE_EVENT_LOGGING_ENABLED=True,
            EXPERIENCE_EVENT_RETENTION_DAYS=30,
            EZA_ENV="dev",
            ENV="dev",
        )
        with patch(
            "backend.core.observation.experience_event_service.log_experience_event",
            new_callable=AsyncMock,
            return_value="evt-guest",
        ) as mock_log:
            await ingest_experience_event(
                db,
                {
                    "productId": "saina",
                    "eventType": "guest_conversation_started",
                    "guestToken": "plain-guest-token",
                    "mirrorId": "slug-1",
                },
            )

    logged = mock_log.await_args.args[1]
    assert logged["guest_token_hash"] == hash_guest_token("plain-guest-token")
    assert "plain-guest-token" not in str(logged)


@pytest.mark.asyncio
async def test_log_eza_event_not_called_by_experience_ingest():
    """Governance logger remains separate from observation ingest."""
    db = AsyncMock()
    with patch("backend.core.events.event_logger.log_eza_event", new_callable=AsyncMock) as mock_gov:
        with patch("backend.core.observation.experience_event_service.get_settings") as mock_gs:
            mock_gs.return_value = MagicMock(
                EXPERIENCE_EVENT_LOGGING_ENABLED=True,
                EXPERIENCE_EVENT_RETENTION_DAYS=30,
                EZA_ENV="dev",
                ENV="dev",
            )
            with patch(
                "backend.core.observation.experience_event_service.log_experience_event",
                new_callable=AsyncMock,
                return_value="evt-1",
            ):
                await ingest_experience_event(
                    db,
                    {"productId": "saina", "eventType": "branch_opened", "conversationId": "c1"},
                )
    mock_gov.assert_not_awaited()


def test_allowed_event_types_cover_sprint_allowlist():
    expected = {
        "mirror_birth_suggested",
        "mirror_birth_accepted",
        "mirror_created",
        "mirror_share_opened",
        "mirror_shared",
        "landing_viewed",
        "landing_cta_clicked",
        "guest_conversation_started",
        "second_user_message_sent",
        "branch_suggestion_shown",
        "branch_opened",
        "guest_tree_claimed",
        "relationship_pattern_viewed",
    }
    assert expected.issubset(ALLOWED_EXPERIENCE_EVENT_TYPES)


def test_post_experience_events_endpoint_disabled():
    from backend.main import app

    with patch("backend.api.routers.experience_events_router.ingest_experience_event", new_callable=AsyncMock) as mock_ingest:
        mock_ingest.return_value = {"ok": False, "reason": "disabled"}
        client = TestClient(app)
        r = client.post(
            "/api/eza/experience-events",
            json={"productId": "saina", "eventType": "mirror_created"},
        )
    assert r.status_code == 200
    assert r.json() == {"ok": False, "reason": "disabled"}


def test_post_experience_events_endpoint_ok():
    from backend.main import app

    with patch("backend.api.routers.experience_events_router.ingest_experience_event", new_callable=AsyncMock) as mock_ingest:
        mock_ingest.return_value = {"ok": True}
        client = TestClient(app)
        r = client.post(
            "/api/eza/experience-events",
            json={
                "productId": "saina",
                "eventType": "landing_viewed",
                "mirrorId": "kyoto-evening",
                "context": {"surface": "landing"},
            },
        )
    assert r.status_code == 200
    assert r.json() == {"ok": True, "reason": None}


@pytest.mark.asyncio
async def test_governance_log_eza_event_still_validates_required_fields():
    """Regression: governance event logger contract unchanged."""
    db = AsyncMock()
    result = await log_eza_event(db, {"event_type": "message"})
    assert result is None
