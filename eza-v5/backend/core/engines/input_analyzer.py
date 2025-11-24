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
        "violence": [r"\b(kill|murder|harm|attack|violence|harm.someone|öldür|cinayet|zarar|saldırı|şiddet|birine.zarar)\b", 0.8],
        "illegal": [r"\b(illegal|drug|weapon|hack|steal|yasal.değil|uyuşturucu|ilaç|silah|hackleme|çal)\b", 0.6],
        "harmful": [r"\b(suicide|self.harm|dangerous|intihar|kendine.zarar|tehlikeli)\b", 0.8],
        "manipulation": [r"\b(manipulate|trick|deceive|scam|manipüle|aldat|hile|dolandır)\b", 0.5],
        "hacking": [r"\b(hack|hacking|unauthorized.access|break.into|bypass|exploit|sızma|hackleme|yetkisiz.erişim|kırma|atlama)\b", 0.7],
        "drug_production": [r"\b(drug|drugs|make.drugs|produce.drugs|drug.production|uyuşturucu|ilaç.üretimi|uyuşturucu.üretimi|ilaç.yapımı)\b", 0.8],
        "privacy_violation": [r"\b(access.someone's.private|private.data|private.messages|unauthorized.access|özel.veri|özel.mesajlar|yetkisiz.erişim)\b", 0.8],
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
    
    # Gray area detection: if risk patterns exist but text contains masking/legitimate context
    masking_patterns = [
        r"\b(writing|novel|story|book|research|study|educational|academic|researcher|security.researcher|kitap|roman|hikaye|araştırma|eğitim|araştırmacı|güvenlik.araştırmacısı)\b",
        r"\b(character|fictional|hypothetical|theoretical|karakter|kurgusal|varsayımsal|teorik)\b",
        r"\b(understand|learn|explain|how.works|common.vulnerabilities|anlamak|öğrenmek|açıkla|nasıl.çalışır|yaygın.güvenlik.açıkları)\b"
    ]
    
    has_masking = any(re.search(pattern, text_lower, re.IGNORECASE) for pattern in masking_patterns)
    
    # Special case: security researcher asking about vulnerabilities (gray area)
    if re.search(r"\b(security.researcher|güvenlik.araştırmacısı|researcher.studying.security)\b", text_lower, re.IGNORECASE):
        if re.search(r"\b(vulnerabilities|security.systems|güvenlik.açıkları|güvenlik.sistemleri)\b", text_lower, re.IGNORECASE):
            # This is gray area - legitimate research context
            risk_score = 0.5  # Medium risk for gray area
            if "gray_area" not in risk_flags:
                risk_flags.append("gray_area")
    
    # If risk exists but masking is present, adjust to gray area (medium risk)
    if risk_score > 0.3 and has_masking and risk_score < 0.8:
        # Keep in medium range (0.3-0.7) for gray area
        risk_score = min(0.7, max(0.3, risk_score))
    
    # Intent detection (improved)
    intent = "information"
    text_lower_stripped = text_lower.strip()
    
    # Check for greeting first (more specific)
    greeting_patterns = [
        r"^(hello|hi|hey|greetings|merhaba|selam)",
        r"\b(how.are.you|how.do.you.do|what's.up|nasılsın|naber)\b"
    ]
    is_greeting = any(re.search(pattern, text_lower, re.IGNORECASE) for pattern in greeting_patterns)
    
    if is_greeting:
        intent = "greeting"
    # Check for question patterns (how, what, why, explain, tell me, can you)
    elif any(re.search(rf"\b({word})\b", text_lower, re.IGNORECASE) 
             for word in ["how", "what", "why", "when", "where", "who", "explain", "tell.me", "can.you", "could.you"]):
        intent = "question"
    # Check for generation patterns (create, make, generate, write, build)
    elif any(re.search(rf"\b({word})\b", text_lower, re.IGNORECASE) 
             for word in ["create", "make", "generate", "write", "build", "produce", "yap", "oluştur", "üret"]):
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

