# -*- coding: utf-8 -*-
"""
EZA Proxy - Stage-0: Fast Risk Scan
Ultra-fast pre-analysis to decide IF and WHERE deeper analysis is required

Target: < 500ms
Model: Small/fast model (gpt-4o-mini)
Output: Risk band, priority paragraphs, primary risk types
"""

import logging
import json
import re
import time
from typing import Dict, Any, Optional, List
from backend.gateway.router_adapter import call_llm_provider
from backend.config import get_settings
from backend.infra.cache_registry import (
    get_semantic_cache,
    set_semantic_cache
)

logger = logging.getLogger(__name__)


def build_fast_risk_scan_prompt(content: str, domain: Optional[str] = None) -> str:
    """
    Build minimal prompt for fast risk scanning
    No policy details, no deep analysis - just risk presence and rough band
    """
    domain_context = f"Domain: {domain}" if domain else "General content"
    
    prompt = f"""Analyze this content for risk presence. Respond ONLY with JSON.

{domain_context}

Content:
{content[:2000]}  # Limit to 2000 chars for speed

Respond with this EXACT structure:
{{
  "risk_detected": true/false,
  "risk_band": "low" | "medium" | "high",
  "estimated_score_range": [min, max],  // 0-100
  "priority_paragraphs": [0, 2, 4],  // Paragraph indices that need deep analysis (max 4)
  "primary_risk_types": ["manipulation", "financial_harm", "bias", "legal", "ethical"]
}}

Rules:
- risk_band: "low" if estimated ethical_index > 70, "medium" if 50-70, "high" if < 50
- priority_paragraphs: Only include paragraphs with clear risk signals (max 4)
- primary_risk_types: List 1-3 most prominent risk types
- Keep response minimal - no explanations"""
    
    return prompt


async def stage0_fast_risk_scan(
    content: str,
    domain: Optional[str] = None,
    provider: str = "openai",
    org_id: Optional[str] = None  # Required for cache isolation
) -> Dict[str, Any]:
    """
    Stage-0: Fast Risk Scan
    
    Purpose: Ultra-fast pre-analysis to decide IF and WHERE deeper analysis is required
    Target: < 500ms
    Model: gpt-4o-mini (fast, cheap)
    
    Returns:
    {
        "risk_detected": bool,
        "risk_band": "low" | "medium" | "high",
        "estimated_score_range": [int, int],
        "priority_paragraphs": [int, ...],  # Max 4
        "primary_risk_types": [str, ...]
    }
    """
    start_time = time.time()
    settings = get_settings()
    
    # LAYER 2: Semantic Pre-Analysis Cache (org_id isolated)
    if org_id:
        cached_result = get_semantic_cache(org_id, content, domain)
        if cached_result:
        logger.info(f"[Stage-0] Using cached semantic pre-analysis result")
        # Add cache hit indicator
        cached_result["_cache_hit"] = True
        cached_result["_stage0_latency_ms"] = (time.time() - start_time) * 1000
        return cached_result
    
    # Split into paragraphs for priority detection
    paragraphs = content.split('\n\n')
    if len(paragraphs) == 1:
        paragraphs = content.split('\n')
    
    # Limit content length for speed (first 2000 chars)
    content_preview = content[:2000]
    
    prompt = build_fast_risk_scan_prompt(content_preview, domain)
    
    try:
        response_text = await call_llm_provider(
            provider_name=provider,
            prompt=prompt,
            settings=settings,
            model="gpt-4o-mini",  # Fast model
            temperature=0.2,  # Low temperature for consistency
            max_tokens=300  # Minimal response
        )
        
        # Parse JSON response
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
        else:
            data = json.loads(response_text)
        
        # Validate and normalize response
        risk_detected = data.get("risk_detected", False)
        risk_band = data.get("risk_band", "low")
        if risk_band not in ["low", "medium", "high"]:
            risk_band = "low"
        
        estimated_range = data.get("estimated_score_range", [50, 70])
        if not isinstance(estimated_range, list) or len(estimated_range) != 2:
            estimated_range = [50, 70]
        
        priority_paragraphs = data.get("priority_paragraphs", [])
        if not isinstance(priority_paragraphs, list):
            priority_paragraphs = []
        # Limit to max 4 paragraphs
        priority_paragraphs = priority_paragraphs[:4]
        # Ensure indices are valid
        priority_paragraphs = [p for p in priority_paragraphs if 0 <= p < len(paragraphs)]
        
        primary_risk_types = data.get("primary_risk_types", [])
        if not isinstance(primary_risk_types, list):
            primary_risk_types = []
        
        latency_ms = (time.time() - start_time) * 1000
        
        result = {
            "risk_detected": risk_detected,
            "risk_band": risk_band,
            "estimated_score_range": estimated_range,
            "priority_paragraphs": priority_paragraphs,
            "primary_risk_types": primary_risk_types,
            "_stage0_latency_ms": latency_ms
        }
        
        logger.info(f"[Stage-0] Fast risk scan completed in {latency_ms:.0f}ms: risk_band={risk_band}, priority_paragraphs={len(priority_paragraphs)}")
        
        # Cache result (org_id isolated)
        if org_id:
            set_semantic_cache(org_id, content, domain, result)
        
        return result
        
    except Exception as e:
        logger.error(f"[Stage-0] Fast risk scan error: {str(e)}")
        # Fallback: assume medium risk, analyze first paragraph
        latency_ms = (time.time() - start_time) * 1000
        return {
            "risk_detected": True,
            "risk_band": "medium",
            "estimated_score_range": [40, 60],
            "priority_paragraphs": [0] if len(paragraphs) > 0 else [],
            "primary_risk_types": ["unknown"],
            "_stage0_latency_ms": latency_ms
        }

