# -*- coding: utf-8 -*-
"""
EZA v6 Multi-Model Router
Mod bazlı model routing: standalone=ensemble, proxy=openai, proxy-lite=openai

Model ID format: provider/model-name
- openai/gpt-4o-mini
- groq/llama3-8b-tool-use  
- mistral/mistral-7b-instruct
"""

import asyncio
import logging
from typing import Dict, Any, List, Optional, Tuple, Literal
from backend.core.llm.providers.openai_client import OpenAIClient
from backend.core.llm.providers.groq_client import GroqClient
from backend.core.llm.providers.mistral_client import MistralClient
from backend.config import get_settings

logger = logging.getLogger(__name__)


class ModelRouter:
    """
    Multi-provider model router with mode-based routing
    
    Routing Rules:
    - standalone mode → ensemble (OpenAI + Mistral + Groq)
    - proxy mode → OpenAI tek
    - proxy-lite mode → OpenAI tek
    
    API key yoksa → model skip et (fail etmesin)
    Timeout → gracefully fallback
    """
    
    def __init__(self):
        """Initialize router with provider clients"""
        self.settings = get_settings()
        
        # Initialize clients (API key kontrolü client içinde yapılır)
        self.openai_client = OpenAIClient()
        self.groq_client = GroqClient()
        self.mistral_client = MistralClient()
        
        self.timeout = self.settings.LLM_TIMEOUT_SECONDS
        self.max_retries = 2
        
        # Model ID mappings (provider/model-name format)
        self.model_mappings = {
            "openai/gpt-4o-mini": "gpt-4o-mini",
            "groq/llama3-8b-tool-use": "llama3-8b-8192",
            "mistral/mistral-7b-instruct": "mistral-tiny"
        }
        
        # Check which models are available (API keys loaded)
        self.available_models = self._check_available_models()
        logger.info(f"ModelRouter initialized. Available models: {self.available_models}")
    
    def _check_available_models(self) -> List[str]:
        """Check which models have API keys available"""
        available = []
        
        if self.settings.OPENAI_API_KEY:
            available.append("openai/gpt-4o-mini")
        
        if self.settings.GROQ_API_KEY:
            available.append("groq/llama3-8b-tool-use")
        
        if self.settings.MISTRAL_API_KEY:
            available.append("mistral/mistral-7b-instruct")
        
        return available
    
    def is_model_available(self, model_id: str) -> bool:
        """Check if a model is available (has API key)"""
        return model_id in self.available_models
    
    def _get_provider_from_model_id(self, model_id: str) -> Tuple[str, str]:
        """
        Extract provider and actual model name from model_id
        
        Args:
            model_id: Model identifier (e.g., "openai/gpt-4o-mini")
        
        Returns:
            (provider, actual_model_name)
        """
        if "/" in model_id:
            provider, model_name = model_id.split("/", 1)
        elif model_id.startswith("openai-"):
            provider = "openai"
            model_name = model_id.replace("openai-", "")
        elif model_id.startswith("groq-"):
            provider = "groq"
            model_name = model_id.replace("groq-", "")
        elif model_id.startswith("mistral-"):
            provider = "mistral"
            model_name = model_id.replace("mistral-", "")
        else:
            # Default to OpenAI if no prefix
            provider = "openai"
            model_name = model_id
        
        # Map to actual API model name
        if model_id in self.model_mappings:
            actual_model = self.model_mappings[model_id]
        elif model_id in self.settings.SUPPORTED_MODELS:
            actual_model = self.settings.SUPPORTED_MODELS[model_id]
        else:
            actual_model = model_name
        
        return provider, actual_model
    
    async def generate(
        self,
        prompt: str,
        model_id: str,
        temperature: float = 0.2,
        max_tokens: int = 512,
        timeout: Optional[float] = None,
        retries: int = 2
    ) -> Dict[str, Any]:
        """
        Generate response from specified model with retry mechanism
        
        Args:
            prompt: Input prompt
            model_id: Model identifier (e.g., "openai/gpt-4o-mini")
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
                "model_id": str,
                "skipped": bool  # True if model was skipped (no API key)
            }
        """
        provider, actual_model = self._get_provider_from_model_id(model_id)
        timeout_seconds = timeout or self.timeout
        max_retries = retries or self.max_retries
        
        # Check if model is available (has API key)
        if not self.is_model_available(model_id):
            logger.warning(f"Model {model_id} skipped: API key not available")
            return {
                "ok": False,
                "output": None,
                "error": f"API key not configured for {provider}",
                "provider": provider,
                "model_id": model_id,
                "skipped": True
            }
        
        last_error = None
        
        for attempt in range(max_retries + 1):
            try:
                # Route to appropriate provider
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
                        "model_id": model_id,
                        "skipped": False
                    }
                
                # Add model_id to result
                result["model_id"] = model_id
                result["skipped"] = False
                
                # If successful, return immediately
                if result["ok"]:
                    return result
                
                # If rate limit error, retry with delay
                if "rate limit" in result.get("error", "").lower():
                    last_error = result["error"]
                    if attempt < max_retries:
                        await asyncio.sleep(1.0 * (attempt + 1))  # Exponential backoff
                        continue
                
                # For timeout errors, try fallback
                if "timeout" in result.get("error", "").lower():
                    last_error = result["error"]
                    if attempt < max_retries:
                        await asyncio.sleep(0.5 * (attempt + 1))
                        continue
                
                # For other errors, return immediately
                return result
            
            except Exception as e:
                last_error = str(e)
                logger.error(f"Model {model_id} error (attempt {attempt + 1}): {str(e)}")
                if attempt < max_retries:
                    await asyncio.sleep(0.5 * (attempt + 1))
                    continue
        
        # All retries exhausted
        return {
            "ok": False,
            "output": None,
            "error": f"Failed after {max_retries + 1} attempts: {last_error}",
            "provider": provider,
            "model_id": model_id,
            "skipped": False
        }
    
    async def generate_ensemble(
        self,
        prompt: str,
        model_ids: List[str],
        temperature: float = 0.2,
        max_tokens: int = 512,
        timeout: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate responses from multiple models in parallel (ensemble)
        
        Args:
            prompt: Input prompt
            model_ids: List of model identifiers (e.g., ["openai/gpt-4o-mini", "groq/llama3-8b-tool-use"])
            temperature: Temperature for generation
            max_tokens: Maximum tokens to generate
            timeout: Timeout per model (default: 12.0)
        
        Returns:
            List of results from each model (skipped models included with skipped=True)
        """
        tasks = [
            self.generate(
                prompt=prompt,
                model_id=model_id,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout
            )
            for model_id in model_ids
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Convert exceptions to error results
        processed_results = []
        skipped_models = []
        used_models = []
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append({
                    "ok": False,
                    "output": None,
                    "error": str(result),
                    "provider": "unknown",
                    "model_id": model_ids[i],
                    "skipped": False
                })
            else:
                processed_results.append(result)
                if result.get("skipped"):
                    skipped_models.append(model_ids[i])
                elif result.get("ok"):
                    used_models.append(model_ids[i])
        
        logger.info(f"Ensemble results: {len(used_models)}/{len(model_ids)} successful, {len(skipped_models)} skipped")
        
        return processed_results
    
    async def route_by_mode(
        self,
        prompt: str,
        mode: Literal["standalone", "proxy", "proxy-lite"],
        temperature: float = 0.2,
        max_tokens: int = 512,
        timeout: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Route to appropriate model(s) based on mode
        
        Routing Rules:
        - standalone: ensemble (OpenAI + Mistral + Groq)
        - proxy: OpenAI tek
        - proxy-lite: OpenAI tek
        
        Args:
            prompt: Input prompt
            mode: Pipeline mode
            temperature: Temperature for generation
            max_tokens: Maximum tokens to generate
            timeout: Timeout per model
        
        Returns:
            {
                "ok": bool,
                "output": str | None,
                "error": str | None,
                "provider": str,
                "model_id": str | List[str],
                "skipped_models": List[str],
                "used_models": List[str]
            }
        """
        if mode == "standalone":
            # Standalone: ensemble (3 models)
            ensemble_models = [
                "openai/gpt-4o-mini",
                "mistral/mistral-7b-instruct",
                "groq/llama3-8b-tool-use"
            ]
            
            # Filter to only available models
            available_ensemble = [m for m in ensemble_models if self.is_model_available(m)]
            
            if not available_ensemble:
                return {
                    "ok": False,
                    "output": None,
                    "error": "No models available (all API keys missing)",
                    "provider": "ensemble",
                    "model_id": ensemble_models,
                    "skipped_models": ensemble_models,
                    "used_models": []
                }
            
            # Generate from all available models
            results = await self.generate_ensemble(
                prompt=prompt,
                model_ids=available_ensemble,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout
            )
            
            # Extract skipped and used models
            skipped_models = [r["model_id"] for r in results if r.get("skipped")]
            used_models = [r["model_id"] for r in results if r.get("ok")]
            
            # Get successful outputs
            successful_results = [r for r in results if r.get("ok") and r.get("output")]
            
            if not successful_results:
                # All models failed
                errors = [r.get("error", "Unknown error") for r in results]
                return {
                    "ok": False,
                    "output": None,
                    "error": f"All models failed: {', '.join(errors)}",
                    "provider": "ensemble",
                    "model_id": available_ensemble,
                    "skipped_models": skipped_models,
                    "used_models": used_models
                }
            
            # Return first successful result (merger will handle ensemble merge)
            # For now, return the first successful one
            best_result = successful_results[0]
            return {
                "ok": True,
                "output": best_result["output"],
                "error": None,
                "provider": "ensemble",
                "model_id": available_ensemble,
                "skipped_models": skipped_models,
                "used_models": used_models,
                "ensemble_results": results  # Include all results for merger
            }
        
        else:
            # Proxy and proxy-lite: OpenAI tek
            model_id = "openai/gpt-4o-mini"
            
            if not self.is_model_available(model_id):
                return {
                    "ok": False,
                    "output": None,
                    "error": "OPENAI_API_KEY not configured",
                    "provider": "openai",
                    "model_id": model_id,
                    "skipped_models": [model_id],
                    "used_models": []
                }
            
            result = await self.generate(
                prompt=prompt,
                model_id=model_id,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout
            )
            
            # Add mode-specific fields
            result["skipped_models"] = [model_id] if result.get("skipped") else []
            result["used_models"] = [model_id] if result.get("ok") else []
            
            return result


# Helper function for test compatibility
def is_model_available(provider: str) -> bool:
    """
    Check if a provider has API key available
    
    Args:
        provider: Provider name ("openai", "groq", "mistral")
    
    Returns:
        True if API key is available
    """
    settings = get_settings()
    
    if provider.lower() == "openai":
        return bool(settings.OPENAI_API_KEY)
    elif provider.lower() == "groq":
        return bool(settings.GROQ_API_KEY)
    elif provider.lower() == "mistral":
        return bool(settings.MISTRAL_API_KEY)
    
    return False

