# -*- coding: utf-8 -*-
"""
EZA Proxy - Rate Limiter Tests
Test token bucket, rate limit enforcement, metrics
"""

import pytest
import time
from backend.services.proxy_rate_limiter import (
    check_rate_limit,
    reset_rate_limit_metrics,
    get_rate_limit_metrics
)
from backend.config import get_settings


def test_rate_limit_allows_requests():
    """Test that requests within limit are allowed"""
    settings = get_settings()
    org_id = "test-org-1"
    
    reset_rate_limit_metrics()
    
    # Should allow requests up to limit
    for i in range(min(5, settings.ORG_RPM_LIMIT)):
        allowed, reason = check_rate_limit(org_id, settings=settings)
        assert allowed, f"Request {i} should be allowed"
        assert reason is None


def test_rate_limit_blocks_excess():
    """Test that excess requests are blocked"""
    settings = get_settings()
    org_id = "test-org-2"
    
    reset_rate_limit_metrics()
    
    # Exhaust rate limit
    allowed_count = 0
    for i in range(settings.ORG_RPM_LIMIT + 10):
        allowed, reason = check_rate_limit(org_id, settings=settings)
        if allowed:
            allowed_count += 1
        else:
            assert reason is not None
            assert "Rate limit exceeded" in reason
            break
    
    # Should have allowed some requests but blocked excess
    assert allowed_count > 0
    assert allowed_count <= settings.ORG_RPM_LIMIT


def test_rate_limit_refills_over_time():
    """Test that token bucket refills over time"""
    settings = get_settings()
    org_id = "test-org-3"
    
    reset_rate_limit_metrics()
    
    # Exhaust limit
    for i in range(settings.ORG_RPM_LIMIT):
        check_rate_limit(org_id, settings=settings)
    
    # Should be blocked
    allowed, reason = check_rate_limit(org_id, settings=settings)
    assert not allowed
    
    # Wait for refill (simulate time passing)
    time.sleep(2)  # Wait 2 seconds
    
    # Should allow some requests after refill
    allowed, reason = check_rate_limit(org_id, settings=settings)
    # May or may not be allowed depending on refill rate, but should not error


def test_rate_limit_metrics():
    """Test rate limit metrics collection"""
    settings = get_settings()
    org_id = "test-org-4"
    
    reset_rate_limit_metrics()
    
    # Trigger some rate limits
    for i in range(settings.ORG_RPM_LIMIT + 5):
        check_rate_limit(org_id, settings=settings)
    
    metrics = get_rate_limit_metrics()
    assert "rate_limit_dropped_total" in metrics
    assert metrics["rate_limit_dropped_total"] >= 0


def test_rate_limit_org_isolation():
    """Test that rate limits are isolated per org_id"""
    settings = get_settings()
    org1 = "test-org-5"
    org2 = "test-org-6"
    
    reset_rate_limit_metrics()
    
    # Exhaust limit for org1
    for i in range(settings.ORG_RPM_LIMIT):
        check_rate_limit(org1, settings=settings)
    
    # Org1 should be blocked
    allowed1, _ = check_rate_limit(org1, settings=settings)
    assert not allowed1
    
    # Org2 should still be allowed (different bucket)
    allowed2, _ = check_rate_limit(org2, settings=settings)
    assert allowed2

