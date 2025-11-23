# -*- coding: utf-8 -*-
"""
Gateway Router Adapter - Unified interface for LLM providers
"""

from typing import Optional, Dict, Any
from backend.config import Settings, get_settings
from backend.gateway.providers.openai_provider import generate_openai
from backend.gateway.providers.anthropic_provider import generate_anthropic
from backend.gateway.providers.local_llm_provider import generate_local_llm
from backend.gateway.error_mapping import map_provider_error, LLMProviderError


async def call_llm_provider(
    provider_name: str,
    prompt: str,
    settings: Optional[Settings] = None,
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Call LLM provider with unified interface
    
    Args:
        provider_name: "openai", "anthropic", or "local"
        prompt: Input prompt
        settings: Settings instance (uses get_settings() if None)
        model: Model name (provider-specific defaults if None)
        temperature: Sampling temperature
        max_tokens: Max tokens to generate
        metadata: Optional metadata dict
    
    Returns:
        Generated text
    
    Raises:
        LLMProviderError: If provider call fails
    """
    if settings is None:
        settings = get_settings()
    
    # Provider selection logic
    if provider_name == "openai":
        try:
            return await generate_openai(
                prompt=prompt,
                settings=settings,
                model=model or "gpt-4",
                temperature=temperature,
                max_tokens=max_tokens
            )
        except Exception as e:
            raise map_provider_error(e, "openai")
    
    elif provider_name == "anthropic":
        try:
            return await generate_anthropic(
                prompt=prompt,
                settings=settings,
                model=model or "claude-3-opus-20240229",
                temperature=temperature,
                max_tokens=max_tokens
            )
        except Exception as e:
            raise map_provider_error(e, "anthropic")
    
    elif provider_name == "local":
        try:
            return await generate_local_llm(
                prompt=prompt,
                settings=settings,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens
            )
        except Exception as e:
            raise map_provider_error(e, "local")
    
    else:
        raise LLMProviderError(
            message=f"Unknown provider: {provider_name}",
            provider=provider_name
        )

