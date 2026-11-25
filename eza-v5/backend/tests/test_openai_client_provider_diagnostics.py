"""OpenAIClient provider diagnostics + payload capture (mock HTTP, no paid calls)."""
from __future__ import annotations

import json

import httpx
import pytest

from backend.core.llm.providers.openai_client import OpenAIClient
from backend.core.openai.strict_schema import assert_openai_strict_schema
from backend.services.yansi import ai_conversation_proposal_v2 as v2ai


class _FakeResponse:
    def __init__(self, status_code, body, headers=None):
        self.status_code = status_code
        self.text = body if isinstance(body, str) else json.dumps(body)
        self.headers = headers or {}

    def json(self):
        return json.loads(self.text)


def _client_with_capture(monkeypatch, responder):
    captured = {}

    class Client:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, url, headers=None, json=None, timeout=None):
            captured["url"] = url
            captured["headers"] = headers
            captured["json"] = json
            captured["timeout"] = timeout
            return responder(url, headers, json)

    monkeypatch.setattr(httpx, "AsyncClient", Client)
    client = OpenAIClient()
    client.api_key = "sk-test-not-a-real-key-xxxxxxxxxxxx"
    return client, captured


@pytest.mark.asyncio
async def test_v2_strict_schema_is_sent_in_openai_payload(monkeypatch):
    passages = {
        "a" * 24: {
            "versionId": "x",
            "version": 1,
            "contentHash": "h",
            "start": 0,
            "end": 40,
            "text": "Merhaba bu bir cevap cumlesidir ve yeterince uzundur.",
            "passageHash": "p",
            "offsetEncoding": "unicode-codepoint",
        }
    }
    schema = v2ai.output_schema(passages, None)
    assert assert_openai_strict_schema(schema) == []

    def responder(url, headers, payload):
        return _FakeResponse(
            200,
            {
                "choices": [{"message": {"content": '{"insufficientSources":true,"result":null}'}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 5},
            },
        )

    client, captured = _client_with_capture(monkeypatch, responder)
    result = await client.generate("prompt-data", "gpt-4.1-mini", json_schema=schema)
    assert result["ok"] is True
    body = captured["json"]
    assert body["model"] == "gpt-4.1-mini"
    fmt = body["response_format"]
    assert fmt["type"] == "json_schema"
    assert fmt["json_schema"]["strict"] is True
    assert fmt["json_schema"]["name"] == "business_studio"
    sent = fmt["json_schema"]["schema"]
    assert assert_openai_strict_schema(sent) == []
    assert set(sent["required"]) == set(sent["properties"].keys())
    auth = captured["headers"]["Authorization"]
    assert auth.startswith("Bearer ")
    assert "sk-test" in auth  # request header present
    # Must never appear in result/error diagnostics.
    assert "sk-test" not in json.dumps(result)


@pytest.mark.asyncio
async def test_http_400_diagnostics_no_secret_or_body_leak(monkeypatch):
    secret = "sk-proj-" + ("z" * 20) + "wxyz"
    body = {
        "error": {
            "message": f"Invalid schema including {secret}",
            "type": "invalid_request_error",
            "param": "response_format",
            "code": "invalid_json_schema",
        }
    }

    def responder(url, headers, payload):
        return _FakeResponse(400, body, {"x-request-id": "req_diag_1"})

    client, _ = _client_with_capture(monkeypatch, responder)
    client.api_key = secret
    result = await client.generate("PROMPT SECRET TEXT", "gpt-4.1-mini", json_schema={"type": "object", "properties": {}, "additionalProperties": False})
    assert result["ok"] is False
    assert result["failureKind"] == "http"
    assert result["retriable"] is False
    diag = result["providerDiagnostics"]
    assert diag["httpStatus"] == 400
    assert diag["errorType"] == "invalid_request_error"
    assert diag["errorCode"] == "invalid_json_schema"
    assert diag["errorParam"] == "response_format"
    assert diag["requestId"] == "req_diag_1"
    blob = json.dumps(result)
    assert secret not in blob
    assert "PROMPT SECRET" not in blob
    assert "zzzz" not in blob


@pytest.mark.asyncio
async def test_http_401_429_500_retriable_flags(monkeypatch):
    cases = [
        (401, "invalid_api_key", False),
        (429, "rate_limit_exceeded", True),
        (500, "server_error", True),
    ]
    for status, code, retriable in cases:
        def responder(url, headers, payload, status=status, code=code):
            return _FakeResponse(
                status,
                {"error": {"message": "x", "type": "err", "code": code, "param": None}},
                {"x-request-id": f"req_{status}"},
            )

        client, _ = _client_with_capture(monkeypatch, responder)
        result = await client.generate("p", "gpt-4o-mini")
        assert result["ok"] is False
        assert result["providerDiagnostics"]["httpStatus"] == status
        assert result["retriable"] is retriable


@pytest.mark.asyncio
async def test_timeout_failure_kind(monkeypatch):
    class Client:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, *args, **kwargs):
            raise httpx.TimeoutException("slow")

    monkeypatch.setattr(httpx, "AsyncClient", Client)
    client = OpenAIClient()
    client.api_key = "sk-test-xxxxxxxxxxxxxxxxxxxx"
    result = await client.generate("p", "gpt-4o-mini")
    assert result["ok"] is False
    assert result["failureKind"] == "timeout"
    assert result["retriable"] is True
