# -*- coding: utf-8 -*-
"""
API Key Authentication Tests
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.config import get_settings

client = TestClient(app)


def test_test_results_endpoint_requires_api_key():
    """Test that /api/test-results/latest requires API key"""
    # Without API key
    response = client.get("/api/test-results/latest")
    assert response.status_code == 401
    
    # With invalid API key
    response = client.get(
        "/api/test-results/latest",
        headers={"X-Api-Key": "invalid_key"}
    )
    assert response.status_code == 401
    
    # With valid API key (if configured)
    settings = get_settings()
    admin_api_key = getattr(settings, "EZA_ADMIN_API_KEY", None)
    
    if admin_api_key:
        response = client.get(
            "/api/test-results/latest",
            headers={"X-Api-Key": admin_api_key}
        )
        assert response.status_code == 200
    else:
        # In dev mode, API key might not be required
        # This is acceptable for testing
        pass


def test_internal_endpoints_require_api_key():
    """Test that /api/internal/* endpoints require API key"""
    # Without API key
    response = client.post(
        "/api/internal/run",
        json={"text": "Test"}
    )
    assert response.status_code == 401
    
    # With valid API key (if configured)
    settings = get_settings()
    admin_api_key = getattr(settings, "EZA_ADMIN_API_KEY", None)
    
    if admin_api_key:
        response = client.post(
            "/api/internal/run",
            json={"text": "Test"},
            headers={"X-Api-Key": admin_api_key}
        )
        # Should be 200 or other error (not 401)
        assert response.status_code != 401

