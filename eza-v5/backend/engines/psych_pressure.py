# -*- coding: utf-8 -*-
"""
Psychological Pressure Detector (Deep)
Detects psychological manipulation and pressure tactics
"""

from typing import Dict, Any, List
import re


def analyze_psychological_pressure(
    text: str,
    memory: List[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Analyze psychological pressure and manipulation
    Returns pressure score and patterns
    """
    patterns = []
    score = 0.0
    
    # Pressure patterns
    pressure_patterns = {
        "guilt_trip": r"\b(you.owe|you.should.feel|disappointed)\b",
        "fear_appeal": r"\b(danger|threat|consequences|punishment)\b",
        "social_proof": r"\b(everyone.is|all.people|most.users)\b",
        "scarcity": r"\b(limited|only.few|last.chance)\b",
        "reciprocity": r"\b(I.did.for.you|I.helped.you)\b"
    }
    
    text_lower = text.lower()
    
    for pattern_name, pattern in pressure_patterns.items():
        matches = len(re.findall(pattern, text_lower, re.IGNORECASE))
        if matches > 0:
            patterns.append({
                "type": pattern_name,
                "count": matches
            })
            score += matches * 0.15
    
    score = min(score, 1.0)
    
    return {
        "ok": True,
        "score": score,
        "level": "high" if score > 0.7 else "medium" if score > 0.4 else "low",
        "patterns": patterns,
        "summary": f"Psychological pressure detected: {len(patterns)} pattern types" if patterns else "No significant psychological pressure detected"
    }

