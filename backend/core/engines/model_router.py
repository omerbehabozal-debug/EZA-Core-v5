"""
EZA v5 - Model Router

Şu an için tek sağlayıcı: OpenAI

Env değişkenleri:

  LLM_PROVIDER=openai

  LLM_API_KEY=...

  LLM_MODEL=gpt-4o-mini (veya istediğin başka bir model)

Bu dosya:

- Standalone FAST Core pipeline

- Proxy (fast/deep) modları

tarafından kullanılacak temel LLM çağrı katmanıdır.

AŞAMA 1:

  Tek sağlayıcı (OpenAI) ile çalışır.

AŞAMA 2 ve sonrası:

  - Multi-LLM ensemble

  - reliability matrix

  - merge engine

  - provider bazlı routing

bu dosyanın içine genişletilerek eklenecek.

"""

from __future__ import annotations

import os
import time
from typing import Literal, Optional, Dict, Any

import httpx

from backend.core.utils.telemetry import log_llm_call
from backend.config import get_settings
from backend.gateway.router_adapter import call_llm_provider as gateway_call_llm
from backend.gateway.error_mapping import LLMProviderError as GatewayLLMProviderError


# ---------------------------------------------------------------------------
# EXCEPTIONS
# ---------------------------------------------------------------------------

class LLMProviderError(Exception):
    """Custom exception for LLM provider errors"""
    
    def __init__(self, provider: str, message: str, *, is_retryable: bool = False):
        self.provider = provider
        self.is_retryable = is_retryable
        super().__init__(f"[{provider}] {message}")


# ---------------------------------------------------------------------------
# ENV CONFIG
# ---------------------------------------------------------------------------

# Get settings instance for environment variables
_settings = get_settings()

LLM_PROVIDER: str = _settings.DEFAULT_LLM_PROVIDER.lower()
LLM_API_KEY: Optional[str] = _settings.OPENAI_API_KEY  # Use OPENAI_API_KEY from Settings
LLM_MODEL: str = _settings.LLM_MODEL  # Use LLM_MODEL from Settings

# OpenAI chat completions endpoint (OpenAI'nin yeni API adresine göre güncellenebilir)
OPENAI_BASE_URL = "https://api.openai.com/v1/chat/completions"

DepthMode = Literal["fast", "deep"]


# ---------------------------------------------------------------------------
# LOW LEVEL CLIENTS
# ---------------------------------------------------------------------------

