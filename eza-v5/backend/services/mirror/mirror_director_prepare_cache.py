# -*- coding: utf-8 -*-
"""Request-scoped cache for prepare-director-draft (PR C + production hardening).

Entries are keyed by generationRequestId but only returned when directorMode,
contentHash, and account/guest scope match. TTL unchanged (15 minutes).
"""

from __future__ import annotations

import threading
import time
from typing import Any

_LOCK = threading.Lock()
_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_TTL_SECONDS = 15 * 60
_MAX_ENTRIES = 256


def _normalize_scope(scope_key: str | None) -> str:
    value = (scope_key or "").strip()
    return value or "anonymous"


def cache_get(
    generation_request_id: str,
    *,
    director_mode: str,
    content_hash: str,
    scope_key: str | None,
) -> dict[str, Any] | None:
    now = time.time()
    scope = _normalize_scope(scope_key)
    with _LOCK:
        item = _CACHE.get(generation_request_id)
        if not item:
            return None
        ts, envelope = item
        if now - ts > _TTL_SECONDS:
            _CACHE.pop(generation_request_id, None)
            return None
        if envelope.get("directorMode") != director_mode:
            return None
        if envelope.get("contentHash") != content_hash:
            return None
        if envelope.get("scopeKey") != scope:
            return None
        payload = envelope.get("payload")
        if not isinstance(payload, dict):
            return None
        return dict(payload)


def cache_set(
    generation_request_id: str,
    payload: dict[str, Any],
    *,
    director_mode: str,
    content_hash: str,
    scope_key: str | None,
) -> None:
    scope = _normalize_scope(scope_key)
    envelope = {
        "directorMode": director_mode,
        "contentHash": content_hash,
        "scopeKey": scope,
        "payload": dict(payload),
    }
    with _LOCK:
        if len(_CACHE) >= _MAX_ENTRIES:
            oldest = sorted(_CACHE.items(), key=lambda kv: kv[1][0])[:64]
            for key, _ in oldest:
                _CACHE.pop(key, None)
        _CACHE[generation_request_id] = (time.time(), envelope)


def cache_clear_for_tests() -> None:
    with _LOCK:
        _CACHE.clear()
