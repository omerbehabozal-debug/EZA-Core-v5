# -*- coding: utf-8 -*-
"""Security validation for durable standalone conversation metadata — 8.8G-1.1."""

from __future__ import annotations

import re
from typing import Any, Optional

from fastapi import HTTPException

# Exact normalized keys that must never be persisted in generic tree/message metadata.
_FORBIDDEN_EXACT_KEYS = frozenset(
    {
        "lineageprooftoken",
        "continuationprooftoken",
        "prooftoken",
        "sessiontoken",
        "authtoken",
        "accesstoken",
        "refreshtoken",
        "bearertoken",
        "jwt",
        "authorization",
        "cookie",
        "sessionid",
        "csrftoken",
        "idtoken",
        "apisecret",
        "secret",
        "password",
        "credential",
        "credentials",
    }
)

# Substrings that indicate security-bearing keys (normalized alnum-only match).
_FORBIDDEN_KEY_SUBSTRINGS = (
    "prooftoken",
    "sessiontoken",
    "authtoken",
    "accesstoken",
    "refreshtoken",
    "bearertoken",
    "lineageproof",
    "continuationproof",
    "authorization",
    "bearer",
    "jwt",
    "password",
    "credential",
    "csrftoken",
    "sessionid",
)

_NORMALIZE_RE = re.compile(r"[^a-z0-9]+")


def _normalize_key(key: str) -> str:
    return _NORMALIZE_RE.sub("", str(key).lower())


def _is_forbidden_metadata_key(key: str) -> bool:
    normalized = _normalize_key(key)
    if not normalized:
        return False
    if normalized in _FORBIDDEN_EXACT_KEYS:
        return True
    return any(fragment in normalized for fragment in _FORBIDDEN_KEY_SUBSTRINGS)


def find_forbidden_metadata_key(value: Any) -> Optional[str]:
    """Return the first forbidden key name found anywhere in nested metadata."""
    if isinstance(value, dict):
        for key, nested in value.items():
            if _is_forbidden_metadata_key(str(key)):
                return str(key)
            found = find_forbidden_metadata_key(nested)
            if found is not None:
                return found
    elif isinstance(value, list):
        for item in value:
            found = find_forbidden_metadata_key(item)
            if found is not None:
                return found
    return None


def reject_forbidden_metadata(value: dict[str, Any] | None, *, field_name: str = "metadata") -> None:
    """Reject requests that attempt to persist security-bearing metadata keys."""
    if value is None:
        return
    forbidden = find_forbidden_metadata_key(value)
    if forbidden is not None:
        raise HTTPException(
            status_code=422,
            detail=f"forbidden_{field_name}_key",
        )
