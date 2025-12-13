# -*- coding: utf-8 -*-
"""
Local LLM Provider (for self-hosted models)
"""

import httpx
from typing import Optional, Dict, Any
from backend.config import Settings


async def generate_local_llm(
    prompt: str,
    settings: Settings,
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: Optional[int] = None,
    **kwargs
) -> str:
    """Generate text using local LLM API"""
    if not settings.LOCAL_LLM_URL:
        raise ValueError("LOCAL_LLM_URL not configured")
    
    url = f"{settings.LOCAL_LLM_URL}/v1/chat/completions"
    
    payload = {
        "model": model or "local-model",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
    }
    
    if max_tokens:
        payload["max_tokens"] = max_tokens
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

