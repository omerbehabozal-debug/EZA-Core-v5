# -*- coding: utf-8 -*-
"""
EZA Proxy - Stage-1: Targeted Deep Analysis
Conditional deep analysis with bounded parallelism

Rules:
- Only analyze priority_paragraphs from Stage-0
- Maximum concurrent LLM calls: 3 (bounded)
- Use semaphore for concurrency control
- Proxy Lite: max 2 paragraphs
- Proxy: max 3-4 paragraphs
"""

import logging
import re
import json
import asyncio
import time
from typing import List, Dict, Any, Optional
from backend.gateway.router_adapter import call_llm_provider
from backend.config import get_settings

logger = logging.getLogger(__name__)

# Bounded concurrency: Maximum 3 concurrent LLM calls
_analysis_semaphore = asyncio.Semaphore(3)


async def analyze_paragraph_deep(
    paragraph_idx: int,
    paragraph_text: str,
    domain: Optional[str],
    policies: Optional[List[str]],
    provider: str,
    settings: Any
) -> Dict[str, Any]:
    """
    Analyze a single paragraph with deep analysis
    Protected by semaphore for bounded concurrency
    """
    # Lazy import to avoid circular dependency
    from backend.services.proxy_analyzer import (
        build_contextual_analysis_prompt,
        normalize_paragraph_risks
    )
    
    async with _analysis_semaphore:
        prompt = build_contextual_analysis_prompt(paragraph_text, False, domain, policies)
        
        try:
            response_text = await call_llm_provider(
                provider_name=provider,
                prompt=prompt,
                settings=settings,
                model="gpt-4o-mini" if provider == "openai" else None,
                temperature=0.3,
                max_tokens=1500
            )
            
            # Parse JSON response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
            else:
                data = json.loads(response_text)
            
            # Extract risk locations
            unit_risk_locations = data.get("risk_locations", [])
            
            # Normalize risk_locations
            raw_risk_locations = []
            for loc in unit_risk_locations:
                raw_loc = {
                    "type": loc.get("type", "unknown"),
                    "severity": loc.get("severity", "medium"),
                    "evidence": loc.get("evidence", ""),
                    "policy": loc.get("policy"),
                    "primary_risk_pattern": loc.get("primary_risk_pattern")
                }
                if "start" in loc:
                    raw_loc["start"] = loc["start"]
                if "end" in loc:
                    raw_loc["end"] = loc["end"]
                raw_risk_locations.append(raw_loc)
            
            # Normalize risks for this paragraph
            normalized_risks = normalize_paragraph_risks(
                paragraph_id=paragraph_idx,
                raw_risk_locations=raw_risk_locations
            )
            
            return {
                "paragraph_index": paragraph_idx,
                "text": paragraph_text,
                "ethical_index": int(data.get("ethical_index", 50)),
                "compliance_score": int(data.get("compliance_score", 50)),
                "manipulation_score": int(data.get("manipulation_score", 50)),
                "bias_score": int(data.get("bias_score", 50)),
                "legal_risk_score": int(data.get("legal_risk_score", 50)),
                "flags": data.get("flags", []),
                "risk_locations": normalized_risks,
                "_raw_risk_locations": raw_risk_locations
            }
            
        except Exception as e:
            logger.error(f"[Stage-1] Error analyzing paragraph {paragraph_idx}: {str(e)}")
            return {
                "paragraph_index": paragraph_idx,
                "text": paragraph_text,
                "ethical_index": 50,
                "compliance_score": 50,
                "manipulation_score": 50,
                "bias_score": 50,
                "legal_risk_score": 50,
                "flags": ["analiz_hatası"],
                "risk_locations": []
            }


