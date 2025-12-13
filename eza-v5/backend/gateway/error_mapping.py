# -*- coding: utf-8 -*-
"""
Error Mapping - Map provider-specific errors to unified LLMProviderError
"""

import httpx
from typing import Optional


class LLMProviderError(Exception):
    """Unified LLM provider error"""
    def __init__(self, message: str, provider: str, status_code: Optional[int] = None):
        self.message = message
        self.provider = provider
        self.status_code = status_code
        super().__init__(self.message)


def map_provider_error(error: Exception, provider: str) -> LLMProviderError:
    """Map provider-specific errors to LLMProviderError"""
    if isinstance(error, httpx.HTTPStatusError):
        status_code = error.response.status_code
        try:
            error_detail = error.response.json().get("error", {}).get("message", str(error))
        except:
            error_detail = str(error)
        
        return LLMProviderError(
            message=f"{provider} API error: {error_detail}",
            provider=provider,
            status_code=status_code
        )
    elif isinstance(error, httpx.RequestError):
        return LLMProviderError(
            message=f"{provider} connection error: {str(error)}",
            provider=provider,
            status_code=None
        )
    else:
        return LLMProviderError(
            message=f"{provider} error: {str(error)}",
            provider=provider,
            status_code=None
        )

