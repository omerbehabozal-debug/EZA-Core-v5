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
    """Extract client IP from request"""
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


async def rate_limit(
    request: Request,
    limit: int,
    window: int,
    key_prefix: str = "rate_limit"
) -> None:
    """
    Rate limit check using Redis or in-memory fallback
    
    Args:
        request: FastAPI request object
        limit: Maximum number of requests
        window: Time window in seconds
        key_prefix: Redis key prefix
    
    Raises:
        RateLimitError if limit exceeded
    """
    settings = get_settings()
    client_ip = _get_client_ip(request)
    
    # Create rate limit key
    key = f"{key_prefix}:{client_ip}"
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
                logger.warning(f"Rate limit exceeded for {client_ip}: {count}/{limit} in {window}s")
                raise RateLimitError(f"Rate limit exceeded: {limit} requests per {window} seconds")
            
            return
    
    except Exception as e:
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
        logger.warning(f"Rate limit exceeded (in-memory) for {client_ip}: {len(_in_memory_limits[key])}/{limit} in {window}s")
        raise RateLimitError(f"Rate limit exceeded: {limit} requests per {window} seconds")
    
    # Add current request
    _in_memory_limits[key].append(current_time)


# Predefined rate limit configurations
async def rate_limit_standalone(request: Request) -> None:
    """Rate limit for standalone endpoint: 40 requests / 60s"""
    await rate_limit(request, limit=40, window=60, key_prefix="standalone")


async def rate_limit_proxy(request: Request) -> None:
    """Rate limit for proxy endpoint: 15 requests / 60s"""
    await rate_limit(request, limit=15, window=60, key_prefix="proxy")


async def rate_limit_regulator_feed(request: Request) -> None:
    """Rate limit for regulator feed: 10 requests / 60s"""
    await rate_limit(request, limit=10, window=60, key_prefix="regulator_feed")


async def rate_limit_ws_handshake(request: Request) -> None:
    """Rate limit for WebSocket handshake: 20 requests / 120s"""
    await rate_limit(request, limit=20, window=120, key_prefix="ws_handshake")

