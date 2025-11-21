# -*- coding: utf-8 -*-
"""
Deception Engine (Deep)
Detects deception and manipulation patterns
"""

from typing import Dict, Any, List
import re


def analyze_deception(
    text: str,
    report: Dict[str, Any],
    memory: List[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Analyze deception and manipulation patterns
    Returns deception score and flags
    """
    flags = []
    score = 0.0
    
    # Deception patterns
    deception_patterns = {
        "false_urgency": r"\b(urgent|immediately|now|limited.time)\b",
        "authority_claim": r"\b(official|government|verified|certified)\b",
        "emotional_manipulation": r"\b(you.must|you.should|everyone.is)\b",
        "withholding_info": r"\b(secret|confidential|don't.tell)\b"
    }
    
    text_lower = text.lower()
    
    for pattern_name, pattern in deception_patterns.items():
        matches = len(re.findall(pattern, text_lower, re.IGNORECASE))
        if matches > 0:
            flags.append(pattern_name)
            score += matches * 0.2
    
    # Check consistency with memory
    if memory:
        # Simplified consistency check
        # In production, use more sophisticated NLP
        for mem_entry in memory[-3:]:
            if mem_entry.get("role") == "user":
                # Check for contradictions
                pass  # Placeholder
    
    score = min(score, 1.0)
    
    return {
        "ok": True,
        "score": score,
        "level": "high" if score > 0.7 else "medium" if score > 0.4 else "low",
        "flags": flags,
        "summary": f"Deception patterns detected: {', '.join(flags)}" if flags else "No significant deception patterns detected"
    }

