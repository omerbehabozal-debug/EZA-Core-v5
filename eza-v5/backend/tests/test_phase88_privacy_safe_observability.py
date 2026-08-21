# -*- coding: utf-8 -*-
"""Phase 8.8 — privacy-safe observability closure tests."""

from __future__ import annotations

import logging

from backend.observability.error_codes import (
    EXPECTED_CODES,
    FROZEN_ARTIFACT_INVALID,
    INTERNAL_ERROR,
    PROVIDER_TIMEOUT,
    PUBLISH_FAILED,
    SOCIAL_AUTH_FAILED,
)
from backend.observability.ops_events import emit_ops_event
from backend.observability.redaction import (
    REDACTED,
    assert_no_sentinels,
    redact_mapping,
    redact_text,
)
from backend.observability.request_id import (
    clear_request_id,
    generate_request_id,
    sanitize_incoming_request_id,
    set_request_id,
)


SENTINELS = [
    "phase88-user@example.test",
    "phase88-jwt-secret",
    "phase88-api-key-secret",
    "phase88-guest-token-secret",
    "phase88-lineage-proof-secret",
    "phase88-private-conversation-text",
]


def test_request_id_opaque_and_rejects_junk():
    rid = generate_request_id()
    assert 8 <= len(rid) <= 64
    assert "@" not in rid
    assert sanitize_incoming_request_id(rid) == rid
    assert sanitize_incoming_request_id("phase88-user@example.test") is None
    assert sanitize_incoming_request_id("short") is None
    assert sanitize_incoming_request_id("../../etc/passwd") is None


def test_redaction_masks_credentials_email_and_tokens():
    payload = {
        "email": "phase88-user@example.test",
        "password": "phase88-jwt-secret",
        "access_token": "phase88-api-key-secret",
        "guest_token": "phase88-guest-token-secret",
        "lineageProofToken": "phase88-lineage-proof-secret",
        "authorization": "Bearer phase88-jwt-secret",
        "prompt": "phase88-private-conversation-text",
        "safe": "discover_ok",
    }
    redacted = redact_mapping(payload)
    for key in (
        "email",
        "password",
        "access_token",
        "guest_token",
        "lineageProofToken",
        "authorization",
        "prompt",
    ):
        assert redacted[key] == REDACTED
    assert redacted["safe"] == "discover_ok"

    text = redact_text(
        "user=phase88-user@example.test Bearer phase88-jwt-secret"
    )
    assert "phase88-user@example.test" not in text
    assert "Bearer [REDACTED]" in text or REDACTED in text


def test_ops_event_strips_forbidden_fields_and_sentinels(caplog):
    set_request_id("req_phase88_opaque_01")
    try:
        with caplog.at_level(logging.ERROR, logger="backend.ops"):
            emit_ops_event(
                "social_auth_failed",
                code=SOCIAL_AUTH_FAILED,
                outcome="failure",
                fields={
                    "email": "phase88-user@example.test",
                    "guest_token": "phase88-guest-token-secret",
                    "prompt": "phase88-private-conversation-text",
                    "slug": "should-not-appear",
                    "user_id": "uuid-should-not",
                    "provider": "google",
                    "reason": "invalid_token",
                },
            )
        joined = " ".join(r.getMessage() for r in caplog.records)
        assert_no_sentinels(joined, SENTINELS)
        assert "should-not-appear" not in joined
        assert "uuid-should-not" not in joined
        assert "social_auth_failed" in joined
        assert "req_phase88_opaque_01" in joined
    finally:
        clear_request_id()


def test_expected_codes_do_not_use_error_level(caplog):
    with caplog.at_level(logging.DEBUG, logger="backend.ops"):
        emit_ops_event(
            "frozen_replay_load_failed",
            code=FROZEN_ARTIFACT_INVALID,
            outcome="failure",
        )
    assert FROZEN_ARTIFACT_INVALID in EXPECTED_CODES
    assert any(r.levelno == logging.INFO for r in caplog.records)
    assert not any(r.levelno >= logging.ERROR for r in caplog.records)


def test_unknown_ops_event_rejected(caplog):
    with caplog.at_level(logging.WARNING, logger="backend.ops"):
        emit_ops_event("marketing_click_heatmap", outcome="success")
    assert any("ops_event_rejected" in r.getMessage() for r in caplog.records)


def test_sensitive_logger_filter_always_redacts():
    from backend.security.logger_filter import SensitiveDataFilter

    filt = SensitiveDataFilter()
    record = logging.LogRecord(
        name="t",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="login email=phase88-user@example.test password=phase88-jwt-secret",
        args=(),
        exc_info=None,
    )
    assert filt.filter(record) is True
    assert "phase88-user@example.test" not in str(record.msg)
    assert "phase88-jwt-secret" not in str(record.msg)


def test_taxonomy_includes_critical_codes():
    assert INTERNAL_ERROR
    assert PUBLISH_FAILED
    assert PROVIDER_TIMEOUT
    assert SOCIAL_AUTH_FAILED


def test_health_minimal_contract():
    from pathlib import Path

    main = Path(__file__).resolve().parents[1] / "main.py"
    text = main.read_text(encoding="utf-8")
    assert '@app.get("/health")' in text
    assert '"status": "ok"' in text
    health_fn = text.split('@app.get("/health")', 1)[1].split("@app.get", 1)[0]
    assert "JWT" not in health_fn
    assert "OPENAI" not in health_fn
    assert "password" not in health_fn.lower()


def test_client_ops_router_allowlist():
    from backend.routers.ops_telemetry import _CLIENT_EVENTS

    assert "discover_load_failed" in _CLIENT_EVENTS
    assert "heatmap_click" not in _CLIENT_EVENTS


def test_phase6_isolation_ops_does_not_touch_experience_ingest():
    from pathlib import Path

    ops = (Path(__file__).resolve().parents[1] / "observability/ops_events.py").read_text(
        encoding="utf-8"
    )
    assert "ingest_yansi_experience" not in ops
    assert "yansi_experience_started" not in ops
    assert "strong_curiosity" not in ops


def test_health_returns_request_id_header():
    from fastapi.testclient import TestClient
    from backend.main import app

    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    rid = response.headers.get("X-Request-ID")
    assert rid
    assert 8 <= len(rid) <= 64
    assert "@" not in rid
