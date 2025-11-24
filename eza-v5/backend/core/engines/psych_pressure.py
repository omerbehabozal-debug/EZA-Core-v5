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
    
    # Pressure patterns (English and Turkish)
    pressure_patterns = {
        "guilt_trip": r"\b(you.owe|you.should.feel|disappointed|borçlusun|hayal.kırıklığı)\b",
        "fear_appeal": r"\b(danger|threat|consequences|punishment|tehlike|tehdit|sonuç|ceza)\b",
        "social_proof": r"\b(everyone.is|all.people|most.users|herkes|tüm.insanlar|çoğu.kullanıcı)\b",
        "scarcity": r"\b(limited|only.few|last.chance|sınırlı|az|son.şans)\b",
        "reciprocity": r"\b(I.did.for.you|I.helped.you|senin.için.yaptım|yardım.ettim)\b",
        "urgency": r"\b(urgent|immediately|now|acil|hemen|şimdi|lütfen.acil|please.urgent)\b",
        "reassurance": r"\b(kötü.bir.şey.yapmayacağım|won't.do.anything.bad|zararsız|harmless|just.curious|sadece.merak)\b"
    }
    
    text_lower = text.lower()
    
    for pattern_name, pattern in pressure_patterns.items():
        matches = len(re.findall(pattern, text_lower, re.IGNORECASE))
        if matches > 0:
            patterns.append({
                "type": pattern_name,
                "count": matches
            })
            # Higher weight for urgency and reassurance patterns
            if pattern_name in ["urgency", "reassurance"]:
                score += matches * 0.25  # Higher weight for these patterns
            else:
                score += matches * 0.15
    
    score = min(score, 1.0)
    
    return {
        "ok": True,
        "score": score,
        "level": "high" if score > 0.7 else "medium" if score > 0.4 else "low",
        "patterns": patterns,
        "summary": f"Psychological pressure detected: {len(patterns)} pattern types" if patterns else "No significant psychological pressure detected"
    }

