# -*- coding: utf-8 -*-
"""EZA Observation — rate limiting for experience event ingest."""

from __future__ import annotations

import logging
import time
from typing import Optional

from fastapi import Request

from backend.config import get_settings
from backend.security.rate_limit import RateLimitError, get_trusted_client_ip

logger = logging.getLogger(__name__)

_in_memory_limits: dict[str, list[float]] = {}


async def _rate_limit_key(key: str, *, limit: int, window: int) -> None:
    current_time = time.time()

    try:
        from backend.core.utils.dependencies import get_redis

        redis_client = await get_redis()
        if redis_client:
            pipe = redis_client.pipeline()
            pipe.zremrangebyscore(key, 0, current_time - window)
            pipe.zcard(key)
            pipe.zadd(key, {str(current_time): current_time})
            pipe.expire(key, window)
            results = await pipe.execute()
            count = results[1]
            if count >= limit:
                raise RateLimitError("Experience event rate limit exceeded")
            return
    except RateLimitError:
        raise
    except Exception as exc:
        logger.warning("Experience event Redis rate limit fallback: %s", exc)

    if key not in _in_memory_limits:
        _in_memory_limits[key] = []
    _in_memory_limits[key] = [
        ts for ts in _in_memory_limits[key] if ts > current_time - window
    ]
    if len(_in_memory_limits[key]) >= limit:
        raise RateLimitError("Experience event rate limit exceeded")
    _in_memory_limits[key].append(current_time)


async def rate_limit_experience_events(
    request: Request,
    *,
    user_id: Optional[str] = None,
    guest_token_hash: Optional[str] = None,
) -> None:
    settings = get_settings()
    limit = int(getattr(settings, "EXPERIENCE_EVENT_RATE_LIMIT_PER_MIN", 60) or 60)
    limit = max(2, min(limit, 1000))
    ip = get_trusted_client_ip(request)
    user_part = user_id or "anon"
    guest_part = (guest_token_hash or "none")[:16]
    key = f"experience_events:{ip}:{user_part}:{guest_part}"
    await _rate_limit_key(key, limit=limit, window=60)
