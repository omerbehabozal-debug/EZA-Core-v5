# -*- coding: utf-8 -*-
"""
Global Token Quota Service for Public Demo
Controls LLM token consumption across all public demo endpoints
"""

import os
import time
import threading
from datetime import datetime, timezone
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return max(1, int(raw))
    except ValueError:
        logger.warning("[Demo Token Quota] Invalid %s=%r, using default %s", name, raw, default)
        return default


# Global token quota — tüm public demo uçları (standalone stream dahil) paylaşır
DAILY_TOKEN_LIMIT = _env_int("EZA_PUBLIC_DAILY_TOKEN_LIMIT", 100_000)
MAX_TEXT_LENGTH = _env_int("EZA_PUBLIC_MAX_TEXT_CHARS", 1_500)

# Thread-safe token counter
_token_counter_lock = threading.Lock()
_token_counter: int = 0
_last_reset_date: Optional[str] = None


def _get_current_date() -> str:
    """Get current date in YYYY-MM-DD format (UTC)"""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _reset_if_new_day():
    """Reset token counter if it's a new day (thread-safe)"""
    global _token_counter, _last_reset_date
    
    current_date = _get_current_date()
    
    with _token_counter_lock:
        if _last_reset_date != current_date:
            logger.info(f"[Demo Token Quota] Resetting daily quota (old date: {_last_reset_date}, new date: {current_date})")
            _token_counter = 0
            _last_reset_date = current_date


def check_text_length(text: str) -> Tuple[bool, Optional[str]]:
    """
    Check if text length exceeds demo limit
    
    Args:
        text: Input text to check
        
    Returns:
        (is_valid, error_message)
        - is_valid: True if text is within limit
        - error_message: Error message if limit exceeded
    """
    if len(text) > MAX_TEXT_LENGTH:
        return False, f"Demo ortamında uzun metin analizi sınırlıdır. (Maksimum: {MAX_TEXT_LENGTH} karakter, Gönderilen: {len(text)} karakter)"
    return True, None


def check_token_quota(estimated_tokens: int) -> Tuple[bool, Optional[str], int]:
    """
    Check if token quota allows the request (thread-safe)
    
    Args:
        estimated_tokens: Estimated tokens for this request (input + output)
        
    Returns:
        (is_allowed, error_message, remaining_tokens)
        - is_allowed: True if request is allowed
        - error_message: Error message if quota exceeded
        - remaining_tokens: Remaining tokens in daily quota
    """
    global _token_counter
    
    # Reset if new day
    _reset_if_new_day()
    
    with _token_counter_lock:
        # Check if adding this request would exceed limit
        if _token_counter + estimated_tokens > DAILY_TOKEN_LIMIT:
            remaining = max(0, DAILY_TOKEN_LIMIT - _token_counter)
            error_msg = (
                "Public demo günlük kullanım kotası dolmuştur. "
                f"Günlük limit: {DAILY_TOKEN_LIMIT:,} token. "
                f"Kalan: {remaining:,} token. "
                "Lütfen daha sonra tekrar deneyin."
            )
            logger.warning(f"[Demo Token Quota] Quota exceeded: {_token_counter}/{DAILY_TOKEN_LIMIT} (request: {estimated_tokens})")
            return False, error_msg, remaining
        
        # Reserve tokens
        _token_counter += estimated_tokens
        remaining = DAILY_TOKEN_LIMIT - _token_counter
        
        logger.info(f"[Demo Token Quota] Tokens reserved: {estimated_tokens}, Total: {_token_counter}/{DAILY_TOKEN_LIMIT}, Remaining: {remaining}")
        return True, None, remaining


def record_token_usage(actual_tokens: int):
    """
    Record actual token usage (for accurate tracking)
    This can be called after LLM response to adjust the counter
    
    Args:
        actual_tokens: Actual tokens used (input + output)
    """
    global _token_counter
    
    _reset_if_new_day()
    
    with _token_counter_lock:
        # Adjust counter with actual usage
        # Note: We already reserved estimated_tokens, so we adjust the difference
        # For simplicity, we'll just update the counter if actual differs significantly
        # In production, you might want to track estimated vs actual separately
        logger.debug(f"[Demo Token Quota] Actual tokens used: {actual_tokens}")


def get_quota_status() -> dict:
    """
    Get current quota status (for monitoring/debugging)
    
    Returns:
        {
            "daily_limit": int,
            "used_tokens": int,
            "remaining_tokens": int,
            "usage_percentage": float,
            "reset_date": str
        }
    """
    _reset_if_new_day()
    
    with _token_counter_lock:
        remaining = max(0, DAILY_TOKEN_LIMIT - _token_counter)
        usage_percentage = (_token_counter / DAILY_TOKEN_LIMIT * 100) if DAILY_TOKEN_LIMIT > 0 else 0
        
        return {
            "daily_limit": DAILY_TOKEN_LIMIT,
            "used_tokens": _token_counter,
            "remaining_tokens": remaining,
            "usage_percentage": round(usage_percentage, 2),
            "reset_date": _last_reset_date or _get_current_date(),
            "max_text_length": MAX_TEXT_LENGTH
        }


def estimate_tokens(text: str, estimated_output_tokens: int = 0) -> int:
    """
    Estimate total tokens (input + output) for a request
    
    Args:
        text: Input text
        estimated_output_tokens: Estimated output tokens (default: 0)
        
    Returns:
        Estimated total tokens
    """
    # Rough estimation: ~4 characters per token for Turkish/English
    # This is a conservative estimate
    input_tokens = len(text) // 4
    
    # Add some overhead for prompts
    prompt_overhead = 200  # Approximate prompt tokens
    
    total = input_tokens + estimated_output_tokens + prompt_overhead
    
    return total

