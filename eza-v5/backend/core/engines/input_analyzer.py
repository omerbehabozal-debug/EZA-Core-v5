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
        "violence": [r"\b(kill|murder|harm|attack|violence|harm.someone|hurt.someone|injure|öldür|cinayet|zarar|saldırı|şiddet|birine.zarar|birini.yarala|birini.öldür)\b", 0.8],
        "illegal": [r"\b(illegal|drug|weapon|hack|steal|yasal.değil|uyuşturucu|ilaç|silah|hackleme|çal|yasadışı)\b", 0.6],
        "harmful": [r"\b(suicide|self.harm|dangerous|intihar|kendine.zarar|kendime.zarar|zarar.vermek|zarar.ver|tehlikeli|kendini.öldür|kendimi.öldür)\b", 0.8],
        "manipulation": [r"\b(manipulate|trick|deceive|scam|fraud|commit.fraud|phishing|generate.phishing|create.phishing|manipüle|aldat|hile|dolandır|dolandırıcılık|sahte|fake)\b", 0.7],
        "academic_dishonesty": [r"\b(cheat|cheating|plagiarism|plagiarize|copy\s+work|copy\s+homework|copy\s+assignment|copy\s+exam|copy\s+test|copy\s+answer|copy\s+answers|academic\s+dishonesty|academic\s+fraud|kopya|kopya\s+çek|kopya\s+çekme|kopya\s+çekmek|intihal|ödev\s+kopyala|sınav\s+kopyala|kopya\s+uzmanlığı|kopya\s+uzmanı|nasıl\s+kopya\s+çek|kopya\s+çekmeyi\s+öğret|kopya\s+çekmeyi\s+öğren)\b", 0.7],
        "offensive_content": [r"\b(offensive|insult|insulting|rude|vulgar|obscene|profanity|swear|curse|bad.joke|insulting.joke|offensive.joke|kötü|kötü.şaka|hakaret|hakaret.dolu|küfür|kaba|edepsiz|müstehcen|küfürlü|küfürlü.şaka|hakaret.et|kötü.söz)\b", 0.7],
        "hate_speech": [r"\b(hate|hatred|discriminate|discrimination|racist|racism|sexist|sexism|homophobic|transphobic|nefret|ayrımcılık|ırkçı|ırkçılık|cinsiyetçi|cinsiyetçilik)\b", 0.8],
        "hacking": [r"\b(hack|hacking|unauthorized.access|break.into|bypass|bypass\s+security|bypass\s+protection|bypass\s+encryption|exploit|break\s+encryption|break\s+security|break\s+protection|crack|crack\s+encryption|crack\s+password|how\s+to\s+crack|hijack|hijack\s+session|how\s+to\s+hijack|how\s+to\s+bypass|how\s+to\s+break|sızma|hackleme|yetkisiz.erişim|kırma|atlama|şifre.kırma|bilgisayar.sızmak|sisteme.sızmak|başkasının.bilgisayarına|başkasının.sistemine)\b", 0.7],
        "drug_production": [r"\b(drug|drugs|make\s+(illegal\s+)?drugs|produce\s+(illegal\s+)?drugs|drug\s+production|illegal\s+drugs|how\s+to\s+make\s+drugs|how\s+to\s+produce\s+drugs|uyuşturucu|ilaç\s+üretimi|uyuşturucu\s+üretimi|ilaç\s+yapımı|uyuşturucu.yapmak|uyuşturucu.üretmek)\b", 0.8],
        "privacy_violation": [r"\b(access.someone's.private|private.data|private.messages|unauthorized.access|steal\s+data|steal\s+.*data|breach\s+privacy|breach\s+security|breach\s+protection|how\s+to\s+breach|özel.veri|özel.mesajlar|yetkisiz.erişim|veri.çal|gizlilik.ihlali|başkasının.verilerine|başkasının.bilgilerine)\b", 0.8],
        "theft": [r"\b(steal|theft|robbery|pirate|piracy|pirate\s+software|illegal\s+download|çal|hırsızlık|soygun|korsan|çalmak|hırsızlık.yapmak)\b", 0.7],
        # Additional patterns for common risky question formats
        "risky_question": [r"\b(how\s+to\s+(hack|steal|harm|attack|break|bypass|crack|exploit|kill|murder|cheat)|nasıl\s+(hack|çal|zarar|saldır|kır|atlama|öldür|cinayet|kopya\s+çek)|how\s+can\s+i\s+(hack|steal|harm|attack|break|bypass|cheat)|nasıl\s+yapabilirim\s+(hack|çal|zarar|saldır|kopya\s+çek))\b", 0.75],
        # Hacker-related questions (medium risk - could be educational but also risky)
        "hacker_question": [r"\b(how\s+to\s+become\s+a\s+hacker|how\s+to\s+be\s+a\s+hacker|nasıl\s+hacker\s+olurum|nasıl\s+hacker\s+olunur|hacker\s+olmak|hacker\s+olurum|hacker\s+nasıl\s+olunur)\b", 0.6],
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
        r"\b(writing|novel|story|book|research|study|educational|academic|researcher|security.researcher|writing.a.story|kitap|roman|hikaye|araştırma|eğitim|araştırmacı|güvenlik.araştırmacısı|hikaye.yazıyorum)\b",
        r"\b(character|fictional|hypothetical|theoretical|karakter|kurgusal|varsayımsal|teorik)\b",
        r"\b(understand|learn|explain|how.works|how.do|security.systems|common.vulnerabilities|anlamak|öğrenmek|açıkla|nasıl.çalışır|güvenlik.sistemleri|yaygın.güvenlik.açıkları)\b",
        r"^(explain|tell.me|can.you.explain|what.is|how.does|how.do|how.can|what.are|how.are|how.is|açıkla|anlat|nasıl|nedir|ne.demek)",
        r"\b(explain\s+how|explain\s+what|explain\s+why|explain\s+the|how\s+does\s+\w+\s+work|how\s+do\s+\w+\s+work|what\s+is\s+\w+|what\s+are\s+\w+)\b"
    ]
    
    has_masking = any(re.search(pattern, text_lower, re.IGNORECASE) for pattern in masking_patterns)
    
    # Special handling for educational questions: "explain how X works", "what is X", etc.
    educational_patterns = [
        r"^(explain|what.is|how.does|how.do|tell.me.about|can.you.explain)",
        r"\b(explain\s+how\s+\w+\s+works?|explain\s+what\s+\w+\s+is|how\s+does\s+\w+\s+work|what\s+is\s+\w+)\b"
    ]
    is_educational_question = any(re.search(pattern, text_lower, re.IGNORECASE) for pattern in educational_patterns)
    
    # BUT: Exclude risky educational questions (those with harmful keywords)
    risky_keywords_in_question = ["break", "hack", "steal", "harm", "attack", "fraud", "bypass", "crack", "exploit", "hijack", "breach", "kötü", "hakaret", "offensive", "insult", "rude", "vulgar"]
    if is_educational_question:
        # If educational question contains risky keywords, it's not truly educational
        if any(re.search(rf"\b{keyword}\b", text_lower, re.IGNORECASE) for keyword in risky_keywords_in_question):
            is_educational_question = False
    
    # If it's an educational question and no clear risk patterns, set low risk
    # BUT: Check again after pattern matching - if patterns were found, it's risky
    # IMPORTANT: Only apply educational question logic if NO risk patterns were found
    # If risk patterns exist, ignore educational question logic (it's risky regardless)
    if is_educational_question and not pattern_scores and risk_score == 0.0:
        # Double-check: if question contains risky keywords, it's not safe
        risky_question_keywords = ["break", "hack", "steal", "harm", "attack", "fraud", "bypass", "crack", "exploit", "hijack", "breach", "kötü", "hakaret", "offensive", "insult", "rude", "vulgar", "bad", "joke"]
        if not any(re.search(rf"\b{keyword}\b", text_lower, re.IGNORECASE) for keyword in risky_question_keywords):
            # Add variations based on text characteristics for score diversity
            # Use a wider range to create more noticeable score differences
            text_length = len(text)
            word_count = len(text.split())
            
            # Create more variation: 0.01 to 0.15 range based on text characteristics
            # Shorter questions get slightly higher risk (0.08-0.15)
            # Longer questions get lower risk (0.01-0.08)
            if text_length < 30:
                # Very short questions
                base_risk = 0.12
                length_factor = min(0.03, (30 - text_length) / 1000.0)
            elif text_length < 100:
                # Short questions
                base_risk = 0.08
                length_factor = min(0.04, (100 - text_length) / 2000.0)
            elif text_length < 200:
                # Medium questions
                base_risk = 0.04
                length_factor = min(0.03, (200 - text_length) / 5000.0)
            else:
                # Long questions
                base_risk = 0.01
                length_factor = min(0.02, text_length / 10000.0)
            
            # Add word count variation
            word_factor = min(0.02, word_count / 1000.0)
            risk_score = base_risk + length_factor + word_factor
            risk_score = min(0.15, max(0.01, risk_score))  # Clamp to 0.01-0.15 range
    
    # Special case: security researcher asking about vulnerabilities (gray area)
    if re.search(r"\b(security.researcher|güvenlik.araştırmacısı|researcher.studying.security)\b", text_lower, re.IGNORECASE):
        if re.search(r"\b(vulnerabilities|security.systems|güvenlik.açıkları|güvenlik.sistemleri)\b", text_lower, re.IGNORECASE):
            # This is gray area - legitimate research context
            risk_score = 0.5  # Medium risk for gray area
            if "gray_area" not in risk_flags:
                risk_flags.append("gray_area")
    
    # Gray area: if masking patterns exist with security-related content, set medium risk
    if has_masking and risk_score < 0.3:
        # Check if text mentions security, hacking, bypass, etc. (potentially risky topics)
        security_keywords = [
            r"\b(security|hack|bypass|exploit|vulnerability|güvenlik|sızma|atlama|güvenlik.açığı)\b"
        ]
        has_security_keyword = any(re.search(pattern, text_lower, re.IGNORECASE) for pattern in security_keywords)
        
        # But exclude educational questions about encryption, security concepts
        educational_security_keywords = [
            r"\b(encryption|encrypt|decrypt|cryptography|ssl|tls|https|security.protocol|güvenlik.protokolü)\b"
        ]
        is_educational_security = any(re.search(pattern, text_lower, re.IGNORECASE) for pattern in educational_security_keywords)
        
        if has_security_keyword and not is_educational_security:
            # This is gray area - masking + security topic = medium risk
            risk_score = 0.5
            if "gray_area" not in risk_flags:
                risk_flags.append("gray_area")
        elif is_educational_security and is_educational_question:
            # Educational question about security concepts = low risk
            # BUT: If it contains "break", "hack", "crack", etc., it's risky
            risky_security_keywords = ["break", "hack", "crack", "bypass", "exploit", "attack"]
            if not any(re.search(rf"\b{keyword}\b", text_lower, re.IGNORECASE) for keyword in risky_security_keywords):
                # Add variations for score diversity - wider range
                text_length = len(text)
                if text_length < 50:
                    risk_score = 0.06
                elif text_length < 150:
                    risk_score = 0.03
                else:
                    risk_score = 0.01
                risk_score = min(0.10, max(0.01, risk_score))
    
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
        "language": "en",  # Simplified
        "raw_text": text  # Store original text for score calculation
    }

