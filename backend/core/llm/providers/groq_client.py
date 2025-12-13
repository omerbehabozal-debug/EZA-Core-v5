# -*- coding: utf-8 -*-
"""Groq Provider Client"""
import os
import asyncio
from typing import Optional, Dict, Any
import httpx
from backend.config import get_settings


class GroqClient:
    """Groq API client"""
    
    def __init__(self):
        settings = get_settings()
        self.api_key = settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY")
        self.base_url = "https://api.groq.com/openai/v1/chat/completions"
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
        Generate response from Groq
        
        Returns:
            {
                "ok": bool,
                "output": str | None,
                "error": str | None,
                "provider": "groq",
                "model_name": str
            }
        """
        if not self.api_key:
            return {
                "ok": False,
                "output": None,
                "error": "GROQ_API_KEY not configured",
                "provider": "groq",
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
                        "provider": "groq",
                        "model_name": model
                    }
                elif response.status_code == 429:
                    # Rate limit - retryable
                    return {
                        "ok": False,
                        "output": None,
                        "error": "Groq API rate limit exceeded",
                        "provider": "groq",
                        "model_name": model
                    }
                else:
                    error_msg = f"Groq API error: {response.status_code} - {response.text}"
                    return {
                        "ok": False,
                        "output": None,
                        "error": error_msg,
                        "provider": "groq",
                        "model_name": model
                    }
        
        except httpx.TimeoutException:
            return {
                "ok": False,
                "output": None,
                "error": "Groq API timeout",
                "provider": "groq",
                "model_name": model
            }
        except Exception as e:
            return {
                "ok": False,
                "output": None,
                "error": f"Groq API error: {str(e)}",
                "provider": "groq",
                "model_name": model
            }

