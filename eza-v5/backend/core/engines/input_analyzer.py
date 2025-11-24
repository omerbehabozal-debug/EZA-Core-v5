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
    
    # Basic risk patterns (lightweight) - English and Turkish
    risk_patterns = {
        "violence": [r"\b(kill|murder|harm|attack|violence|öldür|cinayet|zarar|saldırı|şiddet)\b", 0.7],
        "illegal": [r"\b(illegal|drug|weapon|hack|steal|yasal.değil|uyuşturucu|ilaç|silah|hackleme|çal)\b", 0.6],
        "harmful": [r"\b(suicide|self.harm|dangerous|intihar|kendine.zarar|tehlikeli)\b", 0.8],
        "manipulation": [r"\b(manipulate|trick|deceive|scam|manipüle|aldat|hile|dolandır)\b", 0.5],
        "hacking": [r"\b(hack|hacking|unauthorized.access|break.into|bypass|exploit|sızma|hackleme|yetkisiz.erişim|kırma|atlama)\b", 0.7],
        "drug_production": [r"\b(drug|drugs|make.drugs|produce.drugs|drug.production|uyuşturucu|ilaç.üretimi|uyuşturucu.üretimi|ilaç.yapımı)\b", 0.8],
    }
    
    text_lower = text.lower()
    
    # Calculate risk score - accumulate scores for multiple patterns
    pattern_scores = []
    for pattern_name, (pattern, score) in risk_patterns.items():
        if re.search(pattern, text_lower, re.IGNORECASE):
            risk_flags.append(pattern_name)
            pattern_scores.append(score)
    
    # Risk score calculation: use max as base, but add penalty for multiple patterns
    if pattern_scores:
        risk_score = max(pattern_scores)
        # Add penalty for multiple risk patterns (up to 0.2 additional)
        if len(pattern_scores) > 1:
            risk_score = min(1.0, risk_score + (len(pattern_scores) - 1) * 0.1)
    
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

