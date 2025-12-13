# -*- coding: utf-8 -*-
"""Model switcher for multi-model tests"""
from typing import Dict, Any, List
from backend.config import get_settings

MODELS = ["gpt-4o-mini", "gpt-4o", "openrouter-dummy"]

def get_model_config(model_name: str) -> Dict[str, Any]:
    """Get config for a model"""
    return {
        "model": model_name,
        "provider": "openai" if "gpt" in model_name else "openrouter"
    }

