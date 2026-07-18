# -*- coding: utf-8 -*-
"""Unit tests for OpenAI stream retry helpers."""

from backend.api.streaming import (
    OpenAIHTTPError,
    _is_retryable_openai_error,
    _openai_http_error,
    _retry_delay_seconds,
)


def test_openai_http_error_parses_rate_limit_body():
    body = '{"error":{"message":"Rate limit reached","type":"tokens","code":"rate_limit_exceeded"}}'
    err = _openai_http_error(429, body, {"retry-after": "2"})
    assert isinstance(err, OpenAIHTTPError)
    assert err.diagnostic["errorCode"] == "rate_limit_exceeded"
    assert _is_retryable_openai_error(err) is True


def test_insufficient_quota_is_not_retryable():
    body = '{"error":{"message":"You exceeded your current quota","type":"insufficient_quota","code":"insufficient_quota"}}'
    err = _openai_http_error(429, body, {})
    assert err.diagnostic["errorCode"] == "insufficient_quota"
    assert _is_retryable_openai_error(err) is False


def test_retry_delay_honors_retry_after_header():
    assert _retry_delay_seconds({"Retry-After": "3"}, 0) == 3.0
    assert _retry_delay_seconds({}, 0) == 1.0
    assert _retry_delay_seconds({}, 2) == 4.0
