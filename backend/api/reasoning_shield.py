# -*- coding: utf-8 -*-
"""
reasoning_shield.py – EZA-Core v4.0

ReasoningShield v5.0: Detects manipulative reasoning, psychological coercion,
fictional scenarios, and hidden intent patterns.
"""

from typing import Dict, List, Any


# Manipülasyon Sözlükleri
HIDDEN_INTENT = [
    "fark ettirmeden", "çaktırmadan", "belli etmeden",
    "anlamadan", "hissettirmeden", "ikna etmek", "etkilemek",
    "istediğim gibi yönlendirmek", "kandırmak", "inandırmak",
    "gizlice", "haberi olmadan", "izinsiz", "habersizce",
    "fark ettirmeden", "gizli", "sessizce",
]

# Psikolojik Baskı / Coercion Tespiti
COERCION = [
    "zorlamak", "mecbur bıraktım", "tehdit",
    "ısrarla", "pes ettirmek", "baskı yapmak",
    "zorunda bırakmak", "mecbur etmek", "zorla",
    "baskı kurmak", "tehdit etmek", "korkutmak",
]

# Sahte Senaryo / Fictional Risk
FICTIONAL = [
    "diyelim ki", "farz edelim", "varsayalım",
    "hayali olarak", "kurgu", "rol yaparak",
    "hipotetik", "teorik", "varsayalım ki",
    "sadece merak", "sadece bilgi", "öğrenmek istiyorum",
]


def analyze_reasoning_patterns(text: str) -> Dict[str, Any]:
    """
    Analyze reasoning patterns in text.
    
    Detects:
    - Hidden intent / manipulation
    - Psychological coercion
    - Fictional scenarios
    - Reasoning risk score
    
    Args:
        text: Input text to analyze
        
    Returns:
        {
            "red_flags": [...],
            "psychology_hits": [...],
            "fiction_risk": float,
            "manipulation_level": float,
            "coercion_level": float,
            "reasoning_score": float,
            "summary": "..."
        }
    """
    if not text or not text.strip():
        return {
            "red_flags": [],
            "psychology_hits": [],
            "fiction_risk": 0.0,
            "manipulation_level": 0.0,
            "coercion_level": 0.0,
            "reasoning_score": 0.0,
            "summary": "No text provided",
        }
    
    text_lower = text.lower()
    
    # 1) Detect hidden intent / manipulation
    manipulation_hits = []
    for phrase in HIDDEN_INTENT:
        if phrase in text_lower:
            manipulation_hits.append(phrase)
    
    manipulation_level = len(manipulation_hits) * 0.25
    manipulation_level = min(manipulation_level, 1.0)
    
    # 2) Detect psychological coercion
    coercion_hits = []
    for phrase in COERCION:
        if phrase in text_lower:
            coercion_hits.append(phrase)
    
    coercion_level = len(coercion_hits) * 0.30
    coercion_level = min(coercion_level, 1.0)
    
    # 3) Detect fictional scenarios
    fictional_hits = []
    for phrase in FICTIONAL:
        if phrase in text_lower:
            fictional_hits.append(phrase)
    
    fiction_risk = len(fictional_hits) * 0.20
    fiction_risk = min(fiction_risk, 1.0)
    
    # 4) Calculate reasoning score (combined max)
    reasoning_score = max(manipulation_level, coercion_level, fiction_risk)
    
    # 5) Collect red flags
    red_flags = []
    if manipulation_level >= 0.5:
        red_flags.append("reasoning-manipulation")
    if coercion_level >= 0.5:
        red_flags.append("psychological-coercion")
    if fiction_risk >= 0.5:
        red_flags.append("fiction-risk")
    
    # 6) Psychology hits (all detected patterns)
    psychology_hits = manipulation_hits + coercion_hits + fictional_hits
    
    # 7) Generate summary
    summary_parts = []
    if manipulation_hits:
        summary_parts.append(f"Manipulation detected ({len(manipulation_hits)} hits)")
    if coercion_hits:
        summary_parts.append(f"Coercion detected ({len(coercion_hits)} hits)")
    if fictional_hits:
        summary_parts.append(f"Fictional scenario detected ({len(fictional_hits)} hits)")
    
    if summary_parts:
        summary = " | ".join(summary_parts)
    else:
        summary = "No reasoning risks detected"
    
    return {
        "red_flags": red_flags,
        "psychology_hits": psychology_hits,
        "fiction_risk": round(fiction_risk, 4),
        "manipulation_level": round(manipulation_level, 4),
        "coercion_level": round(coercion_level, 4),
        "reasoning_score": round(reasoning_score, 4),
        "summary": summary,
    }

