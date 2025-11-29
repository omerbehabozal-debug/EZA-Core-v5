# -*- coding: utf-8 -*-
"""
EZA V6 - Centralized Configuration
"""

import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from typing import Optional, Dict
from functools import lru_cache

# Load .env file ONCE at module import time
# This ensures all os.getenv() calls throughout the application can access .env variables
load_dotenv()

# Debug: Log .env loading status
print("[ENV] .env loaded — GROQ_API_KEY =", bool(os.getenv("GROQ_API_KEY")))
print("[ENV] .env loaded — MISTRAL_API_KEY =", bool(os.getenv("MISTRAL_API_KEY")))
print("[ENV] .env loaded — OPENAI_API_KEY =", bool(os.getenv("OPENAI_API_KEY")))


class Settings(BaseSettings):
    """Centralized application settings"""
    
    # Core
    PROJECT_NAME: str = "EZA-Core V6"
    ENV: str = "dev"  # dev / staging / prod
    DEBUG: bool = True
    
    # Database & Redis
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost/eza_v6"
    REDIS_URL: Optional[str] = "redis://localhost:6379"
    
    # AI Gateway providers
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    LOCAL_LLM_URL: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    MISTRAL_API_KEY: Optional[str] = None
    
    # Security
    JWT_SECRET: str = "supersecretkey"
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
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
    SUPPORTED_MODELS: Dict[str, str] = {
        # OpenAI
        "openai-gpt4o-mini": "gpt-4o-mini",
        "openai-gpt4.1": "gpt-4.1",
        
        # Groq
        "groq-llama3-70b": "llama3-70b-8192",
        "groq-mixtral-8x7b": "mixtral-8x7b-32768",
        "groq-qwen-32b": "qwen-2-72b",
        
        # Mistral
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

