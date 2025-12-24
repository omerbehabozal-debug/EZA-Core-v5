# -*- coding: utf-8 -*-
"""
EZA Proxy - Cache Registry (org_id namespace isolation)
ALL caches MUST be namespaced by org_id
NEVER reuse cache entries across orgs
"""

import logging
import hashlib
import time
from typing import Dict, Any, Optional, Tuple
from threading import Lock
from collections import defaultdict
from backend.config import get_settings

logger = logging.getLogger(__name__)

# Cache stores per org_id
_semantic_cache: Dict[str, Dict[str, Any]] = defaultdict(dict)  # org_id -> cache_key -> data
_policy_cache: Dict[str, Dict[str, Any]] = defaultdict(dict)  # org_id -> cache_key -> data
_prompt_cache: Dict[str, Dict[str, str]] = defaultdict(dict)  # org_id -> cache_key -> prompt

_cache_lock = Lock()

# Cache hit/miss counters (for Prometheus)
_cache_hits = defaultdict(int)  # type -> count
_cache_misses = defaultdict(int)  # type -> count
_cache_metrics_lock = Lock()


def _get_semantic_cache_key(content: str, domain: Optional[str] = None) -> str:
    """Generate semantic cache key (content-based)"""
    content_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()[:32]
    domain_str = domain or "general"
    return f"semantic:{domain_str}:{content_hash}"


def _get_policy_cache_key(
    org_id: str,
    policies: Optional[list],
    domain: Optional[str] = None
) -> str:
    """Generate policy cache key"""
    policy_str = "|".join(sorted(policies)) if policies else "none"
    domain_str = domain or "general"
    # Include org_id in key to ensure isolation
    key_data = f"{org_id}:{policy_str}:{domain_str}"
    return hashlib.sha256(key_data.encode()).hexdigest()[:16]


def _get_prompt_cache_key(
    prompt_type: str,
    policies: Optional[list],
    domain: Optional[str] = None
) -> str:
    """Generate prompt cache key"""
    policy_str = "|".join(sorted(policies)) if policies else "none"
    domain_str = domain or "general"
    return f"prompt:{prompt_type}:{policy_str}:{domain_str}"


