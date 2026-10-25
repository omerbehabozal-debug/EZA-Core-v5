# -*- coding: utf-8 -*-
"""Tests for OpenAI diagnostic helpers."""

import json

import pytest

from backend.core.openai.config import mask_api_key, sanitize_text
from backend.core.openai.diagnostic import (
    build_api_error_detail,
    create_openai_diagnostic,
    http_status_for_openai_diagnostic,
    parse_openai_http_error,
)


def _assert_masked(key):
    masked = mask_api_key(key)
    rendered = " ".join(str(value) for value in masked.values())
    assert key not in rendered
    secret = key.split("-", 2)[-1]
    if len(secret) >= 12:
        assert secret[:-4] not in rendered
    return masked


def test_mask_api_key_never_exposes_full_key():
    key = "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890"
    masked = _assert_masked(key)
    assert masked["apiKeyPresent"] is True
    assert masked["apiKeyFormatValid"] is True
    assert masked["apiKeyPrefix"] == "sk-proj"
    assert masked["apiKeyFingerprint"].startswith("sk-proj-")
    assert masked["apiKeyFingerprint"].endswith("7890")


def test_mask_api_key_covers_legacy_short_and_unknown_shapes():
    legacy = "sk-" + ("a" * 24) + "wxyz"
    masked = _assert_masked(legacy)
    assert masked["apiKeyPrefix"] == "sk"
    assert masked["apiKeyFormatValid"] is True
    assert "a" * 8 not in masked["apiKeyFingerprint"]

    for raw in (None, "", "   ", "sk-short", "sk-proj-tiny", "not-a-key", "sk-proj"):
        hidden = _assert_masked(raw.strip()) if isinstance(raw, str) and raw.strip() else mask_api_key(raw)
        assert hidden["apiKeyFormatValid"] is False
        rendered = " ".join(str(value) for value in hidden.values() if value)
        assert "tiny" not in rendered
        assert "short" not in rendered


@pytest.mark.asyncio
async def test_generate_error_body_does_not_keep_the_key(monkeypatch):
    import httpx
    from backend.core.llm.providers.openai_client import OpenAIClient
    secret = "sk-proj-" + ("b" * 20) + "wxyz"

    class Response:
        status_code = 500
        text = f"invalid {secret}"

    class Client:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, *args, **kwargs):
            return Response()

    monkeypatch.setattr(httpx, "AsyncClient", Client)
    client = OpenAIClient()
    client.api_key = secret
    result = await client.generate("prompt", "gpt-4o-mini")
    assert result["ok"] is False
    assert secret not in result["error"]
    assert "bbbb" not in result["error"]
    assert "500" in result["error"]


def test_sanitize_text_redacts_sk_pattern():
    text = "failed with sk-proj-abcdefghijklmnopqrstuvwxyz1234567890 and sk-abc"
    cleaned = sanitize_text(text)
    assert "sk-proj-abc" not in cleaned
    assert "sk-abc" not in cleaned
    assert "REDACTED" in cleaned
    assert "failed with" in cleaned


def test_parse_openai_insufficient_quota():
    body = json.dumps(
        {
            "error": {
                "message": "You exceeded your current quota, please check your plan and billing details.",
                "type": "insufficient_quota",
                "param": None,
                "code": "insufficient_quota",
            }
        }
    )
    diag = parse_openai_http_error(429, body, {"x-request-id": "req_test_1"})
    assert diag["errorCode"] == "insufficient_quota"
    assert diag["likelyCause"]
    assert diag["suggestedFix"]
    assert diag["requestId"] == "req_test_1"
    assert http_status_for_openai_diagnostic(diag) == 402


def test_build_api_error_detail_shape():
    diag = create_openai_diagnostic(
        {
            "httpStatus": 429,
            "errorCode": "insufficient_quota",
            "errorType": "insufficient_quota",
            "errorMessage": "quota",
        }
    )
    diag.update(
        {
            "httpStatus": 429,
            "errorCode": "insufficient_quota",
            "errorType": "insufficient_quota",
            "errorMessage": "quota",
            "requestId": "req_1",
        }
    )
    detail = build_api_error_detail(diag, user_message="Mirror sahnesi hazırlanamadı.")
    assert detail["ok"] is False
    assert detail["source"] == "openai"
    assert detail["code"] == "openai_insufficient_quota"
    assert detail["diagnosticHint"]
