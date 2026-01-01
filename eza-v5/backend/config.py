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
    ENV: str = "dev"  # dev / staging / prod / ci
    EZA_ENV: Optional[str] = None  # Override ENV if set (takes precedence)
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
    
    # Public Snapshot Publishing
    PUBLIC_SNAPSHOT_KEY: Optional[str] = None  # Required for publishing and reading snapshots
    
    # Security
    JWT_SECRET: str = "supersecretkey"
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"
    EZA_JWT_SECRET: Optional[str] = None  # Production JWT secret (from env)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    # API Keys
    EZA_ADMIN_API_KEY: Optional[str] = None  # Admin API key for internal endpoints
    INTERNAL_SETUP_KEY: Optional[str] = None  # Internal setup key for test user creation (⚠️ CHANGE IN PRODUCTION)
    
    # Redis (for rate limiting)
    EZA_REDIS_URL: Optional[str] = None  # Redis URL for rate limiting (falls back to REDIS_URL)
    
    # Multi-tenant
    DEFAULT_INSTITUTION_ID: Optional[int] = None
    
    # Telemetry
    ENABLE_TELEMETRY: bool = True
    TELEMETRY_SAMPLE_RATE: float = 1.0
    
    # Learning & Vector DB (PASİF - Feature Flags)
    VECTOR_DB_ENABLED: bool = False  # Default: disabled, no-op
    VECTOR_DB_URL: Optional[str] = "http://localhost:6333"  # Qdrant default
    VECTOR_DB_API_KEY: Optional[str] = None
    ETHICAL_EMBEDDING_ENABLED: bool = False  # Default: disabled, no-op
    LEARNING_PIPELINE_ENABLED: bool = False  # Default: disabled, no-op
    AUTO_POLICY_UPDATE_ENABLED: bool = False  # Default: disabled, no-op
    
    # Gateway
    DEFAULT_LLM_PROVIDER: str = "openai"  # openai, anthropic, local
    FALLBACK_LLM_PROVIDER: str = "openai"
    LLM_MODEL: str = "gpt-4o-mini"  # Default model for LLM calls
    
    # LLM Timeout Settings
    LLM_TIMEOUT_SECONDS: float = 12.0  # Timeout for LLM API calls
    LLM_CONNECT_TIMEOUT_SECONDS: float = 4.0  # Connection timeout
    
    # Pipeline Settings
    PIPELINE_TIMEOUT_SECONDS: float = 30.0  # Overall pipeline timeout
    STANDALONE_MAX_TOKENS: int = 2048  # Max tokens for standalone mode (increased for full responses)
    PROXY_MAX_TOKENS: int = 512  # Max tokens for proxy mode
    
    # Regulation
    DEFAULT_POLICY_PACK: str = "eu_ai"  # rtuk, btk, eu_ai, oecd
    
    # === Observability ===
    OTEL_ENABLED: bool = os.getenv("OTEL_ENABLED", "false").lower() == "true"
    OTEL_SERVICE_NAME: str = os.getenv("OTEL_SERVICE_NAME", "eza-proxy")
    OTEL_EXPORTER_PROMETHEUS_PORT: int = int(os.getenv("OTEL_EXPORTER_PROMETHEUS_PORT", "9464"))
    
    # === Rate Limiting ===
    ORG_RPM_LIMIT: int = int(os.getenv("ORG_RPM_LIMIT", "60"))  # Requests per minute per org
    ORG_TPM_LIMIT: int = int(os.getenv("ORG_TPM_LIMIT", "120000"))  # Tokens per minute per org
    RATE_LIMIT_BURST: int = int(os.getenv("RATE_LIMIT_BURST", "10"))  # Burst allowance
    
    # === Circuit Breaker ===
    CB_FAILURE_THRESHOLD: int = int(os.getenv("CB_FAILURE_THRESHOLD", "5"))  # Failures before opening
    CB_RECOVERY_TIMEOUT_SECONDS: int = int(os.getenv("CB_RECOVERY_TIMEOUT_SECONDS", "30"))  # Timeout before half-open
    
    # === Cache ===
    SEMANTIC_CACHE_TTL_SECONDS: int = int(os.getenv("SEMANTIC_CACHE_TTL_SECONDS", "900"))  # 15 minutes
    SEMANTIC_CACHE_MAX_ENTRIES: int = int(os.getenv("SEMANTIC_CACHE_MAX_ENTRIES", "10000"))
    POLICY_CACHE_TTL_SECONDS: int = int(os.getenv("POLICY_CACHE_TTL_SECONDS", "3600"))  # 1 hour
    PROMPT_CACHE_MAX_ENTRIES: int = int(os.getenv("PROMPT_CACHE_MAX_ENTRIES", "500"))
    
    # === Load Test ===
    LOADTEST_BASE_URL: str = os.getenv("LOADTEST_BASE_URL", "http://localhost:8000")
    
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
    settings = Settings()
    
    # EZA_ENV override ENV if set (takes precedence)
    if settings.EZA_ENV:
        settings.ENV = settings.EZA_ENV
    
    # Set DEBUG based on ENV
    if settings.ENV == "prod":
        settings.DEBUG = False
    elif settings.ENV == "ci":
        settings.DEBUG = False  # CI mode: minimal logging
    else:
        settings.DEBUG = True  # dev/staging: detailed logging
    
    return settings