async def _call_openai_chat(
    prompt: str,
    *,
    temperature: float = 0.2,
    max_tokens: int = 512,
    timeout_seconds: float = 12.0,
    mode: str = "standalone",
) -> str:
    """
    OpenAI Chat Completions çağrısı.

    NOT:
    - Burada sadece tek mesajlı, basit bir interface kullanıyoruz.
      Standalone / Proxy pipeline mesaj geçmişini üst seviyede birleştirip
      buraya tek string prompt olarak gönderiyor.
    
    Raises:
        LLMProviderError: For provider-specific errors with retry information
    """
    if not LLM_API_KEY:
        raise LLMProviderError(
            provider="openai",
            message="OPENAI_API_KEY not configured in .env file or environment variables.",
            is_retryable=False
        )

    headers = {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Content-Type": "application/json",
    }

    payload: Dict[str, Any] = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    timeout = httpx.Timeout(timeout_seconds, connect=4.0)
    
    # Start timing
    t0 = time.perf_counter()
    duration_ms = 0.0
    error_msg = None
    
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                OPENAI_BASE_URL,
                headers=headers,
                json=payload,
            )
            
            # Calculate duration
            duration_ms = (time.perf_counter() - t0) * 1000
            
            # Handle HTTP errors
            if resp.status_code >= 500:
                # Server errors - retryable
                error_msg = f"Server error: {resp.status_code}"
                log_llm_call(
                    provider="openai",
                    model=LLM_MODEL,
                    duration_ms=duration_ms,
                    ok=False,
                    error=error_msg,
                    mode=mode
                )
                raise LLMProviderError(
                    provider="openai",
                    message=f"OpenAI server error: {resp.status_code}",
                    is_retryable=True
                )
            
            elif resp.status_code == 429:
                # Rate limit - retryable
                error_msg = "Rate limit exceeded"
                log_llm_call(
                    provider="openai",
                    model=LLM_MODEL,
                    duration_ms=duration_ms,
                    ok=False,
                    error=error_msg,
                    mode=mode
                )
                raise LLMProviderError(
                    provider="openai",
                    message="Rate limit exceeded. Please retry later.",
                    is_retryable=True
                )
            
            elif resp.status_code in (401, 403):
                # Auth/config errors - not retryable
                error_msg = f"Authentication error: {resp.status_code}"
                log_llm_call(
                    provider="openai",
                    model=LLM_MODEL,
                    duration_ms=duration_ms,
                    ok=False,
                    error=error_msg,
                    mode=mode
                )
                raise LLMProviderError(
                    provider="openai",
                    message="Authentication or configuration error. Check API key.",
                    is_retryable=False
                )
            
            elif resp.status_code >= 400:
                # Other client errors - not retryable
                error_msg = f"Client error: {resp.status_code}"
                try:
                    error_data = resp.json()
                    error_detail = error_data.get("error", {}).get("message", "Unknown error")
                except:
                    error_detail = resp.text[:200]
                
                log_llm_call(
                    provider="openai",
                    model=LLM_MODEL,
                    duration_ms=duration_ms,
                    ok=False,
                    error=error_msg,
                    mode=mode
                )
                raise LLMProviderError(
                    provider="openai",
                    message=f"Client error: {error_detail}",
                    is_retryable=False
                )
            
            # Success - parse response
            resp.raise_for_status()
            data = resp.json()
            
            # Log successful call
            log_llm_call(
                provider="openai",
                model=LLM_MODEL,
                duration_ms=duration_ms,
                ok=True,
                error=None,
                mode=mode
            )
            
            # Extract response content
            if "choices" not in data or len(data["choices"]) == 0:
                error_msg = "No choices in response"
                log_llm_call(
                    provider="openai",
                    model=LLM_MODEL,
                    duration_ms=duration_ms,
                    ok=False,
                    error=error_msg,
                    mode=mode
                )
                raise LLMProviderError(
                    provider="openai",
                    message="No response choices from OpenAI",
                    is_retryable=True
                )
            
            return data["choices"][0]["message"]["content"]
    
    except httpx.TimeoutException as e:
        duration_ms = (time.perf_counter() - t0) * 1000
        error_msg = f"Timeout: {str(e)}"
        log_llm_call(
            provider="openai",
            model=LLM_MODEL,
            duration_ms=duration_ms,
            ok=False,
            error=error_msg,
            mode=mode
        )
        raise LLMProviderError(
            provider="openai",
            message="Request timeout. Please retry.",
            is_retryable=True
        ) from e
    
    except httpx.RequestError as e:
        duration_ms = (time.perf_counter() - t0) * 1000
        error_msg = f"Request error: {str(e)}"
        log_llm_call(
            provider="openai",
            model=LLM_MODEL,
            duration_ms=duration_ms,
            ok=False,
            error=error_msg,
            mode=mode
        )
        raise LLMProviderError(
            provider="openai",
            message=f"Network error: {str(e)}",
            is_retryable=True
        ) from e
    
    except LLMProviderError:
        # Re-raise LLMProviderError as-is
        raise
    
    except Exception as e:
        duration_ms = (time.perf_counter() - t0) * 1000
        error_msg = f"Unexpected error: {str(e)}"
        log_llm_call(
            provider="openai",
            model=LLM_MODEL,
            duration_ms=duration_ms,
            ok=False,
            error=error_msg,
            mode=mode
        )
        # Wrap unexpected errors
        raise LLMProviderError(
            provider="openai",
            message=f"Unexpected error: {str(e)}",
            is_retryable=False
        ) from e


# ---------------------------------------------------------------------------
# HIGH LEVEL ROUTER (ŞU AN TEK SAĞLAYICI)
# ---------------------------------------------------------------------------

