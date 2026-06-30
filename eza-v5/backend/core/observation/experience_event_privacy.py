# -*- coding: utf-8 -*-
"""EZA Observation Architecture — experience event privacy filter."""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

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


def _is_forbidden_key(key: str) -> bool:
    return key.lower() in FORBIDDEN_CONTENT_KEYS


def _strip_forbidden(obj: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not obj or not isinstance(obj, dict):
        return None
    out: Dict[str, Any] = {}
    for k, v in obj.items():
        if _is_forbidden_key(k):
            continue
        if isinstance(v, str):
            if len(v) > 256:
                continue
            out[k] = v
        elif isinstance(v, dict):
            nested = _strip_forbidden(v)
            if nested:
                out[k] = nested
        elif isinstance(v, list):
            continue
        elif isinstance(v, (int, float, bool)) or v is None:
            out[k] = v
    return out or None


def validate_experience_payload(
    context: Optional[Dict[str, Any]],
    metrics: Optional[Dict[str, Any]],
) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """
    Reject payloads containing forbidden keys or oversized strings.

    Returns (ok, rejection_reason, cleaned_context, cleaned_metrics).
    """
    for section_name, section in (("context", context), ("metrics", metrics)):
        if not section:
            continue
        if not isinstance(section, dict):
            return False, "privacy_rejected", None, None
        for key, value in section.items():
            if _is_forbidden_key(key):
                return False, "privacy_rejected", None, None
            if isinstance(value, str) and len(value) > 256:
                return False, "privacy_rejected", None, None
            if isinstance(value, dict):
                for nested_key in value:
                    if _is_forbidden_key(nested_key):
                        return False, "privacy_rejected", None, None

    return True, None, _strip_forbidden(context), _strip_forbidden(metrics)


def build_privacy_json() -> Dict[str, Any]:
    return {
        "rawTextIncluded": False,
        "piiIncluded": False,
        "storageTier": "event",
    }
