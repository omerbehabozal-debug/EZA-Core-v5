# -*- coding: utf-8 -*-
"""
JWT Authentication Tests
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.auth.jwt import create_jwt, decode_jwt, get_user_from_token
from backend.auth.models import UserRole

client = TestClient(app)


def test_create_and_decode_jwt():
    """Test JWT token creation and decoding"""
    user_id = 1
    role: UserRole = "admin"
    
    token = create_jwt(user_id, role)
    assert token is not None
    assert isinstance(token, str)
    
    payload = decode_jwt(token)
    assert payload is not None
    assert payload.get("sub") == str(user_id)
    assert payload.get("role") == role


def test_decode_invalid_jwt():
    """Test decoding invalid JWT token"""
    invalid_token = "invalid.token.here"
    payload = decode_jwt(invalid_token)
    assert payload is None


def test_get_user_from_token():
    """Test extracting user info from token"""
    user_id = 123
    role: UserRole = "corporate"
    
    token = create_jwt(user_id, role)
    user_info = get_user_from_token(token)
    
    assert user_info is not None
    assert user_info["user_id"] == user_id
    assert user_info["role"] == role


def test_standalone_endpoint_no_auth_required():
    """Test that standalone endpoint doesn't require authentication"""
    response = client.post(
        "/api/standalone",
        json={"text": "Hello, world!"}
    )
    # Should work without auth (rate limit might apply)
    assert response.status_code in [200, 429]  # 200 OK or 429 rate limit


def test_proxy_endpoint_requires_admin():
    """Test that proxy endpoint requires admin role"""
    # Without token
    response = client.post(
        "/api/proxy",
        json={"message": "Test message"}
    )
    assert response.status_code == 401  # Unauthorized
    
    # With invalid token
    response = client.post(
        "/api/proxy",
        json={"message": "Test message"},
        headers={"Authorization": "Bearer invalid_token"}
    )
    assert response.status_code == 401
    
    # With corporate token (should fail)
    corporate_token = create_jwt(1, "corporate")
    response = client.post(
        "/api/proxy",
        json={"message": "Test message"},
        headers={"Authorization": f"Bearer {corporate_token}"}
    )
    assert response.status_code == 403  # Forbidden (wrong role)
    
    # With admin token (should succeed if rate limit allows)
    admin_token = create_jwt(1, "admin")
    response = client.post(
        "/api/proxy",
        json={"message": "Test message"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    # Should be 200 or 429 (rate limit)
    assert response.status_code in [200, 429]


def test_proxy_lite_requires_corporate_or_admin():
    """Test that proxy-lite endpoint requires corporate or admin role"""
    # Without token
    response = client.post(
        "/api/proxy-lite",
        json={"message": "Test message"}
    )
    assert response.status_code == 401
    
    # With regulator token (should fail)
    regulator_token = create_jwt(1, "regulator")
    response = client.post(
        "/api/proxy-lite",
        json={"message": "Test message"},
        headers={"Authorization": f"Bearer {regulator_token}"}
    )
    assert response.status_code == 403
    
    # With corporate token (should succeed)
    corporate_token = create_jwt(1, "corporate")
    response = client.post(
        "/api/proxy-lite",
        json={"message": "Test message"},
        headers={"Authorization": f"Bearer {corporate_token}"}
    )
    assert response.status_code in [200, 429]  # 200 OK or rate limit
    
    # With admin token (should succeed)
    admin_token = create_jwt(1, "admin")
    response = client.post(
        "/api/proxy-lite",
        json={"message": "Test message"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code in [200, 429]


def test_monitor_endpoints_require_auth():
    """Test that monitor endpoints require authentication"""
    # Live feed - requires admin
    response = client.get("/api/monitor/live-feed")
    assert response.status_code == 401
    
    admin_token = create_jwt(1, "admin")
    response = client.get(
        "/api/monitor/live-feed",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code in [200, 429]
    
    # Corporate feed - requires corporate or admin
    response = client.get("/api/monitor/corporate-feed")
    assert response.status_code == 401
    
    corporate_token = create_jwt(1, "corporate")
    response = client.get(
        "/api/monitor/corporate-feed",
        headers={"Authorization": f"Bearer {corporate_token}"}
    )
    assert response.status_code in [200, 429]
    
    # Regulator feed - requires regulator or admin
    response = client.get("/api/monitor/regulator-feed")
    assert response.status_code == 401
    
    regulator_token = create_jwt(1, "regulator")
    response = client.get(
        "/api/monitor/regulator-feed",
        headers={"Authorization": f"Bearer {regulator_token}"}
    )
    assert response.status_code in [200, 429]

