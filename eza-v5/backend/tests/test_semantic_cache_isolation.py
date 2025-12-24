# -*- coding: utf-8 -*-
"""
EZA Proxy - Semantic Cache Isolation Tests
Test that semantic cache is isolated per org_id
"""

import pytest
from backend.infra.cache_registry import (
    set_semantic_cache,
    get_semantic_cache,
    clear_org_cache
)


def test_semantic_cache_org_isolation():
    """Test that semantic cache entries are isolated per org_id"""
    org1 = "test-org-1"
    org2 = "test-org-2"
    content = "Test content"
    domain = "media"
    
    # Set cache for org1
    data1 = {"risk_band": "high", "org": "1"}
    set_semantic_cache(org1, content, domain, data1)
    
    # Set cache for org2 (same content, different org)
    data2 = {"risk_band": "low", "org": "2"}
    set_semantic_cache(org2, content, domain, data2)
    
    # Should retrieve correct data for each org
    cached1 = get_semantic_cache(org1, content, domain)
    cached2 = get_semantic_cache(org2, content, domain)
    
    assert cached1 == data1
    assert cached2 == data2
    assert cached1 != cached2  # Different data per org


def test_semantic_cache_never_crosses_orgs():
    """Test that cache entries never cross org boundaries"""
    org1 = "test-org-3"
    org2 = "test-org-4"
    content = "Shared content"
    domain = "media"
    
    # Set cache for org1 only
    data1 = {"risk_band": "medium"}
    set_semantic_cache(org1, content, domain, data1)
    
    # Org2 should not see org1's cache
    cached2 = get_semantic_cache(org2, content, domain)
    assert cached2 is None  # Should be None, not org1's data


def test_clear_org_cache():
    """Test clearing cache for specific org"""
    org1 = "test-org-5"
    org2 = "test-org-6"
    content = "Test content"
    domain = "media"
    
    # Set cache for both orgs
    set_semantic_cache(org1, content, domain, {"data": "1"})
    set_semantic_cache(org2, content, domain, {"data": "2"})
    
    # Clear org1's cache
    clear_org_cache(org1)
    
    # Org1 should have no cache
    cached1 = get_semantic_cache(org1, content, domain)
    assert cached1 is None
    
    # Org2 should still have cache
    cached2 = get_semantic_cache(org2, content, domain)
    assert cached2 is not None

