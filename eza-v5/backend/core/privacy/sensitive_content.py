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


def contains_pii_value(value: str) -> bool:
    """Return True if string value looks like PII or sensitive content."""
    if not value or not isinstance(value, str):
        return False
    stripped = value.strip()
    if not stripped:
        return False
    if EMAIL_RE.search(stripped):
        return True
    if JWT_LIKE_RE.search(stripped):
        return True
    if URL_WITH_CREDS_RE.search(stripped):
        return True
    if TC_KIMLIK_RE.fullmatch(stripped):
        return True
    digits = re.sub(r"\D", "", stripped)
    if len(digits) >= 10 and PHONE_RE.search(stripped):
        return True
    if contains_address_like(stripped):
        return True
    if "password" in stripped.lower() and len(stripped) > 6:
        return True
    return False
