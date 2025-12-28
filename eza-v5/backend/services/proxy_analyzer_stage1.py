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


async def analyze_paragraph_light(
    paragraph_idx: int,
    paragraph_text: str,
    stage0_result: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Light mode analysis for low-risk paragraphs
    Uses heuristic scoring based on Stage-0 results, no LLM call
    """
    # Get estimated score from Stage-0
    estimated_range = stage0_result.get("estimated_score_range", [70, 90])
    avg_score = sum(estimated_range) // 2
    
    # Light mode: minimal analysis, no deep reasoning
    return {
        "paragraph_index": paragraph_idx,
        "text": paragraph_text,
        "ethical_index": avg_score,
        "compliance_score": avg_score + 5,
        "manipulation_score": avg_score - 5,
        "bias_score": avg_score,
        "legal_risk_score": avg_score + 3,
        "flags": [],
        "risk_locations": [],
        "analysis_level": "light",
        "summary": "Düşük risk tespit edildi – derin analiz gerekli görülmedi"
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
    Stage-1: Targeted Deep Analysis (Premium Unified Flow)
    
    Purpose: Analysis of paragraphs - ALWAYS runs, but in light or deep mode
    - risk_band == "low": Light mode (heuristic, fast, all paragraphs)
    - risk_band != "low": Deep mode (LLM-based, priority paragraphs)
    
    CRITICAL: Never returns empty paragraph_analyses
    """
    start_time = time.time()
    settings = get_settings()
    
    # Split content into paragraphs (lazy import)
    from backend.services.proxy_analyzer import split_into_paragraphs
    paragraphs = split_into_paragraphs(content)
    
    # Ensure at least one paragraph exists
    if not paragraphs:
        paragraphs = [content] if content.strip() else [""]
    
    risk_band = stage0_result.get("risk_band", "low")
    
    # PREMIUM FLOW: Stage-1 ALWAYS runs
    if risk_band == "low":
        # LIGHT MODE: Fast heuristic analysis for all paragraphs
        logger.info(f"[Stage-1] Light mode - analyzing all {len(paragraphs)} paragraphs with heuristic scoring")
        mode = "light"
        
        paragraph_analyses = []
        for idx, para_text in enumerate(paragraphs):
            light_analysis = await analyze_paragraph_light(idx, para_text, stage0_result)
            paragraph_analyses.append(light_analysis)
        
        all_flags = []
        all_risk_locations = []
        
    elif analyze_all_paragraphs:
        # DEEP MODE: Analyze all paragraphs
        logger.info(f"[Stage-1] Deep mode (all paragraphs) - analyzing all {len(paragraphs)} paragraphs")
        mode = "deep"
        valid_paragraphs = [(idx, para_text) for idx, para_text in enumerate(paragraphs)]
        
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
        
        # Execute with bounded concurrency
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
                    "risk_locations": [],
                    "analysis_level": "deep"
                }
            
            result["analysis_level"] = "deep"
            paragraph_analyses.append(result)
            all_flags.extend(result.get("flags", []))
            all_risk_locations.extend(result.get("risk_locations", []))
    
    else:
        # DEEP MODE: Analyze priority paragraphs only
        mode = "deep"
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
                # Fallback: analyze first paragraph
                valid_paragraphs = [(0, content)]
        
        logger.info(f"[Stage-1] Deep mode - analyzing {len(valid_paragraphs)} priority paragraphs")
    
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
        
            result["analysis_level"] = "deep"
            paragraph_analyses.append(result)
            all_flags.extend(result.get("flags", []))
            all_risk_locations.extend(result.get("risk_locations", []))
    
    # CRITICAL: Ensure paragraph_analyses is never empty
    if not paragraph_analyses:
        logger.warning("[Stage-1] No paragraph analyses generated, creating fallback for first paragraph")
        paragraph_analyses = [await analyze_paragraph_light(0, paragraphs[0] if paragraphs else content, stage0_result)]
        mode = "light"  # Fallback to light mode
    
    latency_ms = (time.time() - start_time) * 1000
    logger.info(f"[Stage-1] Analysis completed in {latency_ms:.0f}ms: mode={mode}, paragraphs={len(paragraph_analyses)}")
    
    return {
        "paragraph_analyses": paragraph_analyses,
        "all_flags": all_flags,
        "all_risk_locations": all_risk_locations,
        "_stage1_latency_ms": latency_ms,
        "_stage1_mode": mode  # "light" | "deep"
    }