def get_semantic_cache(
    org_id: str,
    content: str,
    domain: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Get cached Stage-0 result (org_id isolated)
    
    Returns:
        Cached result if exists and not expired, None otherwise
    """
    settings = get_settings()
    cache_key = _get_semantic_cache_key(content, domain)
    
    with _cache_lock:
        org_cache = _semantic_cache.get(org_id, {})
        if cache_key in org_cache:
            cached = org_cache[cache_key]
            # Check TTL
            if time.time() - cached.get("_cached_at", 0) < settings.SEMANTIC_CACHE_TTL_SECONDS:
                with _cache_metrics_lock:
                    _cache_hits["semantic"] += 1
                logger.debug(f"[CacheRegistry] Semantic cache HIT: org_id={org_id[:8]}, key={cache_key[:16]}")
                return cached.get("data")
            else:
                # Expired, remove
                del org_cache[cache_key]
                with _cache_metrics_lock:
                    _cache_misses["semantic"] += 1
                logger.debug(f"[CacheRegistry] Semantic cache EXPIRED: org_id={org_id[:8]}")
    
    with _cache_metrics_lock:
        _cache_misses["semantic"] += 1
    logger.debug(f"[CacheRegistry] Semantic cache MISS: org_id={org_id[:8]}")
    return None


def set_semantic_cache(
    org_id: str,
    content: str,
    domain: Optional[str],
    stage0_result: Dict[str, Any]
):
    """Cache Stage-0 result (org_id isolated)"""
    settings = get_settings()
    cache_key = _get_semantic_cache_key(content, domain)
    
    with _cache_lock:
        org_cache = _semantic_cache[org_id]
        
        # Evict if cache is too large
        if len(org_cache) >= settings.SEMANTIC_CACHE_MAX_ENTRIES:
            # Remove oldest entries
            oldest_key = min(org_cache.keys(),
                           key=lambda k: org_cache[k].get("_cached_at", 0))
            del org_cache[oldest_key]
            logger.debug(f"[CacheRegistry] Semantic cache evicted for org_id={org_id[:8]}")
        
        org_cache[cache_key] = {
            "data": stage0_result,
            "_cached_at": time.time()
        }
        logger.debug(f"[CacheRegistry] Semantic cache set: org_id={org_id[:8]}, key={cache_key[:16]}")


def get_policy_cache(
    org_id: str,
    policies: Optional[list],
    domain: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Get cached policy fingerprint result (org_id isolated)"""
    settings = get_settings()
    cache_key = _get_policy_cache_key(org_id, policies, domain)
    
    with _cache_lock:
        org_cache = _policy_cache.get(org_id, {})
        if cache_key in org_cache:
            cached = org_cache[cache_key]
            # Check TTL
            if time.time() - cached.get("_cached_at", 0) < settings.POLICY_CACHE_TTL_SECONDS:
                with _cache_metrics_lock:
                    _cache_hits["policy"] += 1
                logger.debug(f"[CacheRegistry] Policy cache HIT: org_id={org_id[:8]}")
                return cached.get("data")
            else:
                del org_cache[cache_key]
                with _cache_metrics_lock:
                    _cache_misses["policy"] += 1
    
    with _cache_metrics_lock:
        _cache_misses["policy"] += 1
    return None


def set_policy_cache(
    org_id: str,
    policies: Optional[list],
    domain: Optional[str],
    data: Dict[str, Any]
):
    """Cache policy fingerprint result (org_id isolated)"""
    cache_key = _get_policy_cache_key(org_id, policies, domain)
    
    with _cache_lock:
        org_cache = _policy_cache[org_id]
        org_cache[cache_key] = {
            "data": data,
            "_cached_at": time.time()
        }
        logger.debug(f"[CacheRegistry] Policy cache set: org_id={org_id[:8]}")


def invalidate_policy_cache(org_id: str, reason: str = "policy_change"):
    """
    Invalidate policy cache for org_id
    
    Called when:
    - policy_set_version changes
    - weights_hash changes
    - enable/disable change
    """
    with _cache_lock:
        if org_id in _policy_cache:
            del _policy_cache[org_id]
            logger.info(f"[CacheRegistry] Policy cache invalidated for org_id={org_id[:8]}: {reason}")


def get_prompt_cache(
    org_id: str,
    prompt_type: str,
    policies: Optional[list],
    domain: Optional[str] = None
) -> Optional[str]:
    """Get cached compiled prompt (org_id isolated)"""
    cache_key = _get_prompt_cache_key(prompt_type, policies, domain)
    
    with _cache_lock:
        org_cache = _prompt_cache.get(org_id, {})
        if cache_key in org_cache:
            with _cache_metrics_lock:
                _cache_hits["prompt"] += 1
            logger.debug(f"[CacheRegistry] Prompt cache HIT: org_id={org_id[:8]}, type={prompt_type}")
            return org_cache[cache_key]
    
    with _cache_metrics_lock:
        _cache_misses["prompt"] += 1
    logger.debug(f"[CacheRegistry] Prompt cache MISS: org_id={org_id[:8]}, type={prompt_type}")
    return None


def set_prompt_cache(
    org_id: str,
    prompt_type: str,
    policies: Optional[list],
    domain: Optional[str],
    compiled_prompt: str
):
    """Cache compiled prompt (org_id isolated)"""
    settings = get_settings()
    cache_key = _get_prompt_cache_key(prompt_type, policies, domain)
    
    with _cache_lock:
        org_cache = _prompt_cache[org_id]
        
        # Evict if cache is too large
        if len(org_cache) >= settings.PROMPT_CACHE_MAX_ENTRIES:
            # Remove random entry
            import random
            if org_cache:
                key_to_remove = random.choice(list(org_cache.keys()))
                del org_cache[key_to_remove]
                logger.debug(f"[CacheRegistry] Prompt cache evicted for org_id={org_id[:8]}")
        
        org_cache[cache_key] = compiled_prompt
        logger.debug(f"[CacheRegistry] Prompt cache set: org_id={org_id[:8]}, type={prompt_type}")


def get_cache_metrics() -> Dict[str, int]:
    """Get cache hit/miss metrics for Prometheus"""
    with _cache_metrics_lock:
        return {
            "cache_hit_total": dict(_cache_hits),
            "cache_miss_total": dict(_cache_misses)
        }


def clear_org_cache(org_id: str):
    """Clear all caches for an org (for testing or org deletion)"""
    with _cache_lock:
        if org_id in _semantic_cache:
            del _semantic_cache[org_id]
        if org_id in _policy_cache:
            del _policy_cache[org_id]
        if org_id in _prompt_cache:
            del _prompt_cache[org_id]
        logger.info(f"[CacheRegistry] Cleared all caches for org_id={org_id[:8]}")

