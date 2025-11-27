# -*- coding: utf-8 -*-
"""Mistral Provider Client"""
import os
import asyncio
from typing import Optional, Dict, Any
import httpx
from backend.config import get_settings


class MistralClient:
    """Mistral API client"""
    
    def __init__(self):
        settings = get_settings()
        self.api_key = settings.MISTRAL_API_KEY or os.getenv("MISTRAL_API_KEY")
        self.base_url = "https://api.mistral.ai/v1/chat/completions"
        self.timeout = 12.0
        self.connect_timeout = 4.0
    
    async def generate(
        self,
        prompt: str,
        model: str,
        temperature: float = 0.2,
        max_tokens: int = 512,
        timeout: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Generate response from Mistral
        
        Returns:
            {
                "ok": bool,
                "output": str | None,
                "error": str | None,
                "provider": "mistral",
                "model_name": str
            }
        """
        if not self.api_key:
            return {
                "ok": False,
                "output": None,
                "error": "MISTRAL_API_KEY not configured",
                "provider": "mistral",
                "model_name": model
            }
        
        timeout_seconds = timeout or self.timeout
        
        try:
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                response = await client.post(
                    self.base_url,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": temperature,
                        "max_tokens": max_tokens
                    },
                    timeout=timeout_seconds
                )
                
                if response.status_code == 200:
                    data = response.json()
                    output = data["choices"][0]["message"]["content"]
                    return {
                        "ok": True,
                        "output": output,
                        "error": None,
                        "provider": "mistral",
                        "model_name": model
                    }
                elif response.status_code == 429:
                    # Rate limit - retryable
                    return {
                        "ok": False,
                        "output": None,
                        "error": "Mistral API rate limit exceeded",
                        "provider": "mistral",
                        "model_name": model
                    }
                else:
                    error_msg = f"Mistral API error: {response.status_code} - {response.text}"
                    return {
                        "ok": False,
                        "output": None,
                        "error": error_msg,
                        "provider": "mistral",
                        "model_name": model
                    }
        
        except httpx.TimeoutException:
            return {
                "ok": False,
                "output": None,
                "error": "Mistral API timeout",
                "provider": "mistral",
                "model_name": model
            }
        except Exception as e:
            return {
                "ok": False,
                "output": None,
                "error": f"Mistral API error: {str(e)}",
                "provider": "mistral",
                "model_name": model
            }

