# -*- coding: utf-8 -*-
"""
Anthropic Provider
"""

import httpx
from typing import Optional, Dict, Any
from backend.config import Settings


async def generate_anthropic(
    prompt: str,
    settings: Settings,
    model: str = "claude-3-opus-20240229",
    temperature: float = 0.7,
    max_tokens: Optional[int] = 1000,
    **kwargs
) -> str:
    """Generate text using Anthropic API"""
    if not settings.ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY not configured")
    
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": settings.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": model,
        "max_tokens": max_tokens or 1000,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
        return data["content"][0]["text"]

