# -*- coding: utf-8 -*-
"""
EZA v6 Multi-Model Router

Supports:
- OpenAI (openai-*)
- Groq (groq-*)
- Mistral (mistral-*)
"""
import asyncio
from typing import Dict, Any, List, Optional, Tuple
from backend.core.llm.providers.openai_client import OpenAIClient
from backend.core.llm.providers.groq_client import GroqClient
from backend.core.llm.providers.mistral_client import MistralClient
from backend.config import get_settings


class ModelRouter:
    """Multi-provider model router with timeout and retry"""
    
    def __init__(self):
        self.settings = get_settings()
        self.openai_client = OpenAIClient()
        self.groq_client = GroqClient()
        self.mistral_client = MistralClient()
        self.timeout = 12.0
        self.max_retries = 2
    
    def _get_provider_from_model_name(self, model_name: str) -> Tuple[str, str]:
        """
        Extract provider and actual model name from model_name
        
        Returns:
            (provider, actual_model_name)
        """
        if model_name.startswith("openai-"):
            provider = "openai"
            actual_model = model_name.replace("openai-", "")
        elif model_name.startswith("groq-"):
            provider = "groq"
            actual_model = model_name.replace("groq-", "")
        elif model_name.startswith("mistral-"):
            provider = "mistral"
            actual_model = model_name.replace("mistral-", "")
        else:
            # Default to OpenAI if no prefix
            provider = "openai"
            actual_model = model_name
        
        # Map to actual API model name
        supported_models = self.settings.SUPPORTED_MODELS
        if model_name in supported_models:
            actual_model = supported_models[model_name]
        
        return provider, actual_model
    
    async def generate(
        self,
        prompt: str,
        model_name: str,
        temperature: float = 0.2,
        max_tokens: int = 512,
        timeout: Optional[float] = None,
        retries: int = 2
    ) -> Dict[str, Any]:
        """
        Generate response from specified model with retry mechanism
        
        Args:
            prompt: Input prompt
            model_name: Model identifier (e.g., "openai-gpt4o-mini")
            temperature: Temperature for generation
            max_tokens: Maximum tokens to generate
            timeout: Timeout in seconds (default: 12.0)
            retries: Number of retries (default: 2)
        
        Returns:
            {
                "ok": bool,
                "output": str | None,
                "error": str | None,
                "provider": "openai" | "groq" | "mistral",
                "model_name": str
            }
        """
        provider, actual_model = self._get_provider_from_model_name(model_name)
        timeout_seconds = timeout or self.timeout
        max_retries = retries or self.max_retries
        
        last_error = None
        
        for attempt in range(max_retries + 1):
            try:
                if provider == "openai":
                    result = await self.openai_client.generate(
                        prompt=prompt,
                        model=actual_model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        timeout=timeout_seconds
                    )
                elif provider == "groq":
                    result = await self.groq_client.generate(
                        prompt=prompt,
                        model=actual_model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        timeout=timeout_seconds
                    )
                elif provider == "mistral":
                    result = await self.mistral_client.generate(
                        prompt=prompt,
                        model=actual_model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        timeout=timeout_seconds
                    )
                else:
                    return {
                        "ok": False,
                        "output": None,
                        "error": f"Unsupported provider: {provider}",
                        "provider": provider,
                        "model_name": model_name
                    }
                
                # If successful, return immediately
                if result["ok"]:
                    return result
                
                # If rate limit error, retry with delay
                if "rate limit" in result.get("error", "").lower():
                    last_error = result["error"]
                    if attempt < max_retries:
                        await asyncio.sleep(1.0 * (attempt + 1))  # Exponential backoff
                        continue
                
                # For other errors, return immediately
                return result
            
            except Exception as e:
                last_error = str(e)
                if attempt < max_retries:
                    await asyncio.sleep(0.5 * (attempt + 1))
                    continue
        
        # All retries exhausted
        return {
            "ok": False,
            "output": None,
            "error": f"Failed after {max_retries + 1} attempts: {last_error}",
            "provider": provider,
            "model_name": model_name
        }
    
    async def generate_ensemble(
        self,
        prompt: str,
        model_names: List[str],
        temperature: float = 0.2,
        max_tokens: int = 512,
        timeout: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate responses from multiple models in parallel (ensemble)
        
        Args:
            prompt: Input prompt
            model_names: List of model identifiers
            temperature: Temperature for generation
            max_tokens: Maximum tokens to generate
            timeout: Timeout per model (default: 12.0)
        
        Returns:
            List of results from each model
        """
        tasks = [
            self.generate(
                prompt=prompt,
                model_name=model_name,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout
            )
            for model_name in model_names
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Convert exceptions to error results
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append({
                    "ok": False,
                    "output": None,
                    "error": str(result),
                    "provider": "unknown",
                    "model_name": model_names[i]
                })
            else:
                processed_results.append(result)
        
        return processed_results

