# -*- coding: utf-8 -*-
"""Request-scoped cache for prepare-director-draft (PR C)."""

from __future__ import annotations

import threading
import time
from typing import Any

_LOCK = threading.Lock()
_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_TTL_SECONDS = 15 * 60
_MAX_ENTRIES = 256


def cache_get(generation_request_id: str) -> dict[str, Any] | None:
    now = time.time()
    with _LOCK:
        item = _CACHE.get(generation_request_id)
        if not item:
            return None
        ts, payload = item
        if now - ts > _TTL_SECONDS:
            _CACHE.pop(generation_request_id, None)
            return None
        return dict(payload)


def cache_set(generation_request_id: str, payload: dict[str, Any]) -> None:
    with _LOCK:
        if len(_CACHE) >= _MAX_ENTRIES:
            # Drop oldest
            oldest = sorted(_CACHE.items(), key=lambda kv: kv[1][0])[:64]
            for key, _ in oldest:
                _CACHE.pop(key, None)
        _CACHE[generation_request_id] = (time.time(), dict(payload))


def cache_clear_for_tests() -> None:
    with _LOCK:
        _CACHE.clear()
