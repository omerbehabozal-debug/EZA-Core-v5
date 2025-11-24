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
    
    # Deception patterns (English and Turkish)
    deception_patterns = {
        "false_urgency": r"\b(urgent|immediately|now|limited.time|acil|hemen|şimdi)\b",
        "authority_claim": r"\b(official|government|verified|certified|resmi|hükümet|doğrulanmış)\b",
        "emotional_manipulation": r"\b(you.must|you.should|everyone.is|yapmalısın|herkes)\b",
        "withholding_info": r"\b(secret|confidential|don't.tell|gizli|söyleme)\b",
        "reverse_questioning": r"\b(tersinden|reverse|opposite|ters)\b",
        "innocent_masking": r"\b(masum|innocent|just.for.education|sadece.eğitim|for.research|araştırma.için|kötü.bir.şey.yapmayacağım|won't.do.anything.bad)\b",
        "indirect_intent": r"\b(dolaylı|indirect|implicit|dolaylı.olarak|implicitly)\b",
        "education_excuse": r"\b(just.for.education|for.research|educational|eğitim.için|araştırma|academic)\b",
        "reassurance": r"\b(kötü.bir.şey.yapmayacağım|won't.harm|just.curious|sadece.merak|harmless|zararsız)\b"
    }
    
    text_lower = text.lower()
    
    for pattern_name, pattern in deception_patterns.items():
        matches = len(re.findall(pattern, text_lower, re.IGNORECASE))
        if matches > 0:
            flags.append(pattern_name)
            # Higher weight for specific deception patterns
            if pattern_name in ["reverse_questioning", "innocent_masking", "indirect_intent", "education_excuse", "reassurance"]:
                score += matches * 0.3  # Higher weight for these patterns
            else:
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

