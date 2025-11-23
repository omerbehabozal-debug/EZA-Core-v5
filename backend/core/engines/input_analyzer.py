# -*- coding: utf-8 -*-
"""
Input Analyzer Engine (Light version for Fast Pipeline)
"""

from typing import Dict, Any, List
import re


def analyze_input(text: str) -> Dict[str, Any]:
    """
    Light input analysis for Fast Core Pipeline
    Returns risk flags, intent hints, and basic safety signals
    """
    risk_flags: List[str] = []
    risk_score = 0.0
    
    # Basic risk patterns (lightweight)
    risk_patterns = {
        "violence": [r"\b(kill|murder|harm|attack|violence)\b", 0.7],
        "illegal": [r"\b(illegal|drug|weapon|hack|steal)\b", 0.6],
        "harmful": [r"\b(suicide|self.harm|dangerous)\b", 0.8],
        "manipulation": [r"\b(manipulate|trick|deceive|scam)\b", 0.5],
    }
    
    text_lower = text.lower()
    
    for pattern_name, (pattern, score) in risk_patterns.items():
        if re.search(pattern, text_lower, re.IGNORECASE):
            risk_flags.append(pattern_name)
            risk_score = max(risk_score, score)
    
    # Intent detection (simplified)
    intent = "information"
    if any(word in text_lower for word in ["hello", "hi", "greeting"]):
        intent = "greeting"
    elif any(word in text_lower for word in ["how", "what", "why", "explain"]):
        intent = "question"
    elif any(word in text_lower for word in ["create", "make", "generate", "write"]):
        intent = "generation"
    
    return {
        "ok": True,
        "risk_score": risk_score,
        "risk_level": "high" if risk_score > 0.7 else "medium" if risk_score > 0.4 else "low",
        "risk_flags": risk_flags,
        "intent": intent,
        "text_length": len(text),
        "language": "en"  # Simplified
    }

