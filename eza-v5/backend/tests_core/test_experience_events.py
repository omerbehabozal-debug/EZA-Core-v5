# -*- coding: utf-8 -*-
"""EZA Observation Architecture — experience event backbone + hardening tests."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.core.observation.experience_event_auth import (
    payload_has_forbidden_client_ids,
    resolve_trusted_actor,
)
from backend.core.observation.experience_event_privacy import (
    build_privacy_json,
    contains_pii_value,
    scan_string_fields,
    validate_experience_payload,
)
from backend.core.observation.experience_event_service import ingest_experience_event
from backend.core.observation.log_experience_event import hash_guest_token
from backend.core.observation.normalize_experience_event import (
    ALLOWED_EXPERIENCE_EVENT_TYPES,
    resolve_universal_event_type,
)
from backend.core.observation.purge_experience_events import purge_expired_experience_events
from backend.core.events.event_logger import log_eza_event
from backend.security.rate_limit import RateLimitError, get_trusted_client_ip


def _enabled_settings():
    return MagicMock(
        EXPERIENCE_EVENT_LOGGING_ENABLED=True,
        EXPERIENCE_EVENT_RETENTION_DAYS=30,
        EXPERIENCE_EVENT_MAX_BODY_BYTES=4096,
        EXPERIENCE_EVENT_MAX_STRING_LEN=128,
        EXPERIENCE_EVENT_MAX_CONTEXT_KEYS=12,
        EXPERIENCE_EVENT_MAX_METRICS_KEYS=12,
        EXPERIENCE_EVENT_MAX_NESTING_DEPTH=2,
        TRUSTED_PROXY_HEADERS_ENABLED=False,
        EZA_ENV="dev",
        ENV="dev",
    )


def _base_payload(**overrides):
    payload = {
        "productId": "saina",
        "eventType": "mirror_birth_suggested",
        "sessionId": "sess-test-12345678",
        "conversationId": "chat-1",
        "context": {"surface": "conversation"},
        "metrics": {"userMessageCount": 2},
    }
    payload.update(overrides)
    return payload


def test_universal_mapping_classifies_without_decision():
    assert resolve_universal_event_type("mirror_created") == "content_generated"
    assert resolve_universal_event_type("unknown_event") is None


def test_privacy_rejects_forbidden_key():
    ok, reason, _, _, _ = validate_experience_payload({"rawMessage": "hello"}, None)
    assert ok is False
    assert reason == "privacy_rejected"


def test_privacy_rejects_email_value_in_category():
    ok, reason, _, _, _ = validate_experience_payload(
        {"surface": "landing", "category": "mail@example.com"},
        None,
    )
    assert ok is False
    assert reason == "privacy_rejected"


def test_privacy_rejects_phone_value_in_identifier():
    ok, reason = scan_string_fields({"mirror_id": "+90 532 123 45 67"})
    assert ok is False
    assert reason == "privacy_rejected"


def test_privacy_rejects_short_address_like_value():
    assert contains_pii_value("Ataturk Mah. No 5") is True
    ok, reason = scan_string_fields({"mirror_id": "Ataturk Mah. No 5"})
    assert ok is False
    assert reason == "privacy_rejected"


def test_privacy_allows_safe_context():
    ok, reason, ctx, metrics, privacy = validate_experience_payload(
        {"surface": "mirror", "category": "travel"},
        {"messageCount": 3},
    )
    assert ok is True
    assert ctx == {"surface": "mirror", "category": "travel"}
    assert metrics == {"messageCount": 3}
    assert privacy["piiScanPassed"] is True
    assert privacy["piiIncluded"] is False


def test_privacy_json_reflects_scan_result():
    passed = build_privacy_json(pii_scan_passed=True)
    failed = build_privacy_json(pii_scan_passed=False)
    assert passed["piiScanPassed"] is True
    assert passed["piiIncluded"] is False
    assert failed["piiScanPassed"] is False
    assert failed["piiIncluded"] is True


def test_payload_forbidden_client_ids():
    assert payload_has_forbidden_client_ids({"userId": "x"}) is True
    assert payload_has_forbidden_client_ids({"tenantId": "x"}) is True
    assert payload_has_forbidden_client_ids(_base_payload()) is False


def test_guest_token_without_valid_session_rejected():
    actor = resolve_trusted_actor(
        auth_user=None,
        guest_token="guest-only-token",
        session_id=None,
    )
    assert actor["ok"] is False
    assert actor["reason"] == "unauthorized"


def test_anonymous_requires_valid_session():
    actor = resolve_trusted_actor(
        auth_user=None,
        guest_token=None,
        session_id=None,
    )
    assert actor["ok"] is False

    actor_ok = resolve_trusted_actor(
        auth_user=None,
        guest_token=None,
        session_id="sess-test-12345678",
    )
    assert actor_ok["ok"] is True


def test_trusted_user_from_auth_without_session():
    actor = resolve_trusted_actor(
        auth_user={"user_id": "server-user-1"},
        guest_token=None,
        session_id=None,
    )
    assert actor["ok"] is True
    assert actor["user_id"] == "server-user-1"


def test_trusted_client_ip_ignores_spoofed_xff_by_default():
    request = MagicMock()
    request.headers = {"X-Forwarded-For": "1.2.3.4"}
    request.client = MagicMock(host="10.0.0.5")
    with patch("backend.security.rate_limit.get_settings") as mock_gs:
        mock_gs.return_value = MagicMock(TRUSTED_PROXY_HEADERS_ENABLED=False)
        assert get_trusted_client_ip(request) == "10.0.0.5"


@pytest.mark.asyncio
async def test_ingest_disabled_is_noop():
    db = AsyncMock()
    with patch("backend.core.observation.experience_event_service.get_settings") as mock_gs:
        mock_gs.return_value = MagicMock(EXPERIENCE_EVENT_LOGGING_ENABLED=False)
        result = await ingest_experience_event(db, _base_payload())
    assert result == {"ok": False, "reason": "disabled"}


@pytest.mark.asyncio
async def test_ingest_rejects_spoofed_user_id_in_payload():
    db = AsyncMock()
    with patch("backend.core.observation.experience_event_service.get_settings") as mock_gs:
        mock_gs.return_value = _enabled_settings()
        result = await ingest_experience_event(
            db,
            _base_payload(userId="spoofed-user"),
        )
    assert result == {"ok": False, "reason": "unauthorized"}


@pytest.mark.asyncio
async def test_ingest_persists_with_server_auth_user():
    db = AsyncMock()
    with patch("backend.core.observation.experience_event_service.get_settings") as mock_gs:
        mock_gs.return_value = _enabled_settings()
        with patch(
            "backend.core.observation.experience_event_service.log_experience_event",
            new_callable=AsyncMock,
            return_value="evt-123",
        ) as mock_log:
            result = await ingest_experience_event(
                db,
                _base_payload(),
                auth_user={"user_id": "real-user"},
            )
    assert result == {"ok": True}
    logged = mock_log.await_args.args[1]
    assert logged["user_id"] == "real-user"
    assert logged["privacy_json"]["piiScanPassed"] is True


@pytest.mark.asyncio
async def test_ingest_guest_requires_session():
    db = AsyncMock()
    with patch("backend.core.observation.experience_event_service.get_settings") as mock_gs:
        mock_gs.return_value = _enabled_settings()
        result = await ingest_experience_event(
            db,
            _base_payload(
                eventType="guest_conversation_started",
                guestToken="plain-guest-token",
                sessionId=None,
            ),
        )
    assert result == {"ok": False, "reason": "unauthorized"}


@pytest.mark.asyncio
async def test_ingest_hashes_guest_token_with_session():
    db = AsyncMock()
    with patch("backend.core.observation.experience_event_service.get_settings") as mock_gs:
        mock_gs.return_value = _enabled_settings()
        with patch(
            "backend.core.observation.experience_event_service.log_experience_event",
            new_callable=AsyncMock,
            return_value="evt-guest",
        ) as mock_log:
            await ingest_experience_event(
                db,
                _base_payload(
                    eventType="guest_conversation_started",
                    guestToken="plain-guest-token",
                ),
            )
    logged = mock_log.await_args.args[1]
    assert logged["guest_token_hash"] == hash_guest_token("plain-guest-token")


@pytest.mark.asyncio
async def test_log_eza_event_not_called_by_experience_ingest():
    db = AsyncMock()
    with patch("backend.core.events.event_logger.log_eza_event", new_callable=AsyncMock) as mock_gov:
        with patch("backend.core.observation.experience_event_service.get_settings") as mock_gs:
            mock_gs.return_value = _enabled_settings()
            with patch(
                "backend.core.observation.experience_event_service.log_experience_event",
                new_callable=AsyncMock,
                return_value="evt-1",
            ):
                await ingest_experience_event(db, _base_payload(eventType="branch_opened"))
    mock_gov.assert_not_awaited()


@pytest.mark.asyncio
async def test_purge_expired_experience_events():
    db = AsyncMock()
    result = MagicMock()
    result.rowcount = 3
    db.execute = AsyncMock(return_value=result)
    db.commit = AsyncMock()
    deleted = await purge_expired_experience_events(db)
    assert deleted == 3


@pytest.mark.asyncio
async def test_purge_script_run_purge():
    from backend.scripts import purge_experience_events as purge_script

    with patch(
        "backend.scripts.purge_experience_events.purge_expired_experience_events",
        new_callable=AsyncMock,
        return_value=2,
    ):
        assert await purge_script.run_purge() == 0


def test_purge_script_module_import_path():
    from backend.scripts import purge_experience_events as purge_script

    assert purge_script.main is not None
    assert purge_script._EZA_V5_ROOT.name == "eza-v5"


@pytest.mark.asyncio
async def test_rate_limit_blocks_abuse():
    import backend.core.observation.experience_event_rate_limit as rl

    rl._in_memory_limits.clear()
    with patch("backend.core.utils.dependencies.get_redis", new_callable=AsyncMock, return_value=None):
        await rl._rate_limit_key("test-key-abuse-only", limit=2, window=60)
        await rl._rate_limit_key("test-key-abuse-only", limit=2, window=60)
        with pytest.raises(RateLimitError):
            await rl._rate_limit_key("test-key-abuse-only", limit=2, window=60)


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

    with patch(
        "backend.api.routers.experience_events_router.is_experience_event_logging_enabled",
        return_value=False,
    ):
        with patch(
            "backend.api.routers.experience_events_router.read_limited_experience_body",
            new_callable=AsyncMock,
        ) as mock_read_body:
            with patch(
                "backend.api.routers.experience_events_router.ingest_experience_event",
                new_callable=AsyncMock,
            ) as mock_ingest:
                with patch(
                    "backend.api.routers.experience_events_router.rate_limit_experience_events",
                    new_callable=AsyncMock,
                ) as mock_rate:
                    client = TestClient(app)
                    r = client.post(
                        "/api/eza/experience-events",
                        json=_base_payload(eventType="mirror_created"),
                        headers={"Authorization": "Bearer invalid-token"},
                    )
    assert r.status_code == 200
    assert r.json() == {"ok": False, "reason": "disabled"}
    mock_read_body.assert_not_awaited()
    mock_ingest.assert_not_awaited()
    mock_rate.assert_not_awaited()


def test_post_experience_events_disabled_large_body_not_413():
    from backend.main import app

    with patch(
        "backend.api.routers.experience_events_router.is_experience_event_logging_enabled",
        return_value=False,
    ):
        with patch(
            "backend.api.routers.experience_events_router.read_limited_experience_body",
            new_callable=AsyncMock,
        ) as mock_read_body:
            client = TestClient(app)
            body = json.dumps({**_base_payload(), "pad": "x" * 500_000})
            r = client.post(
                "/api/eza/experience-events",
                content=body.encode("utf-8"),
                headers={"Content-Type": "application/json"},
            )
    assert r.status_code == 200
    assert r.json() == {"ok": False, "reason": "disabled"}
    mock_read_body.assert_not_awaited()


def test_post_experience_events_rejects_extra_user_id():
    from backend.main import app

    with patch(
        "backend.api.routers.experience_events_router.is_experience_event_logging_enabled",
        return_value=True,
    ):
        client = TestClient(app)
        r = client.post(
            "/api/eza/experience-events",
            json={**_base_payload(), "userId": "spoof"},
        )
    assert r.status_code == 200
    assert r.json()["reason"] == "unauthorized"


def test_post_experience_events_rejects_invalid_bearer():
    from backend.main import app

    with patch(
        "backend.api.routers.experience_events_router.is_experience_event_logging_enabled",
        return_value=True,
    ):
        with patch("backend.auth.jwt.get_user_from_token", return_value=None):
            client = TestClient(app)
            r = client.post(
                "/api/eza/experience-events",
                json=_base_payload(),
                headers={"Authorization": "Bearer invalid-token"},
            )
    assert r.status_code == 200
    assert r.json() == {"ok": False, "reason": "unauthorized"}


def test_post_experience_events_large_body_returns_413():
    from backend.main import app

    with patch(
        "backend.api.routers.experience_events_router.is_experience_event_logging_enabled",
        return_value=True,
    ):
        with patch("backend.core.observation.experience_event_body.get_settings") as mock_gs:
            mock_gs.return_value = MagicMock(EXPERIENCE_EVENT_MAX_BODY_BYTES=128)
            client = TestClient(app)
            body = json.dumps({**_base_payload(), "pad": "x" * 500})
            r = client.post(
                "/api/eza/experience-events",
                content=body.encode("utf-8"),
                headers={"Content-Type": "application/json"},
            )
    assert r.status_code == 413
    assert r.json()["detail"]["reason"] == "payload_too_large"


@pytest.mark.asyncio
async def test_governance_log_eza_event_still_validates_required_fields():
    db = AsyncMock()
    result = await log_eza_event(db, {"event_type": "message"})
    assert result is None
