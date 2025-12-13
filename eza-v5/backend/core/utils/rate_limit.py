# -*- coding: utf-8 -*-
"""
Rate Limiting Utilities
Production-ready rate limiting for Standalone mode
"""

from fastapi import HTTPException, status
import time
from typing import Dict, List


# In-memory rate limit storage
# In production, use Redis for distributed rate limiting
RATE_LIMIT: Dict[str, List[float]] = {}


def check_rate_limit(client_id: str, limit: int = 5, window: int = 3):
    """
    Check if client has exceeded rate limit.
    
    Args:
        client_id: Client identifier (IP address or user ID)
        limit: Maximum number of requests allowed
        window: Time window in seconds
    
    Raises:
        HTTPException: If rate limit exceeded
    """
    now = time.time()
    
    # Get existing calls for this client
    calls = RATE_LIMIT.get(client_id, [])
    
    # Filter out calls outside the time window
    calls = [c for c in calls if now - c < window]
    
    # Check if limit exceeded
    if len(calls) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please slow down."
        )
    
    # Add current call
    calls.append(now)
    RATE_LIMIT[client_id] = calls


def reset_rate_limit(client_id: str):
    """Reset rate limit for a client (for testing/admin purposes)"""
    if client_id in RATE_LIMIT:
        del RATE_LIMIT[client_id]

