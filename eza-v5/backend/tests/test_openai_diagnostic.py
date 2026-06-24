# -*- coding: utf-8 -*-
"""Tests for OpenAI diagnostic helpers."""

import json

from backend.core.openai.config import mask_api_key, sanitize_text
from backend.core.openai.diagnostic import (
    build_api_error_detail,
    create_openai_diagnostic,
    http_status_for_openai_diagnostic,
    parse_openai_http_error,
)


def test_mask_api_key_never_exposes_full_key():
    key = "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890"
    masked = mask_api_key(key)
    assert masked["apiKeyPresent"] is True
    assert masked["apiKeyFormatValid"] is True
    assert key not in masked["apiKeyFingerprint"]
    assert masked["apiKeyFingerprint"].endswith("67890")


def test_sanitize_text_redacts_sk_pattern():
    text = "failed with sk-proj-abcdefghijklmnopqrstuvwxyz1234567890"
    cleaned = sanitize_text(text)
    assert "sk-proj-abc" not in cleaned
    assert "REDACTED" in cleaned


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
