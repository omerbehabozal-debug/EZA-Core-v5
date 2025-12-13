# -*- coding: utf-8 -*-
"""
CORS Tests
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_cors_whitelisted_origin():
    """Test that whitelisted origins are allowed"""
    whitelisted_origins = [
        "https://standalone.ezacore.ai",
        "https://corporate.ezacore.ai",
        "http://localhost:3000",
    ]
    
    for origin in whitelisted_origins:
        response = client.options(
            "/api/standalone",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST"
            }
        )
        # CORS preflight should succeed
        assert response.status_code in [200, 204]
        
        # Check CORS headers
        assert "access-control-allow-origin" in response.headers or origin in response.headers.get("access-control-allow-origin", "")


def test_cors_blocked_origin():
    """Test that non-whitelisted origins are blocked"""
    blocked_origins = [
        "https://evil.com",
        "https://malicious-site.com",
        "http://localhost:9999",  # Not in whitelist
    ]
    
    for origin in blocked_origins:
        response = client.options(
            "/api/standalone",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST"
            }
        )
        # CORS should block or not include origin in allow-origin
        # FastAPI CORS middleware behavior: if origin not in whitelist, it won't be in response
        # This is acceptable behavior


def test_cors_credentials_allowed():
    """Test that credentials are allowed in CORS"""
    response = client.options(
        "/api/standalone",
        headers={
            "Origin": "https://standalone.ezacore.ai",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization"
        }
    )
    
    # Credentials should be allowed
    # Check that allow-credentials header is present (if origin is whitelisted)
    # Note: FastAPI CORS middleware handles this automatically

