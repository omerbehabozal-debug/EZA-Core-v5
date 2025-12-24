# -*- coding: utf-8 -*-
"""
EZA Proxy - Policy Cache Invalidation Tests
Test cache invalidation on policy changes
"""

import pytest
from backend.infra.cache_registry import (
    set_policy_cache,
    get_policy_cache,
    invalidate_policy_cache
)


def test_policy_cache_invalidation():
    """Test that policy cache is invalidated correctly"""
    org_id = "test-org-1"
    policies = ["TRT", "FINTECH"]
    domain = "media"
    
    # Set cache
    data = {"test": "data"}
    set_policy_cache(org_id, policies, domain, data)
    
    # Should retrieve cached data
    cached = get_policy_cache(org_id, policies, domain)
    assert cached == data
    
    # Invalidate cache
    invalidate_policy_cache(org_id, reason="policy_version_change")
    
    # Should not retrieve cached data
    cached_after = get_policy_cache(org_id, policies, domain)
    assert cached_after is None


def test_policy_cache_org_isolation():
    """Test that policy cache is isolated per org_id"""
    org1 = "test-org-2"
    org2 = "test-org-3"
    policies = ["TRT"]
    domain = "media"
    
    # Set cache for org1
    data1 = {"org": "1"}
    set_policy_cache(org1, policies, domain, data1)
    
    # Set cache for org2
    data2 = {"org": "2"}
    set_policy_cache(org2, policies, domain, data2)
    
    # Should retrieve correct data for each org
    cached1 = get_policy_cache(org1, policies, domain)
    cached2 = get_policy_cache(org2, policies, domain)
    
    assert cached1 == data1
    assert cached2 == data2
    
    # Invalidate org1 should not affect org2
    invalidate_policy_cache(org1)
    
    cached1_after = get_policy_cache(org1, policies, domain)
    cached2_after = get_policy_cache(org2, policies, domain)
    
    assert cached1_after is None
    assert cached2_after == data2  # Still cached

