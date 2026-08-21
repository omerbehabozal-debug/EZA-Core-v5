# -*- coding: utf-8 -*-
"""
Rate Limiting
Redis-based rate limiting with in-memory fallback
"""

from typing import Optional
from fastapi import Request, HTTPException, status
import logging
import time

from backend.config import get_settings
from backend.core.utils.dependencies import get_redis

logger = logging.getLogger(__name__)


class RateLimitError(HTTPException):
    """Rate limit exceeded exception"""
    def __init__(self, message: str = "Rate limit exceeded"):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "ok": False,
                "error": "rate_limit",
                "message": message
            }
        )


# In-memory rate limit storage (fallback when Redis is unavailable)
_in_memory_limits: dict[str, list[float]] = {}


def _get_client_ip(request: Request) -> str:
    """Extract client IP from request (honors X-Forwarded-For when present)."""
    # Check for forwarded IP (behind proxy)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    # Check for real IP
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    # Fallback to direct client
    if request.client:
        return request.client.host

    return "unknown"


def get_trusted_client_ip(request: Request) -> str:
    """
    Client IP for abuse-sensitive endpoints.

    X-Forwarded-For is used only when TRUSTED_PROXY_HEADERS_ENABLED=true.
    """
    settings = get_settings()
    if bool(getattr(settings, "TRUSTED_PROXY_HEADERS_ENABLED", False)):
        return _get_client_ip(request)
    if request.client:
        return request.client.host
    return "unknown"


async def rate_limit(
    request: Request,
    limit: int,
    window: int,
    key_prefix: str = "rate_limit",
    *,
    bucket_id: Optional[str] = None,
    quiet: bool = False,
) -> None:
    """
    Rate limit check using Redis or in-memory fallback
    
    Args:
        request: FastAPI request object
        limit: Maximum number of requests
        window: Time window in seconds
        key_prefix: Redis key prefix
        bucket_id: Optional opaque bucket (no raw IP). Defaults to client IP.
        quiet: When True, do not log network source on exceed/fallback.
    
    Raises:
        RateLimitError if limit exceeded
    """
    client_ip = _get_client_ip(request)
    bucket = bucket_id if bucket_id is not None else client_ip

    # Create rate limit key
    key = f"{key_prefix}:{bucket}"
    current_time = time.time()
    
    # Try Redis first
    try:
        redis_client = await get_redis()
        
        if redis_client:
            # Use Redis for rate limiting
            pipe = redis_client.pipeline()
            
            # Remove expired entries
            pipe.zremrangebyscore(key, 0, current_time - window)
            
            # Count current requests
            pipe.zcard(key)
            
            # Add current request
            pipe.zadd(key, {str(current_time): current_time})
            
            # Set expiration
            pipe.expire(key, window)
            
            results = await pipe.execute()
            count = results[1]
            
            if count >= limit:
                if not quiet:
                    logger.warning(f"Rate limit exceeded for {client_ip}: {count}/{limit} in {window}s")
                raise RateLimitError(f"Rate limit exceeded: {limit} requests per {window} seconds")
            
            return
    
    except RateLimitError:
        raise
    except Exception as e:
        if not quiet:
            logger.warning(f"Redis rate limiting failed, using in-memory fallback: {str(e)}")
    
    # Fallback to in-memory rate limiting
    if key not in _in_memory_limits:
        _in_memory_limits[key] = []
    
    # Remove expired entries
    _in_memory_limits[key] = [
        timestamp
        for timestamp in _in_memory_limits[key]
        if timestamp > current_time - window
    ]
    
    # Check limit
    if len(_in_memory_limits[key]) >= limit:
        if not quiet:
            logger.warning(f"Rate limit exceeded (in-memory) for {client_ip}: {len(_in_memory_limits[key])}/{limit} in {window}s")
        raise RateLimitError(f"Rate limit exceeded: {limit} requests per {window} seconds")
    
    # Add current request
    _in_memory_limits[key].append(current_time)


# Predefined rate limit configurations
async def rate_limit_standalone(request: Request) -> None:
    """Rate limit for standalone: default 10 requests / 60s per IP (env: EZA_STANDALONE_RATE_PER_MIN)"""
    import os

    limit = 10
    raw = os.getenv("EZA_STANDALONE_RATE_PER_MIN", "").strip()
    if raw:
        try:
            limit = max(3, min(30, int(raw)))
        except ValueError:
            pass
    await rate_limit(request, limit=limit, window=60, key_prefix="standalone")


async def rate_limit_proxy(request: Request) -> None:
    """Rate limit for proxy endpoint: 15 requests / 60s"""
    await rate_limit(request, limit=15, window=60, key_prefix="proxy")


async def rate_limit_regulator_feed(request: Request) -> None:
    """Rate limit for regulator feed: 10 requests / 60s"""
    await rate_limit(request, limit=10, window=60, key_prefix="regulator_feed")


async def rate_limit_ws_handshake(request: Request) -> None:
    """Rate limit for WebSocket handshake: 20 requests / 120s"""
    await rate_limit(request, limit=20, window=120, key_prefix="ws_handshake")


async def rate_limit_proxy_corporate(request: Request) -> None:
    """Rate limit for EZA Proxy corporate endpoint: 5 requests / 60s (strict)"""
    await rate_limit(request, limit=5, window=60, key_prefix="proxy_corporate")


# Phase 8.8.1 — client ops telemetry abuse bound (per opaque network bucket).
OPS_CLIENT_RATE_LIMIT = 40
OPS_CLIENT_RATE_WINDOW_SECONDS = 60


async def rate_limit_ops_client(request: Request) -> None:
    """
    Quiet rate limit for POST /api/ops/client-event.

    Bucket = SHA-256 prefix of trusted client IP (ephemeral operational key only).
    Never logs IP, UA, email, or user id.
    Redis when available (shared across workers); else in-process per-worker fallback.
    """
    import hashlib

    raw = get_trusted_client_ip(request)
    bucket = hashlib.sha256(f"ops_client:{raw}".encode("utf-8")).hexdigest()[:16]
    await rate_limit(
        request,
        limit=OPS_CLIENT_RATE_LIMIT,
        window=OPS_CLIENT_RATE_WINDOW_SECONDS,
        key_prefix="ops_client",
        bucket_id=bucket,
        quiet=True,
    )


def reset_in_memory_rate_limits_for_tests() -> None:
    """Test helper — clear in-memory buckets (does not touch Redis)."""
    _in_memory_limits.clear()
