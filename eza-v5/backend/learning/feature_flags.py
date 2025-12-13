# -*- coding: utf-8 -*-
"""
Learning Feature Flags & Fail-Safe Mechanisms
Ensures learning components are completely disabled when flags are off.

🔒 ALTIN KURAL:
- Flag false ise: Kod çalışsa bile no-op
- Log bile basmasın (debug mode hariç)
- Exception raise etmesin
"""

import logging
from functools import wraps
from typing import Callable, Any
from backend.config import get_settings

logger = logging.getLogger(__name__)


def require_vector_db(func: Callable) -> Callable:
    """
    Decorator: Requires VECTOR_DB_ENABLED=true
    Returns no-op if disabled.
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        settings = get_settings()
        if not settings.VECTOR_DB_ENABLED:
            # No-op if disabled - no log, no exception
            return None if 'return' in str(func.__annotations__) else {}
        return await func(*args, **kwargs)
    return wrapper


def require_ethical_embedding(func: Callable) -> Callable:
    """
    Decorator: Requires ETHICAL_EMBEDDING_ENABLED=true
    Returns no-op if disabled.
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        settings = get_settings()
        if not settings.ETHICAL_EMBEDDING_ENABLED:
            # No-op if disabled - no log, no exception
            return None if 'return' in str(func.__annotations__) else {}
        return await func(*args, **kwargs)
    return wrapper


def require_learning_pipeline(func: Callable) -> Callable:
    """
    Decorator: Requires LEARNING_PIPELINE_ENABLED=true
    Raises NotImplementedError if disabled.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        settings = get_settings()
        if not settings.LEARNING_PIPELINE_ENABLED:
            raise NotImplementedError(
                f"{func.__name__} is disabled. "
                "Set LEARNING_PIPELINE_ENABLED=true to enable."
            )
        return func(*args, **kwargs)
    return wrapper


def require_auto_policy_update(func: Callable) -> Callable:
    """
    Decorator: Requires AUTO_POLICY_UPDATE_ENABLED=true
    Raises NotImplementedError if disabled (policy updates are NEVER auto).
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        settings = get_settings()
        if not settings.AUTO_POLICY_UPDATE_ENABLED:
            raise NotImplementedError(
                f"{func.__name__} is disabled. "
                "Policy updates are NEVER automatic. "
                "Set AUTO_POLICY_UPDATE_ENABLED=true only for testing."
            )
        return func(*args, **kwargs)
    return wrapper


def check_learning_flags() -> dict:
    """
    Check all learning feature flags status.
    Returns dict with flag statuses.
    """
    settings = get_settings()
    return {
        "VECTOR_DB_ENABLED": settings.VECTOR_DB_ENABLED,
        "ETHICAL_EMBEDDING_ENABLED": settings.ETHICAL_EMBEDDING_ENABLED,
        "LEARNING_PIPELINE_ENABLED": settings.LEARNING_PIPELINE_ENABLED,
        "AUTO_POLICY_UPDATE_ENABLED": settings.AUTO_POLICY_UPDATE_ENABLED,
        "all_disabled": (
            not settings.VECTOR_DB_ENABLED and
            not settings.ETHICAL_EMBEDDING_ENABLED and
            not settings.LEARNING_PIPELINE_ENABLED and
            not settings.AUTO_POLICY_UPDATE_ENABLED
        )
    }