async def route_model(
    prompt: str,
    *,
    depth: DepthMode = "fast",
    temperature: float = 0.2,
    max_tokens: int = 512,
    mode: str = "standalone",
    use_gateway: bool = True,  # V6: Use gateway by default
) -> str:
    """
    EZA v6 için merkezi model router.

    V6 davranışı:
      - Gateway adapter kullanarak multi-provider desteği (openai, anthropic, local)
      - Fallback to legacy implementation if gateway fails
      - depth parametresi ileride multi-LLM / deep analizler için kullanılmak üzere
        interface'te tutulur ama davranış şu an değişmez.

    Parametreler:
      prompt:   LLM'e gönderilecek metin (Standalone / Proxy pipeline oluşturur)
      depth:    "fast" | "deep" (şimdilik tek davranış, ileride genişletilecek)
      temperature, max_tokens: LLM ayarları
      mode:     Pipeline mode for telemetry ("standalone", "proxy_fast", "proxy_deep")
      use_gateway: Use V6 gateway adapter (default: True)

    Döner:
      raw_model_output: str (ham LLM cevabı – üst katmanlar bunu analiz edip
                          safe_answer üretecek)
    
    Raises:
        LLMProviderError: For provider-specific errors
    """
    provider = LLM_PROVIDER
    
    # V6: Try gateway first if enabled
    if use_gateway:
        t0 = time.perf_counter()
        try:
            settings = get_settings()
            gateway_provider = provider if provider in ["openai", "anthropic", "local"] else "openai"
            
            output = await gateway_call_llm(
                provider_name=gateway_provider,
                prompt=prompt,
                settings=settings,
                model=LLM_MODEL if provider == "openai" else None,
                temperature=temperature,
                max_tokens=max_tokens
            )
            duration_ms = (time.perf_counter() - t0) * 1000
            
            # Log successful call
            log_llm_call(
                provider=gateway_provider,
                model=LLM_MODEL,
                duration_ms=duration_ms,
                ok=True,
                error=None,
                mode=mode
            )
            
            return output
        except GatewayLLMProviderError as e:
            # Map gateway error to our LLMProviderError
            duration_ms = (time.perf_counter() - t0) * 1000
            log_llm_call(
                provider=gateway_provider,
                model=LLM_MODEL,
                duration_ms=duration_ms,
                ok=False,
                error=str(e),
                mode=mode
            )
            raise LLMProviderError(
                provider=e.provider,
                message=e.message,
                is_retryable=e.status_code is None or e.status_code >= 500
            )
        except Exception as e:
            # Fallback to legacy implementation on any error
            pass  # Continue to legacy code below

    # Legacy implementation (fallback or if use_gateway=False)
    if provider == "openai":
        # İleride depth == "deep" için farklı parametreler (daha yüksek max_tokens,
        # farklı model vs.) kullanmak mümkün.
        return await _call_openai_chat(
            prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            mode=mode,
        )

    # İleride buraya diğer sağlayıcılar (claude, gemini, llama, mistral…) eklenecek.
    raise LLMProviderError(
        provider=provider,
        message=f"Unsupported LLM_PROVIDER: {provider!r}",
        is_retryable=False
    )


# ---------------------------------------------------------------------------
# COMPATIBILITY WRAPPER (for existing callers)
# ---------------------------------------------------------------------------

async def route_to_model(
    text: str,
    input_analysis: Optional[Dict[str, Any]] = None,
    preferred_model: Optional[str] = None,
) -> str:
    """
    Backward compatibility wrapper for existing code.
    Maps old interface to new route_model function.
    """
    # Determine depth based on input analysis if available
    depth: DepthMode = "fast"
    
    if input_analysis:
        risk_level = input_analysis.get("risk_level", "low")
        # For high risk, we might want deeper analysis in future
        # For now, keep it fast
        if risk_level == "high":
            depth = "fast"  # Can be changed to "deep" later
    
    # Adjust max_tokens based on risk level
    max_tokens = 512
    if input_analysis:
        risk_level = input_analysis.get("risk_level", "low")
        if risk_level == "high":
            max_tokens = 256  # Shorter responses for high-risk queries
    
    # Use preferred_model if specified (for proxy mode)
    # For now, we use the model from env, but this can be extended
    return await route_model(
        prompt=text,
        depth=depth,
        temperature=0.2,
        max_tokens=max_tokens,
        mode="standalone",
    )
