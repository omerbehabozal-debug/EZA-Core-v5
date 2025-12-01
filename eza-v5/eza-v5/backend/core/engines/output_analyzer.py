# -*- coding: utf-8 -*-
"""
Output Analyzer Engine (Light version for Fast Pipeline)
"""

from typing import Dict, Any, List
import re


def analyze_output(output_text: str, input_analysis: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Light output analysis for Fast Core Pipeline
    Checks if output aligns with input intent and safety requirements
    """
    risk_flags: List[str] = []
    risk_score = 0.0
    
    # Check for harmful content in output
    harmful_patterns = {
        "violence": r"\b(kill|murder|harm|attack|violence)\b",
        "illegal": r"\b(illegal|drug|weapon|hack|steal)\b",
        "harmful": r"\b(suicide|self.harm|dangerous)\b",
    }
    
    output_lower = output_text.lower()
    
    for pattern_name, pattern in harmful_patterns.items():
        if re.search(pattern, output_lower, re.IGNORECASE):
            risk_flags.append(f"output_{pattern_name}")
            risk_score = max(risk_score, 0.6)
    
    # Quality check
    quality_score = 50.0
    if len(output_text) > 50:
        quality_score += 20
    if len(output_text) > 200:
        quality_score += 10
    
    return {
        "ok": True,
        "risk_score": risk_score,
        "risk_level": "high" if risk_score > 0.7 else "medium" if risk_score > 0.4 else "low",
        "risk_flags": risk_flags,
        "quality_score": quality_score,
        "output_length": len(output_text),
        "raw_text": output_text  # Store original text for score calculation
    }

