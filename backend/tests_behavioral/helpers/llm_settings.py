# -*- coding: utf-8 -*-
"""
LLM Settings for Behavioral Tests
Real LLM configuration for behavioral testing
"""

# LLM Configuration
LLM_MODEL_NAME = "gpt-4o-mini"  # Current model
MAX_TOKENS = 200
TEMPERATURE = 0.2

# Test Configuration
USE_REAL_LLM = True  # Set to False to use fake LLM for faster tests
TIMEOUT_SECONDS = 30.0

