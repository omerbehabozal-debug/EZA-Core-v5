# -*- coding: utf-8 -*-
"""Phase 8.8.1 — ops client-event abuse-surface closure tests."""

from __future__ import annotations

import json
import logging

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.observability.error_codes import CLIENT_OPS_CODES, DISCOVER_LOAD_FAILED
from backend.routers.ops_telemetry import CLIENT_OPS_MAX_BODY_BYTES, _CLIENT_EVENTS
from backend.security.rate_limit import (
    OPS_CLIENT_RATE_LIMIT,
    reset_in_memory_rate_limits_for_tests,
)

SENTINELS = [
    "phase881-user@example.test",
    "phase881-jwt-secret.eyJhbGciOi",
    "phase881-api-key-secret",
    "phase881-guest-token-secret",
    "phase881-lineage-proof-secret",
    "phase881-private-conversation-text",
]


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch):
    import importlib

    monkeypatch.setenv("ENV", "test")
    monkeypatch.setenv("EZA_ENV", "test")
    reset_in_memory_rate_limits_for_tests()

    async def _no_redis():
        return None

    # Package __init__ shadows submodule name `rate_limit` — use importlib.
    rate_limit_mod = importlib.import_module("backend.security.rate_limit")
    monkeypatch.setattr(rate_limit_mod, "get_redis", _no_redis)
    # Avoid lifespan enter/exit issues with DB pool on Windows tests.
    c = TestClient(app, raise_server_exceptions=False)
    yield c
    reset_in_memory_rate_limits_for_tests()


def _post(client: TestClient, payload, *, raw: bytes | None = None, headers=None):
    if raw is not None:
        h = {"Content-Type": "application/json"}
        if headers:
            h.update(headers)
        return client.post("/api/ops/client-event", content=raw, headers=h)
    return client.post("/api/ops/client-event", json=payload, headers=headers or {})


def test_valid_allowlisted_event_accepted(client: TestClient, caplog):
    with caplog.at_level(logging.INFO, logger="backend.ops"):
        r = _post(
            client,
            {
                "event": "discover_load_failed",
                "code": DISCOVER_LOAD_FAILED,
                "outcome": "failure",
            },
        )
    assert r.status_code == 200
    assert r.json() == {"ok": True}
    joined = " ".join(rec.getMessage() for rec in caplog.records)
    assert "client_ops_event" in joined or "discover_load_failed" in joined
    assert "email" not in joined.lower() or "[REDACTED]" in joined
    for s in SENTINELS:
        assert s not in joined


def test_unknown_event_rejected(client: TestClient, caplog):
    with caplog.at_level(logging.DEBUG, logger="backend.ops"):
        r = _post(client, {"event": "heatmap_click", "outcome": "failure"})
    assert r.status_code == 422
    assert r.json().get("error") == "invalid_ops_event"
    assert not any("heatmap_click" in rec.getMessage() for rec in caplog.records)


def test_unknown_json_field_rejected(client: TestClient):
    r = _post(
        client,
        {
            "event": "discover_load_failed",
            "email": "phase881-user@example.test",
            "outcome": "failure",
        },
    )
    assert r.status_code == 422
    body = r.json()
    assert "phase881-user@example.test" not in json.dumps(body)


def test_nested_arbitrary_payload_rejected(client: TestClient):
    r = _post(
        client,
        {
            "event": "discover_load_failed",
            "metadata": {"prompt": "phase881-private-conversation-text"},
        },
    )
    assert r.status_code == 422


def test_oversized_body_rejected_via_content_length(client: TestClient, caplog):
    with caplog.at_level(logging.WARNING):
        r = _post(
            client,
            None,
            raw=b"{}",
            headers={"Content-Length": str(CLIENT_OPS_MAX_BODY_BYTES + 1)},
        )
    assert r.status_code == 413
    assert r.json().get("error") == "payload_too_large"
    # Should not log the (would-be) payload or ERROR for abuse reject
    assert not any(rec.levelno >= logging.ERROR for rec in caplog.records)


def test_oversized_body_rejected_measured(client: TestClient, caplog):
    raw = b'{"event":"discover_load_failed","pad":"' + (b"x" * (CLIENT_OPS_MAX_BODY_BYTES)) + b'"}'
    assert len(raw) > CLIENT_OPS_MAX_BODY_BYTES
    with caplog.at_level(logging.DEBUG):
        r = _post(client, None, raw=raw)
    assert r.status_code == 413
    joined = " ".join(rec.getMessage() for rec in caplog.records)
    assert "xxxx" not in joined
    assert "phase881" not in joined


