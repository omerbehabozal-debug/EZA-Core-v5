# -*- coding: utf-8 -*-
"""
identity_block.py – EZA-Core v4.0

IdentityBlock v3.0: Detects face/identity recognition and personal information
extraction risks.
"""

from typing import Dict, List, Any


def analyze_identity_risk(text: str) -> Dict[str, Any]:
    """
    Analyze identity risk in text.
    
    Detects:
    - Face recognition attempts
    - Identity extraction (TC, ID numbers)
    - Biometric data requests
    - Relationship deduction attempts
    - Private person identification
    
    Args:
        text: Input text to analyze
        
    Returns:
        {
            "ok": True,
            "identity_hits": [...],
            "identity_risk_score": float,
            "identity_level": str,
            "summary": str
        }
    """
    if not text or not text.strip():
        return {
            "ok": True,
            "identity_hits": [],
            "identity_risk_score": 0.0,
            "identity_level": "low",
            "summary": "No text provided",
        }
    
    RISK_KEYWORDS = {
        "face": [
            "yüzü", "fotoğraftaki", "resimdeki", "yüz tanı", "kim bu", "kimdir",
            "yüz tanıma", "yüz tanıma", "fotoğrafta kim", "resimde kim",
            "bu kim", "bu kişi kim", "kim bu kişi",
        ],
        "identity": [
            "kimlik", "tc", "tc kimlik", "nüfus no", "kimlik numarası",
            "tc no", "t.c. kimlik", "nüfus cüzdanı", "kimlik kartı",
        ],
        "biometric": [
            "parmak izi", "retina", "dna", "biyometrik",
            "biometric", "fingerprint", "iris",
        ],
        "relationship": [
            "akraba mı", "annem mi", "babam mı", "kuzenim mi", "eşim mi",
            "kardeşim mi", "amcam mı", "teyzem mi", "dayım mı",
            "akrabam mı", "yakınım mı",
        ],
        "private_person": [
            "öğretmenim", "komşum", "patronum", "sevgilim",
            "hocam", "müdürüm", "doktorum", "avukatım",
            "arkadaşım", "tanıdığım",
        ],
    }
    
    text_lower = text.lower()
    hits = []
    score = 0.0
    
    for category, words in RISK_KEYWORDS.items():
        for w in words:
            if w.lower() in text_lower:
                hits.append({"category": category, "keyword": w})
                score += 0.25
    
    score = min(score, 1.0)
    
    identity_level = (
        "critical" if score > 0.8 else
        "high" if score > 0.5 else
        "medium" if score > 0.25 else
        "low"
    )
    
    return {
        "ok": True,
        "identity_hits": hits,
        "identity_risk_score": round(score, 4),
        "identity_level": identity_level,
        "summary": f"Identity risk evaluation completed. Score={score:.2f}",
    }