async def stage1_targeted_deep_analysis(
    content: str,
    stage0_result: Dict[str, Any],
    domain: Optional[str] = None,
    policies: Optional[List[str]] = None,
    provider: str = "openai",
    role: str = "proxy",  # "proxy_lite" or "proxy"
    analyze_all_paragraphs: bool = False  # If True, analyze all paragraphs regardless of risk detection
) -> Dict[str, Any]:
    """
    Stage-1: Targeted Deep Analysis
    
    Purpose: Deep analysis of only priority paragraphs identified in Stage-0
    Trigger: Only if risk_band != "low"
    Concurrency: Bounded (max 3 concurrent LLM calls)
    
    Args:
        content: Full content text
        stage0_result: Result from Stage-0 fast risk scan
        domain: Content domain
        policies: Policy set
        provider: LLM provider
        role: "proxy_lite" (max 2 paragraphs) or "proxy" (max 3-4 paragraphs)
    
    Returns:
        {
            "paragraph_analyses": [...],
            "all_flags": [...],
            "all_risk_locations": [...],
            "_stage1_latency_ms": float
        }
    """
    start_time = time.time()
    settings = get_settings()
    
    # Split content into paragraphs (lazy import)
    from backend.services.proxy_analyzer import split_into_paragraphs
    paragraphs = split_into_paragraphs(content)
    
    # If analyze_all_paragraphs is True, analyze all paragraphs
    if analyze_all_paragraphs:
        logger.info(f"[Stage-1] analyze_all_paragraphs=True - analyzing all {len(paragraphs)} paragraphs")
        valid_paragraphs = [(idx, para_text) for idx, para_text in enumerate(paragraphs)]
    else:
        # Check if Stage-1 should run
        risk_band = stage0_result.get("risk_band", "low")
        if risk_band == "low":
            logger.info("[Stage-1] Skipping deep analysis - risk_band is low")
            return {
                "paragraph_analyses": [],
                "all_flags": [],
                "all_risk_locations": [],
                "_stage1_latency_ms": 0
            }
        
        # Get priority paragraphs from Stage-0
        priority_paragraphs = stage0_result.get("priority_paragraphs", [])
        if not priority_paragraphs:
            logger.info("[Stage-1] No priority paragraphs identified, analyzing first paragraph")
            priority_paragraphs = [0]
        
        # Apply role-based limits
        max_paragraphs = 2 if role == "proxy_lite" else 4
        priority_paragraphs = priority_paragraphs[:max_paragraphs]
        
        # Filter to valid paragraph indices
        valid_paragraphs = [
            (idx, paragraphs[idx]) 
            for idx in priority_paragraphs 
            if 0 <= idx < len(paragraphs)
        ]
        
        if not valid_paragraphs:
            logger.warning("[Stage-1] No valid priority paragraphs, analyzing first paragraph")
            if paragraphs:
                valid_paragraphs = [(0, paragraphs[0])]
            else:
                return {
                    "paragraph_analyses": [],
                    "all_flags": [],
                    "all_risk_locations": [],
                    "_stage1_latency_ms": 0
                }
    
    logger.info(f"[Stage-1] Starting targeted deep analysis of {len(valid_paragraphs)} paragraphs (role={role}, max={max_paragraphs})")
    
    # Create tasks for bounded parallel execution
    tasks = [
        analyze_paragraph_deep(
            paragraph_idx=idx,
            paragraph_text=para_text,
            domain=domain,
            policies=policies,
            provider=provider,
            settings=settings
        )
        for idx, para_text in valid_paragraphs
    ]
    
    # Execute with bounded concurrency (semaphore already in analyze_paragraph_deep)
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Process results
    paragraph_analyses = []
    all_flags = []
    all_risk_locations = []
    
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error(f"[Stage-1] Paragraph {valid_paragraphs[i][0]} analysis failed: {result}")
            idx, para_text = valid_paragraphs[i]
            result = {
                "paragraph_index": idx,
                "text": para_text,
                "ethical_index": 50,
                "compliance_score": 50,
                "manipulation_score": 50,
                "bias_score": 50,
                "legal_risk_score": 50,
                "flags": ["analiz_hatası"],
                "risk_locations": []
            }
        
        paragraph_analyses.append(result)
        all_flags.extend(result.get("flags", []))
        all_risk_locations.extend(result.get("risk_locations", []))
    
    latency_ms = (time.time() - start_time) * 1000
    logger.info(f"[Stage-1] Targeted deep analysis completed in {latency_ms:.0f}ms for {len(paragraph_analyses)} paragraphs")
    
    return {
        "paragraph_analyses": paragraph_analyses,
        "all_flags": all_flags,
        "all_risk_locations": all_risk_locations,
        "_stage1_latency_ms": latency_ms
    }

