# -*- coding: utf-8 -*-
"""
EZA Proxy - 3-Layer Caching Strategy (DEPRECATED - Use infra/cache_registry.py)
This module is kept for backward compatibility but delegates to cache_registry
"""

import logging
from typing import Dict, Any, Optional, List
from backend.infra.cache_registry import (
    get_semantic_cache as _get_semantic_cache_registry,
    set_semantic_cache as _set_semantic_cache_registry,
    get_policy_cache as _get_policy_cache_registry,
    set_policy_cache as _set_policy_cache_registry,
    get_prompt_cache as _get_prompt_cache_registry,
    set_prompt_cache as _set_prompt_cache_registry,
)

logger = logging.getLogger(__name__)

# Backward compatibility wrappers (delegate to cache_registry)

# In-memory caches (can be replaced with Redis in production)
_policy_fingerprint_cache: Dict[str, Dict[str, Any]] = {}
_semantic_preanalysis_cache: Dict[str, Dict[str, Any]] = {}
_prompt_compilation_cache: Dict[str, str] = {}

# Cache TTLs
POLICY_CACHE_TTL = 3600  # 1 hour
SEMANTIC_CACHE_TTL = 1800  # 30 minutes
PROMPT_CACHE_TTL = 86400  # 24 hours

# Cache size limits
MAX_POLICY_CACHE_SIZE = 1000
MAX_SEMANTIC_CACHE_SIZE = 5000
MAX_PROMPT_CACHE_SIZE = 100


def generate_policy_fingerprint(
    org_id: str,
    policies: Optional[List[str]],
    domain: Optional[str] = None
) -> str:
    """
    Generate fingerprint for policy set
    
    Key: (org_id + policy_set_version + weights_hash)
    """
    # Sort policies for consistent hashing
    policy_list = sorted(policies) if policies else []
    policy_str = "|".join(policy_list)
    domain_str = domain or "general"
    
    # Create hash
    fingerprint_data = f"{org_id}:{policy_str}:{domain_str}"
    fingerprint = hashlib.sha256(fingerprint_data.encode()).hexdigest()[:16]
    
    return fingerprint


def generate_content_hash(content: str) -> str:
    """
    Generate hash for content (for semantic cache)
    Uses SHA-256 for fast lookup
    """
    return hashlib.sha256(content.encode('utf-8')).hexdigest()[:32]


def generate_semantic_cache_key(
    content: str,
    domain: Optional[str] = None
) -> str:
    """
    Generate semantic cache key
    Uses content hash + domain for similarity matching
    """
    content_hash = generate_content_hash(content)
    domain_str = domain or "general"
    return f"semantic:{domain_str}:{content_hash}"


def generate_prompt_cache_key(
    prompt_type: str,
    policies: Optional[List[str]],
    domain: Optional[str] = None
) -> str:
    """
    Generate prompt compilation cache key
    
    Key: (prompt_type + policy_set_version + domain)
    """
    policy_str = "|".join(sorted(policies)) if policies else "none"
    domain_str = domain or "general"
    return f"prompt:{prompt_type}:{policy_str}:{domain_str}"


# ========== LAYER 1: POLICY FINGERPRINT CACHE ==========

