# -*- coding: utf-8 -*-
"""
EZA V6 - Centralized Configuration
.env yükleme burada tek kez yapılır, tüm modüller buradan config alır.
"""

import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from typing import Optional, Dict
from functools import lru_cache

# Load .env file ONCE at module import time
# This ensures all os.getenv() calls throughout the application can access .env variables
load_dotenv()

# Debug: Log .env loading status - hangi key'ler yüklendi
_loaded_keys = []
if os.getenv("OPENAI_API_KEY"):
    _loaded_keys.append("OPENAI_API_KEY")
if os.getenv("GROQ_API_KEY"):
    _loaded_keys.append("GROQ_API_KEY")
if os.getenv("MISTRAL_API_KEY"):
    _loaded_keys.append("MISTRAL_API_KEY")
if os.getenv("ANTHROPIC_API_KEY"):
    _loaded_keys.append("ANTHROPIC_API_KEY")

print("[ENV] LOADED:", ", ".join(_loaded_keys) if _loaded_keys else "No API keys loaded")


class Settings(BaseSettings):
    """Centralized application settings"""
    
    # Core
    PROJECT_NAME: str = "EZA-Core V6"
    ENV: str = "dev"  # dev / staging / prod
    DEBUG: bool = True
    
    # Database & Redis
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost/eza_v6"
    REDIS_URL: Optional[str] = "redis://localhost:6379"
    
    # AI Gateway providers - Tüm LLM anahtarları expose ediliyor
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    LOCAL_LLM_URL: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    MISTRAL_API_KEY: Optional[str] = None
    
    # Security
    JWT_SECRET: str = "supersecretkey"
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"
    EZA_JWT_SECRET: Optional[str] = None  # Production JWT secret (from env)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    # API Keys
    EZA_ADMIN_API_KEY: Optional[str] = None  # Admin API key for internal endpoints
    
    # Redis (for rate limiting)
    EZA_REDIS_URL: Optional[str] = None  # Redis URL for rate limiting (falls back to REDIS_URL)
    
    # Multi-tenant
    DEFAULT_INSTITUTION_ID: Optional[int] = None
    
    # Telemetry
    ENABLE_TELEMETRY: bool = True
    TELEMETRY_SAMPLE_RATE: float = 1.0
    
    # Gateway
    DEFAULT_LLM_PROVIDER: str = "openai"  # openai, anthropic, local
    FALLBACK_LLM_PROVIDER: str = "openai"
    LLM_MODEL: str = "gpt-4o-mini"  # Default model for LLM calls
    
    # LLM Timeout Settings
    LLM_TIMEOUT_SECONDS: float = 12.0  # Timeout for LLM API calls
    LLM_CONNECT_TIMEOUT_SECONDS: float = 4.0  # Connection timeout
    
    # Pipeline Settings
    PIPELINE_TIMEOUT_SECONDS: float = 30.0  # Overall pipeline timeout
    STANDALONE_MAX_TOKENS: int = 180  # Max tokens for standalone mode
    PROXY_MAX_TOKENS: int = 512  # Max tokens for proxy mode
    
    # Regulation
    DEFAULT_POLICY_PACK: str = "eu_ai"  # rtuk, btk, eu_ai, oecd
    
    # Supported Models Mapping
    # Model ID format: provider/model-name
    # Kullanım: openai/gpt-4o-mini, groq/llama3-8b-tool-use, mistral/mistral-7b-instruct
    SUPPORTED_MODELS: Dict[str, str] = {
        # OpenAI
        "openai/gpt-4o-mini": "gpt-4o-mini",
        "openai-gpt4o-mini": "gpt-4o-mini",  # Legacy support
        "openai-gpt4.1": "gpt-4.1",
        
        # Groq
        "groq/llama3-8b-tool-use": "llama3-8b-8192",
        "groq-llama3-70b": "llama3-70b-8192",
        "groq-mixtral-8x7b": "mixtral-8x7b-32768",
        "groq-qwen-32b": "qwen-2-72b",
        
        # Mistral
        "mistral/mistral-7b-instruct": "mistral-tiny",
        "mistral-medium": "mistral-medium-latest",
        "mistral-small": "mistral-small-latest",
        "mistral-7b": "mistral-tiny"
    }
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "forbid"


@lru_cache()
def get_settings() -> Settings:
    """Get settings singleton"""
    return Settings()