def test_rate_limit_allows_small_burst(client: TestClient):
    for _ in range(5):
        r = _post(
            client,
            {"event": "discover_load_failed", "code": DISCOVER_LOAD_FAILED},
        )
        assert r.status_code == 200


def test_rate_limit_returns_429(client: TestClient, caplog):
    with caplog.at_level(logging.DEBUG):
        last = None
        for i in range(OPS_CLIENT_RATE_LIMIT + 5):
            last = _post(
                client,
                {
                    "event": "discover_load_failed",
                    "code": DISCOVER_LOAD_FAILED,
                    "email": "phase881-user@example.test",  # ignored path after rate? first requests valid schema only
                }
                if False
                else {"event": "discover_load_failed", "code": DISCOVER_LOAD_FAILED},
            )
            if last.status_code == 429:
                break
        assert last is not None
        assert last.status_code == 429
        joined = " ".join(rec.getMessage() for rec in caplog.records)
        for s in SENTINELS:
            assert s not in joined
        # Quiet: no IP-bearing ERROR spam for ops client limit
        assert "Rate limit exceeded for" not in joined


def test_rate_limit_no_persistent_identity(client: TestClient):
    """Limiter stores opaque hashed bucket keys only — never email/user id."""
    import importlib

    rl = importlib.import_module("backend.security.rate_limit")

    _post(client, {"event": "discover_load_failed", "code": DISCOVER_LOAD_FAILED})
    keys = list(rl._in_memory_limits.keys())
    assert keys
    assert all(k.startswith("ops_client:") for k in keys if "ops_client" in k)
    blob = json.dumps(keys)
    assert "@" not in blob
    assert "guest" not in blob.lower()
    assert "phase881" not in blob


def test_sentinels_cannot_be_accepted_or_logged(client: TestClient, caplog):
    with caplog.at_level(logging.DEBUG):
        r = _post(
            client,
            {
                "event": "discover_load_failed",
                "code": DISCOVER_LOAD_FAILED,
                "password": "phase881-jwt-secret.eyJhbGciOi",
                "guest_token": "phase881-guest-token-secret",
                "lineageProofToken": "phase881-lineage-proof-secret",
                "prompt": "phase881-private-conversation-text",
                "email": "phase881-user@example.test",
            },
        )
    assert r.status_code == 422
    joined = " ".join(rec.getMessage() for rec in caplog.records) + json.dumps(r.json())
    for s in SENTINELS:
        assert s not in joined


def test_unknown_code_rejected(client: TestClient):
    r = _post(
        client,
        {
            "event": "discover_load_failed",
            "code": "NOT_A_REAL_CODE",
            "outcome": "failure",
        },
    )
    assert r.status_code == 422


def test_log_injection_cannot_forge_extra_event(client: TestClient, caplog):
    evil = "DISCOVER_LOAD_FAILED\nops_event event=forged"
    with caplog.at_level(logging.DEBUG, logger="backend.ops"):
        r = _post(
            client,
            {"event": "discover_load_failed", "code": evil, "outcome": "failure"},
        )
    assert r.status_code == 422
    assert not any("event=forged" in rec.getMessage() for rec in caplog.records)


def test_valid_telemetry_logs_only_allowlisted_fields(client: TestClient, caplog):
    with caplog.at_level(logging.DEBUG, logger="backend.ops"):
        _post(
            client,
            {
                "event": "social_auth_failed",
                "code": "SOCIAL_AUTH_FAILED",
                "outcome": "failure",
            },
        )
    joined = " ".join(rec.getMessage() for rec in caplog.records)
    assert "social_auth_failed" in joined
    assert "SOCIAL_AUTH_FAILED" in joined or "code=SOCIAL_AUTH_FAILED" in joined
    assert "slug=" not in joined
    assert "user_id=" not in joined


def test_allowlists_are_closed():
    assert "heatmap_click" not in _CLIENT_EVENTS
    assert "message" not in CLIENT_OPS_CODES
    assert DISCOVER_LOAD_FAILED in CLIENT_OPS_CODES


def test_request_id_header_still_present(client: TestClient):
    r = _post(
        client,
        {"event": "discover_load_failed", "code": DISCOVER_LOAD_FAILED},
    )
    assert r.status_code == 200
    rid = r.headers.get("X-Request-ID")
    assert rid and 8 <= len(rid) <= 64
