# -*- coding: utf-8 -*-
"""
API Key Checker for Multi-Model Tests
Checks which API keys are available
"""
from backend.config import get_settings


def check_api_keys() -> dict:
    """
    Check which API keys are available
    
    Returns:
        {
            "openai": bool,
            "groq": bool,
            "mistral": bool,
            "available_count": int,
            "missing": list[str]
        }
    """
    settings = get_settings()
    
    # Get API keys from settings (config.py already loaded .env)
    openai_key = settings.OPENAI_API_KEY
    groq_key = settings.GROQ_API_KEY
    mistral_key = settings.MISTRAL_API_KEY
    
    result = {
        "openai": bool(openai_key),
        "groq": bool(groq_key),
        "mistral": bool(mistral_key),
        "available_count": 0,
        "missing": []
    }
    
    if result["openai"]:
        result["available_count"] += 1
    else:
        result["missing"].append("openai")
    
    if result["groq"]:
        result["available_count"] += 1
    else:
        result["missing"].append("groq")
    
    if result["mistral"]:
        result["available_count"] += 1
    else:
        result["missing"].append("mistral")
    
    return result