def get_policy_fingerprint_cache(
    org_id: str,
    policies: Optional[List[str]],
    domain: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Get cached policy fingerprint result
    
    Returns:
        Cached result if exists and not expired, None otherwise
    """
    fingerprint = generate_policy_fingerprint(org_id, policies, domain)
    cache_key = f"policy:{fingerprint}"
    
    if cache_key in _policy_fingerprint_cache:
        cached = _policy_fingerprint_cache[cache_key]
        # Check TTL
        if time.time() - cached.get("_cached_at", 0) < POLICY_CACHE_TTL:
            logger.debug(f"[Cache] Policy fingerprint cache HIT: {fingerprint[:8]}")
            return cached.get("data")
        else:
            # Expired, remove
            del _policy_fingerprint_cache[cache_key]
            logger.debug(f"[Cache] Policy fingerprint cache EXPIRED: {fingerprint[:8]}")
    
    logger.debug(f"[Cache] Policy fingerprint cache MISS: {fingerprint[:8]}")
    return None


def set_policy_fingerprint_cache(
    org_id: str,
    policies: Optional[List[str]],
    domain: Optional[str],
    data: Dict[str, Any]
):
    """
    Cache policy fingerprint result
    """
    fingerprint = generate_policy_fingerprint(org_id, policies, domain)
    cache_key = f"policy:{fingerprint}"
    
    # Evict if cache is too large
    if len(_policy_fingerprint_cache) >= MAX_POLICY_CACHE_SIZE:
        # Remove oldest entries (simple FIFO)
        oldest_key = min(_policy_fingerprint_cache.keys(), 
                        key=lambda k: _policy_fingerprint_cache[k].get("_cached_at", 0))
        del _policy_fingerprint_cache[oldest_key]
        logger.debug(f"[Cache] Policy cache evicted: {oldest_key}")
    
    _policy_fingerprint_cache[cache_key] = {
        "data": data,
        "_cached_at": time.time()
    }
    logger.debug(f"[Cache] Policy fingerprint cached: {fingerprint[:8]}")


# ========== LAYER 2: SEMANTIC PRE-ANALYSIS CACHE ==========

def get_semantic_preanalysis_cache(
    content: str,
    domain: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Get cached Stage-0 result for similar content
    
    Uses content hash for exact match (can be extended with embeddings for similarity)
    """
    cache_key = generate_semantic_cache_key(content, domain)
    
    if cache_key in _semantic_preanalysis_cache:
        cached = _semantic_preanalysis_cache[cache_key]
        # Check TTL
        if time.time() - cached.get("_cached_at", 0) < SEMANTIC_CACHE_TTL:
            logger.debug(f"[Cache] Semantic pre-analysis cache HIT: {cache_key[:32]}")
            return cached.get("data")
        else:
            # Expired, remove
            del _semantic_preanalysis_cache[cache_key]
            logger.debug(f"[Cache] Semantic pre-analysis cache EXPIRED: {cache_key[:32]}")
    
    logger.debug(f"[Cache] Semantic pre-analysis cache MISS: {cache_key[:32]}")
    return None


def set_semantic_preanalysis_cache(
    content: str,
    domain: Optional[str],
    stage0_result: Dict[str, Any]
):
    """
    Cache Stage-0 result
    """
    cache_key = generate_semantic_cache_key(content, domain)
    
    # Evict if cache is too large
    if len(_semantic_preanalysis_cache) >= MAX_SEMANTIC_CACHE_SIZE:
        # Remove oldest entries
        oldest_key = min(_semantic_preanalysis_cache.keys(),
                        key=lambda k: _semantic_preanalysis_cache[k].get("_cached_at", 0))
        del _semantic_preanalysis_cache[oldest_key]
        logger.debug(f"[Cache] Semantic cache evicted: {oldest_key}")
    
    _semantic_preanalysis_cache[cache_key] = {
        "data": stage0_result,
        "_cached_at": time.time()
    }
    logger.debug(f"[Cache] Semantic pre-analysis cached: {cache_key[:32]}")


# ========== LAYER 3: PROMPT COMPILATION CACHE ==========

def get_prompt_compilation_cache(
    prompt_type: str,
    policies: Optional[List[str]],
    domain: Optional[str] = None
) -> Optional[str]:
    """
    Get cached compiled prompt
    
    Returns:
        Cached prompt if exists and not expired, None otherwise
    """
    cache_key = generate_prompt_cache_key(prompt_type, policies, domain)
    
    if cache_key in _prompt_compilation_cache:
        # Prompt cache doesn't have TTL in dict, but we can add metadata
        # For now, assume prompts are stable and don't expire
        logger.debug(f"[Cache] Prompt compilation cache HIT: {prompt_type}")
        return _prompt_compilation_cache[cache_key]
    
    logger.debug(f"[Cache] Prompt compilation cache MISS: {prompt_type}")
    return None


def set_prompt_compilation_cache(
    prompt_type: str,
    policies: Optional[List[str]],
    domain: Optional[str],
    compiled_prompt: str
):
    """
    Cache compiled prompt
    """
    cache_key = generate_prompt_cache_key(prompt_type, policies, domain)
    
    # Evict if cache is too large
    if len(_prompt_compilation_cache) >= MAX_PROMPT_CACHE_SIZE:
        # Remove random entry (prompts are stable, simple eviction)
        import random
        key_to_remove = random.choice(list(_prompt_compilation_cache.keys()))
        del _prompt_compilation_cache[key_to_remove]
        logger.debug(f"[Cache] Prompt cache evicted: {key_to_remove}")
    
    _prompt_compilation_cache[cache_key] = compiled_prompt
    logger.debug(f"[Cache] Prompt compilation cached: {prompt_type}")


# ========== CACHE STATISTICS ==========

def get_cache_stats() -> Dict[str, Any]:
    """
    Get cache statistics for monitoring
    """
    # Count non-expired entries
    policy_count = sum(1 for v in _policy_fingerprint_cache.values() 
                      if time.time() - v.get("_cached_at", 0) < POLICY_CACHE_TTL)
    semantic_count = sum(1 for v in _semantic_preanalysis_cache.values()
                        if time.time() - v.get("_cached_at", 0) < SEMANTIC_CACHE_TTL)
    prompt_count = len(_prompt_compilation_cache)
    
    return {
        "policy_fingerprint": {
            "size": policy_count,
            "max_size": MAX_POLICY_CACHE_SIZE,
            "ttl_seconds": POLICY_CACHE_TTL
        },
        "semantic_preanalysis": {
            "size": semantic_count,
            "max_size": MAX_SEMANTIC_CACHE_SIZE,
            "ttl_seconds": SEMANTIC_CACHE_TTL
        },
        "prompt_compilation": {
            "size": prompt_count,
            "max_size": MAX_PROMPT_CACHE_SIZE,
            "ttl_seconds": PROMPT_CACHE_TTL
        }
    }


def clear_cache(cache_type: Optional[str] = None):
    """
    Clear cache(s)
    
    Args:
        cache_type: "policy", "semantic", "prompt", or None (all)
    """
    if cache_type == "policy" or cache_type is None:
        _policy_fingerprint_cache.clear()
        logger.info("[Cache] Policy fingerprint cache cleared")
    
    if cache_type == "semantic" or cache_type is None:
        _semantic_preanalysis_cache.clear()
        logger.info("[Cache] Semantic pre-analysis cache cleared")
    
    if cache_type == "prompt" or cache_type is None:
        _prompt_compilation_cache.clear()
        logger.info("[Cache] Prompt compilation cache cleared")

