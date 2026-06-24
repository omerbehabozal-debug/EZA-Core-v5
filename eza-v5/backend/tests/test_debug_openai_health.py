# -*- coding: utf-8 -*-
"""Tests for protected OpenAI health debug endpoint."""

import os
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_openai_health_hidden_without_secret_config(monkeypatch):
    monkeypatch.delenv("EZA_DEBUG_SECRET", raising=False)
    monkeypatch.delenv("DEBUG_SECRET", raising=False)
    with patch("backend.routers.debug_openai._configured_debug_secret", return_value=None):
        res = client.get("/api/debug/openai-health")
    assert res.status_code == 404


def test_openai_health_requires_valid_secret(monkeypatch):
    with patch("backend.routers.debug_openai._configured_debug_secret", return_value="test-secret"):
        with patch(
            "backend.routers.debug_openai.run_openai_health_checks",
            new_callable=AsyncMock,
            return_value={"ok": True, "env": {}, "modelsList": {}, "chatPing": {}, "imageConfig": {}, "summary": {}},
        ):
            res = client.get("/api/debug/openai-health")
            assert res.status_code == 401
            res2 = client.get(
                "/api/debug/openai-health",
                headers={"X-Debug-Secret": "test-secret"},
            )
            assert res2.status_code == 200
            body = res2.json()
            assert "env" in body
            assert "modelsList" in body
            assert "chatPing" in body
            assert "imageConfig" in body


@patch("backend.routers.debug_openai.run_openai_health_checks", new_callable=AsyncMock)
def test_openai_health_returns_probe_results(mock_run):
    mock_run.return_value = {
        "ok": False,
        "env": {"apiKeyFingerprint": "sk-proj...9XcT3"},
        "modelsList": {"status": "error", "errorCode": "insufficient_quota"},
        "chatPing": {"status": "error", "errorCode": "insufficient_quota"},
        "imageConfig": {"status": "config_only"},
        "summary": {"likelyCause": "billing"},
    }
    with patch("backend.routers.debug_openai._configured_debug_secret", return_value="s3cr3t"):
        res = client.get("/api/debug/openai-health", headers={"X-Debug-Secret": "s3cr3t"})
    assert res.status_code == 200
    assert res.json()["ok"] is False
