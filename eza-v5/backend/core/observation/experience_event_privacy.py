# -*- coding: utf-8 -*-
"""EZA Observation — payload limits and value-based PII scanning."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

from backend.config import get_settings

# EZA observation layer never stores raw conversation or private mirror payload.
FORBIDDEN_CONTENT_KEYS = frozenset({
    "rawmessage",
    "messagetext",
    "assistantfullresponse",
    "fullconversation",
    "mirrorbody",
    "behavioralsnapshot",
    "email",
    "phone",
    "address",
    "tckimlik",
    "password",
    "privatepayload",
    "conversationmessages",
    "message",
    "content",
    "text",
    "raw_output",
    "query",
    "query_value",
    "user_input",
    "assistant_answer",
    "safe_answer",
    "output_text",
    "transcript",
    "body",
    "prompt",
    "shareurl",
    "private_payload",
    "corecuriosity",
    "intelligencebrief",
    "topicsummary",
})

ALLOWED_CONTEXT_ENUM_KEYS = frozenset({
    "surface",
    "source",
    "category",
    "mood",
    "groupid",
})

ALLOWED_SURFACE_VALUES = frozenset({
    "conversation",
    "mirror",
    "landing",
    "share",
    "sidebar",
    "pattern",
})

ALLOWED_SOURCE_VALUES = frozenset({
    "direct",
    "mirror",
    "branch",
})

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
    r"\b(?:sokak|sok\.|cadde|cad\.|mahalle|mah\.|apt\.|apartment|street|avenue|ave\.)\b",
    re.IGNORECASE,
)


def _limits() -> Dict[str, int]:
    settings = get_settings()
    return {
        "max_string_len": int(getattr(settings, "EXPERIENCE_EVENT_MAX_STRING_LEN", 128) or 128),
        "max_context_keys": int(getattr(settings, "EXPERIENCE_EVENT_MAX_CONTEXT_KEYS", 12) or 12),
        "max_metrics_keys": int(getattr(settings, "EXPERIENCE_EVENT_MAX_METRICS_KEYS", 12) or 12),
        "max_nesting_depth": int(getattr(settings, "EXPERIENCE_EVENT_MAX_NESTING_DEPTH", 2) or 2),
        "max_body_bytes": int(getattr(settings, "EXPERIENCE_EVENT_MAX_BODY_BYTES", 4096) or 4096),
    }


def _is_forbidden_key(key: str) -> bool:
    return key.lower() in FORBIDDEN_CONTENT_KEYS


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
    if len(stripped) > 40 and ADDRESS_LIKE_RE.search(stripped):
        return True
    if "password" in stripped.lower() and len(stripped) > 6:
        return True
    return False


def scan_string_fields(fields: Dict[str, Optional[str]]) -> Tuple[bool, Optional[str]]:
    """Scan top-level identifier strings for PII values."""
    limits = _limits()
    for key, value in fields.items():
        if value is None:
            continue
        if not isinstance(value, str):
            return False, "privacy_rejected"
        if len(value) > limits["max_string_len"]:
            return False, "privacy_rejected"
        if contains_pii_value(value):
            return False, "privacy_rejected"
    return True, None


def _sanitize_context_value(key: str, value: Any, limits: Dict[str, int]) -> Optional[Any]:
    kl = key.lower()
    if kl == "surface" and isinstance(value, str):
        v = value.lower()
        return v if v in ALLOWED_SURFACE_VALUES else None
    if kl == "source" and isinstance(value, str):
        v = value.lower()
        return v if v in ALLOWED_SOURCE_VALUES else None
    if kl in ("category", "mood") and isinstance(value, str):
        v = value.strip().lower()
        if not v or len(v) > 32 or contains_pii_value(v):
            return None
        if not re.fullmatch(r"[a-z0-9_\-]+", v):
            return None
        return v
    if kl == "groupid" and isinstance(value, str):
        if len(value) > limits["max_string_len"] or contains_pii_value(value):
            return None
        return value
    return None


def _walk_section(
    obj: Optional[Dict[str, Any]],
    *,
    section: str,
    depth: int = 0,
) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
    if not obj:
        return True, None, None
    if not isinstance(obj, dict):
        return False, "privacy_rejected", None

    limits = _limits()
    max_keys = limits["max_context_keys"] if section == "context" else limits["max_metrics_keys"]
    if len(obj) > max_keys:
        return False, "payload_too_large", None
    if depth > limits["max_nesting_depth"]:
        return False, "payload_too_large", None

    out: Dict[str, Any] = {}
    for key, value in obj.items():
        if _is_forbidden_key(key):
            return False, "privacy_rejected", None

        if section == "context":
            if key.lower() not in ALLOWED_CONTEXT_ENUM_KEYS:
                return False, "privacy_rejected", None
            sanitized = _sanitize_context_value(key, value, limits)
            if sanitized is None:
                return False, "privacy_rejected", None
            out[key] = sanitized
            continue

        if section == "metrics":
            if isinstance(value, bool):
                out[key] = value
            elif isinstance(value, int) and not isinstance(value, bool):
                if abs(value) > 1_000_000:
                    return False, "privacy_rejected", None
                out[key] = value
            elif isinstance(value, float):
                out[key] = value
            else:
                return False, "privacy_rejected", None
            continue

        if isinstance(value, str):
            if len(value) > limits["max_string_len"] or contains_pii_value(value):
                return False, "privacy_rejected", None
            out[key] = value
        elif isinstance(value, dict):
            ok, reason, nested = _walk_section(value, section=section, depth=depth + 1)
            if not ok:
                return False, reason, None
            if nested:
                out[key] = nested
        elif isinstance(value, (int, float, bool)) or value is None:
            out[key] = value
        else:
            return False, "privacy_rejected", None

    return True, None, out or None


def validate_experience_payload(
    context: Optional[Dict[str, Any]],
    metrics: Optional[Dict[str, Any]],
) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]], Optional[Dict[str, Any]], Dict[str, Any]]:
    """
    Reject payloads with forbidden keys, PII values, or excessive size.

    Returns (ok, rejection_reason, cleaned_context, cleaned_metrics, privacy_json).
  """
    ok_ctx, reason_ctx, cleaned_context = _walk_section(context, section="context")
    if not ok_ctx:
        return False, reason_ctx, None, None, {}

    ok_met, reason_met, cleaned_metrics = _walk_section(metrics, section="metrics")
    if not ok_met:
        return False, reason_met, None, None, {}

    privacy_json = build_privacy_json(pii_scan_passed=True)
    return True, None, cleaned_context, cleaned_metrics, privacy_json


def build_privacy_json(*, pii_scan_passed: bool) -> Dict[str, Any]:
    return {
        "rawTextIncluded": False,
        "piiIncluded": not pii_scan_passed,
        "piiScanPassed": pii_scan_passed,
        "storageTier": "event",
    }


def validate_body_size(content_length: Optional[int]) -> Tuple[bool, Optional[str]]:
    if content_length is None:
        return True, None
    try:
        size = int(content_length)
    except (TypeError, ValueError):
        return False, "payload_too_large"
    if size > _limits()["max_body_bytes"]:
        return False, "payload_too_large"
    return True, None
