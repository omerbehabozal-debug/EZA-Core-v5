# -*- coding: utf-8 -*-
"""
EZA V6 - Centralized Configuration
"""

from pydantic_settings import BaseSettings
from typing import Optional
from functools import lru_cache


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
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "forbid"


@lru_cache()
def get_settings() -> Settings:
    """Get settings singleton"""
    return Settings()

