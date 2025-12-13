# -*- coding: utf-8 -*-
"""
Request Client for Testing
Common HTTP client for test requests
"""

import httpx
from typing import Dict, Any, Optional
import asyncio


class TestRequestClient:
    """HTTP client for test requests"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.client: Optional[httpx.AsyncClient] = None
    
    async def __aenter__(self):
        self.client = httpx.AsyncClient(base_url=self.base_url, timeout=30.0)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.client:
            await self.client.aclose()
    
    async def post(self, endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """POST request"""
        if not self.client:
            raise RuntimeError("Client not initialized. Use async context manager.")
        
        response = await self.client.post(endpoint, json=data)
        response.raise_for_status()
        return response.json()
    
    async def get(self, endpoint: str) -> Dict[str, Any]:
        """GET request"""
        if not self.client:
            raise RuntimeError("Client not initialized. Use async context manager.")
        
        response = await self.client.get(endpoint)
        response.raise_for_status()
        return response.json()


async def make_test_request(endpoint: str, data: Dict[str, Any], base_url: str = "http://localhost:8000") -> Dict[str, Any]:
    """Convenience function for making test requests"""
    async with TestRequestClient(base_url) as client:
        return await client.post(endpoint, data)

