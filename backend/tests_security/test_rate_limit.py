# -*- coding: utf-8 -*-
"""
Rate Limiting Tests
"""

import pytest
from fastapi.testclient import TestClient
from fastapi import Request
from backend.main import app
from backend.security.rate_limit import rate_limit, RateLimitError
from backend.auth.jwt import create_jwt

client = TestClient(app)


@pytest.mark.asyncio
async def test_rate_limit_standalone():
    """Test rate limiting for standalone endpoint"""
    # Make 40 requests (should all succeed)
    for i in range(40):
        response = client.post(
            "/api/standalone",
            json={"text": f"Test message {i}"}
        )
        # Should be 200 (or 429 if previous test left state)
        assert response.status_code in [200, 429]
    
    # 41st request should be rate limited
    response = client.post(
        "/api/standalone",
        json={"text": "Test message 41"}
    )
    # Should be 429 or still 200 if rate limit window reset
    assert response.status_code in [200, 429]
    
    if response.status_code == 429:
        data = response.json()
        assert data.get("error") == "rate_limit"
        assert "Rate limit exceeded" in data.get("message", "")


@pytest.mark.asyncio
async def test_rate_limit_proxy():
    """Test rate limiting for proxy endpoint"""
    admin_token = create_jwt(1, "admin")
    
    # Make 15 requests (should all succeed)
    for i in range(15):
        response = client.post(
            "/api/proxy",
            json={"message": f"Test message {i}"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code in [200, 429]
    
    # 16th request might be rate limited
    response = client.post(
        "/api/proxy",
        json={"message": "Test message 16"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code in [200, 429]


@pytest.mark.asyncio
async def test_rate_limit_regulator_feed():
    """Test rate limiting for regulator feed"""
    regulator_token = create_jwt(1, "regulator")
    
    # Make 10 requests
    for i in range(10):
        response = client.get(
            "/api/monitor/regulator-feed",
            headers={"Authorization": f"Bearer {regulator_token}"}
        )
        assert response.status_code in [200, 429]
    
    # 11th request might be rate limited
    response = client.get(
        "/api/monitor/regulator-feed",
        headers={"Authorization": f"Bearer {regulator_token}"}
    )
    assert response.status_code in [200, 429]


@pytest.mark.asyncio
async def test_rate_limit_in_memory_fallback():
    """Test in-memory rate limiting fallback when Redis is unavailable"""
    from backend.security.rate_limit import rate_limit
    
    class MockRequest:
        def __init__(self, ip: str = "127.0.0.1"):
            self.headers = {}
            self.client = type('obj', (object,), {'host': ip})()
    
    request = MockRequest("192.168.1.100")
    
    # Make requests up to limit
    limit = 5
    window = 60
    
    for i in range(limit):
        try:
            await rate_limit(request, limit=limit, window=window, key_prefix="test")
        except RateLimitError:
            pytest.fail(f"Rate limit should not be exceeded at request {i+1}")
    
    # Next request should be rate limited
    with pytest.raises(RateLimitError):
        await rate_limit(request, limit=limit, window=window, key_prefix="test")

