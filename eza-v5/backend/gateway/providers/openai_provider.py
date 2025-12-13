# -*- coding: utf-8 -*-
"""
OpenAI Provider
"""

import httpx
from typing import Optional, Dict, Any
from backend.config import Settings


async def generate_openai(
    prompt: str,
    settings: Settings,
    model: str = "gpt-4",
    temperature: float = 0.7,
    max_tokens: Optional[int] = None,
    **kwargs
) -> str:
    """Generate text using OpenAI API"""
    if not settings.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY not configured")
    
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
    }
    
    if max_tokens:
        payload["max_tokens"] = max_tokens
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

