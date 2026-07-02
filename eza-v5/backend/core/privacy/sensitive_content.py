# -*- coding: utf-8 -*-
"""Value-based PII and sensitive content detection (shared across EZA surfaces)."""

from __future__ import annotations

import re

EMAIL_RE = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
    re.IGNORECASE,
)
PHONE_RE = re.compile(
    r"(?:\+?\d{1,3}[\s\-]?)?(?:\(?\d{2,4}\)?[\s\-]?)?\d{3}[\s\-]?\d{2}[\s\-]?\d{2,4}",
)
TC_KIMLIK_RE = re.compile(r"\b\d{11}\b")
JWT_LIKE_RE = re.compile(r"eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+")
URL_WITH_CREDS_RE = re.compile(
    r"https?://[^\s]+[:@][^\s]+",
    re.IGNORECASE,
)
OPENAI_KEY_RE = re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_\-]{8,}\b", re.IGNORECASE)
BEARER_TOKEN_RE = re.compile(r"\bBearer\s+[A-Za-z0-9_\-\.=]{12,}\b", re.IGNORECASE)
CREDENTIAL_QUERY_RE = re.compile(
    r"(?:^|[?&])(?:api[_-]?key|access[_-]?token|auth[_-]?token|token|secret)=",
    re.IGNORECASE,
)
OPAQUE_SECRET_RE = re.compile(
    r"\b[A-Za-z0-9_\-]{32,}\b",
)
ADDRESS_LIKE_RE = re.compile(
    r"\b(?:sokak|sok\.?|cadde|cad\.?|mahalle|mah\.?|bulvar|blv\.?|"
    r"apt\.?|apartment|daire|street|avenue|ave\.?)\b",
    re.IGNORECASE,
)
SHORT_ADDRESS_RE = re.compile(
    r"(?:mah\.?|mahallesi)\b.+\bno\.?\s*\d+",
    re.IGNORECASE,
)
ADDRESS_NO_RE = re.compile(r"\bno\.?\s*\d+\b", re.IGNORECASE)

# Benign long strings in public mirror payloads (avoid false positives).
BENIGN_PUBLIC_VALUE_RE = re.compile(
    r"^https?://[A-Za-z0-9._\-/:%?&=#]+$",
    re.IGNORECASE,
)


def contains_address_like(value: str) -> bool:
    stripped = value.strip()
    if SHORT_ADDRESS_RE.search(stripped):
        return True
    lower = stripped.lower()
    if ADDRESS_NO_RE.search(lower) and ADDRESS_LIKE_RE.search(lower):
        return True
    if len(stripped) > 40 and ADDRESS_LIKE_RE.search(stripped):
        return True
    return False


def contains_tc_kimlik(value: str) -> bool:
    return bool(TC_KIMLIK_RE.search(value))


def contains_opaque_secret(value: str) -> bool:
    stripped = value.strip()
    if len(stripped) < 32:
        return False
    if BENIGN_PUBLIC_VALUE_RE.match(stripped):
        return False
    if OPENAI_KEY_RE.search(stripped):
        return True
    if BEARER_TOKEN_RE.search(stripped):
        return True
    if CREDENTIAL_QUERY_RE.search(stripped):
        return True
    if OPAQUE_SECRET_RE.search(stripped) and not stripped.startswith("http"):
        return True
    return False


def contains_pii_value(value: str) -> bool:
    """Return True if string value looks like PII or sensitive content."""
    if not value or not isinstance(value, str):
        return False
    stripped = value.strip()
    if not stripped:
        return False
    if CREDENTIAL_QUERY_RE.search(stripped):
        return True
    if BENIGN_PUBLIC_VALUE_RE.match(stripped):
        return False
    if EMAIL_RE.search(stripped):
        return True
    if JWT_LIKE_RE.search(stripped):
        return True
    if URL_WITH_CREDS_RE.search(stripped):
        return True
    if contains_tc_kimlik(stripped):
        return True
    if OPENAI_KEY_RE.search(stripped):
        return True
    if BEARER_TOKEN_RE.search(stripped):
        return True
    digits = re.sub(r"\D", "", stripped)
    if len(digits) >= 10 and PHONE_RE.search(stripped):
        return True
    if contains_address_like(stripped):
        return True
    if "password" in stripped.lower() and len(stripped) > 6:
        return True
    if contains_opaque_secret(stripped):
        return True
    return False
