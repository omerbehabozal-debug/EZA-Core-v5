# -*- coding: utf-8 -*-
"""
EZA Proxy - Rate Limiter (Token Bucket per org_id)
Enforced before any LLM call

If limit exceeded:
- return Stage-0 result only
- mark response as "partial": true
- Emit Prometheus metrics
"""

import logging
import time
from typing import Dict, Optional
from threading import Lock
from collections import defaultdict
from backend.config import get_settings

logger = logging.getLogger(__name__)

# Token bucket per org_id
_token_buckets: Dict[str, Dict[str, float]] = defaultdict(lambda: {
    "tokens": 0.0,
    "last_refill": time.time()
})
_bucket_lock = Lock()

# Prometheus metrics (will be exposed via observability.py)
_rate_limit_dropped_count = 0
_rate_limit_dropped_lock = Lock()


def _refill_bucket(org_id: str, settings):
    """Refill token bucket based on time elapsed"""
    now = time.time()
    bucket = _token_buckets[org_id]
    last_refill = bucket["last_refill"]
    
    # Calculate tokens to add (per second refill rate)
    elapsed = now - last_refill
    rpm_limit = settings.ORG_RPM_LIMIT
    tpm_limit = settings.ORG_TPM_LIMIT
    burst = settings.RATE_LIMIT_BURST
    
    # Refill rate: RPM / 60 seconds
    requests_per_second = rpm_limit / 60.0
    tokens_per_second = tpm_limit / 60.0
    
    # Add tokens (capped at burst + normal capacity)
    bucket["tokens"] = min(
        bucket["tokens"] + (requests_per_second * elapsed),
        burst + rpm_limit  # Max capacity
    )
    bucket["last_refill"] = now


def check_rate_limit(
    org_id: str,
    estimated_tokens: int = 0,
    settings = None
) -> tuple[bool, Optional[str]]:
    """
    Check if request is within rate limit
    
    Args:
        org_id: Organization ID
        estimated_tokens: Estimated token usage for this request
        settings: Settings object (optional, will fetch if not provided)
    
    Returns:
        (allowed: bool, reason: Optional[str])
        - allowed: True if request can proceed
        - reason: Error message if not allowed
    """
    if settings is None:
        settings = get_settings()
    
    with _bucket_lock:
        _refill_bucket(org_id, settings)
        bucket = _token_buckets[org_id]
        
        # Check if we have enough tokens
        required_tokens = 1.0  # 1 request token
        if bucket["tokens"] < required_tokens:
            # Rate limit exceeded
            global _rate_limit_dropped_count
            with _rate_limit_dropped_lock:
                _rate_limit_dropped_count += 1
            
            logger.warning(
                f"[RateLimit] Rate limit exceeded for org_id={org_id}: "
                f"tokens={bucket['tokens']:.2f}, required={required_tokens}"
            )
            return False, f"Rate limit exceeded: {settings.ORG_RPM_LIMIT} requests/minute"
        
        # Consume tokens
        bucket["tokens"] -= required_tokens
        
        logger.debug(
            f"[RateLimit] Request allowed for org_id={org_id}: "
            f"remaining_tokens={bucket['tokens']:.2f}"
        )
        return True, None


def get_rate_limit_metrics() -> Dict[str, int]:
    """Get rate limit metrics for Prometheus"""
    with _rate_limit_dropped_lock:
        return {
            "rate_limit_dropped_total": _rate_limit_dropped_count
        }


def reset_rate_limit_metrics():
    """Reset rate limit metrics (for testing)"""
    global _rate_limit_dropped_count
    with _rate_limit_dropped_lock:
        _rate_limit_dropped_count = 0
    with _bucket_lock:
        _token_buckets.clear()

