# -*- coding: utf-8 -*-
"""Centralized privacy redaction for logs and ops telemetry payloads."""

from __future__ import annotations

import json
import re
from typing import Any

REDACTED = "[REDACTED]"

# Key substrings (case-insensitive) that force redaction of the value.
SENSITIVE_KEY_FRAGMENTS = (
    "authorization",
    "cookie",
    "set-cookie",
    "password",
    "passwd",
    "token",
    "access_token",
    "refresh_token",
    "id_token",
    "api_key",
    "apikey",
    "x-api-key",
    "guest_token",
    "guesttoken",
    "lineageprooftoken",
    "lineage_proof",
    "secret",
    "private_key",
    "jwt",
    "bearer",
    "email",
    "user_input",
    "raw_output",
    "safe_answer",
    "prompt",
    "conversation",
    "message_text",
    "messages",
)

# Sentinel / pattern redaction in free text.
_EMAIL_RE = re.compile(
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"
)
_BEARER_RE = re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._\-]+")
_JWT_RE = re.compile(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b")


def _key_is_sensitive(key: str) -> bool:
    kl = key.lower().replace("-", "_")
    return any(frag in kl for frag in SENSITIVE_KEY_FRAGMENTS)


def redact_value(value: Any) -> Any:
    if isinstance(value, dict):
        return redact_mapping(value)
    if isinstance(value, list):
        return [redact_value(item) for item in value]
    if isinstance(value, str):
        return redact_text(value)
    return value


def redact_mapping(data: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in data.items():
        if _key_is_sensitive(str(key)):
            out[key] = REDACTED
        else:
            out[key] = redact_value(value)
    return out


def redact_text(text: str) -> str:
    if not text:
        return text
    # JSON object/array attempt
    stripped = text.strip()
    if (stripped.startswith("{") and stripped.endswith("}")) or (
        stripped.startswith("[") and stripped.endswith("]")
    ):
        try:
            parsed = json.loads(stripped)
            return json.dumps(redact_value(parsed), ensure_ascii=False)
        except (json.JSONDecodeError, TypeError):
            pass

    result = text
    result = _BEARER_RE.sub(f"Bearer {REDACTED}", result)
    result = _JWT_RE.sub(REDACTED, result)
    result = _EMAIL_RE.sub(REDACTED, result)

    for frag in (
        "password",
        "api_key",
        "access_token",
        "refresh_token",
        "id_token",
        "guest_token",
        "lineageProofToken",
        "authorization",
    ):
        patterns = [
            rf'(?i)"{re.escape(frag)}"\s*:\s*"[^"]*"',
            rf"(?i)'{re.escape(frag)}'\s*:\s*'[^']*'",
            rf"(?i){re.escape(frag)}\s*=\s*[^\s,;]+",
        ]
        for pattern in patterns:
            result = re.sub(pattern, f'{frag}={REDACTED}', result)
    return result


def assert_no_sentinels(haystack: str, sentinels: list[str]) -> None:
    """Test helper — raise AssertionError if any sentinel appears."""
    lower = haystack.lower()
    for s in sentinels:
        if s.lower() in lower:
            raise AssertionError(f"sentinel leaked into logs/telemetry: {s}")
