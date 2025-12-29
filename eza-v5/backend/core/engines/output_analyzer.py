# -*- coding: utf-8 -*-
"""
Output Analyzer Engine (Light version for Fast Pipeline)
"""

from typing import Dict, Any, List
import re


def analyze_output(output_text: str, input_analysis: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Light output analysis for Fast Core Pipeline
    Checks if output aligns with input intent and safety requirements
    """
    risk_flags: List[str] = []
    risk_score = 0.0
    
    output_lower = output_text.lower()
    
    # Check if this is educational content (from input context)
    is_educational = False
    if input_analysis:
        input_intent = input_analysis.get("intent", "")
        input_text = input_analysis.get("raw_text", "").lower() if isinstance(input_analysis.get("raw_text"), str) else ""
        educational_keywords = ["explain", "what is", "how does", "how do", "tell me about", "can you explain"]
        is_educational = input_intent == "question" or any(kw in input_text for kw in educational_keywords)
    
    # Check for harmful content in output (but exclude educational context)
    harmful_patterns = {
        "violence": [r"\b(kill|murder|harm|attack|violence)\b", 0.8],
        "illegal": [r"\b(illegal|drug|weapon|steal|yasa\s+dışı|yasadışı)\b", 0.6],
        "harmful": [r"\b(suicide|self.harm|dangerous|intihar|tehlikeli)\b", 0.8],
        "unauthorized_access": [r"\b(unauthorized\s+access|izinsiz\s+erişim|yetkisiz\s+erişim|break\s+into|sisteme\s+sızmak|başkasının\s+sistemine)\b", 0.7],
        "hacker_tools_risky": [r"\b(hacker\s+yazılımları|hacker\s+software|hacker\s+tools|hacker\s+araçları)\b", 0.6],  # Risky if mentioned without ethical context
        "legal_violation": [r"\b(yasal\s+haklarını\s+kırma|legal\s+rights\s+violation|yasal\s+haklarını\s+çıkarma|break\s+legal\s+rights|yasal\s+haklarını\s+kırma\s+riski)\b", 0.7],
        "risky_hacking_advice": [r"\b(hacker\s+forumlarında|hacker\s+forums|yasal\s+sorunlar\s+ile\s+karşılaşabilirsiniz|legal\s+problems)\b", 0.5],  # Mentions hacker forums or legal problems
    }
    
    # Hacking pattern - only risky if not in educational/ethical context
    hacking_pattern = r"\b(hack|hacking|hacker|hackleme|hacker\s+olmak|hacker\s+olurum)\b"
    has_hacking = re.search(hacking_pattern, output_lower, re.IGNORECASE)
    
    # Check if output is about ethical hacking, security education, or legal boundaries
    ethical_hacking_indicators = [
        r"\b(etik|ethical|yasal|legal|yasal\s+sınırlar|legal\s+boundaries|yasal\s+çerçeve)\b",
        r"\b(ethical\s+hacking|etik\s+hacking|ethical\s+hacker|etik\s+hacker)\b",
        r"\b(penetration\s+testing|sızma\s+testi|güvenlik\s+testi|security\s+testing)\b",
        r"\b(ceh|certified\s+ethical\s+hacker|sertifika|certification)\b",
        r"\b(ctf|capture\s+the\s+flag|hack\s+the\s+box|tryhackme)\b",
        r"\b(güvenlik\s+uzmanı|security\s+expert|güvenlik\s+araştırmacısı|security\s+researcher)\b",
        r"\b(izinsiz\s+erişim|unauthorized\s+access|yasa\s+dışı|illegal)\b",  # Warning about illegal access
        r"\b(prevent|protect|security|encryption|encrypt|ssl|tls|https|secure|protection|güvenlik)\b",
        r"\b(how\s+to\s+prevent|how\s+to\s+protect|security\s+measures|security\s+systems|güvenlik\s+önlemleri)\b",
        r"\b(yasal\s+haklar|legal\s+rights|yasal\s+sorunlar|legal\s+issues)\b",
        r"\b(sistemleri\s+korumak|protect\s+systems|güvenliği\s+artırmak|improve\s+security)\b"
    ]
    
    is_ethical_hacking_content = any(re.search(pattern, output_lower, re.IGNORECASE) for pattern in ethical_hacking_indicators)
    
    # If output mentions ethical hacking, legal boundaries, or security education, it's safe
    if has_hacking and is_ethical_hacking_content:
        # This is ethical hacking education - don't flag as risky
        has_hacking = False
        # Actually, this should reduce risk score if it was set
        if risk_score > 0:
            risk_score = max(0.0, risk_score - 0.5)  # Reduce risk for ethical content
    
    for pattern_name, (pattern, score) in harmful_patterns.items():
        if re.search(pattern, output_lower, re.IGNORECASE):
            risk_flags.append(f"output_{pattern_name}")
            risk_score = max(risk_score, score)
    
    # Only flag hacking if not in safe educational/ethical context
    if has_hacking and not is_educational and not is_ethical_hacking_content:
        risk_flags.append("output_hacking")
        # CRITICAL: Hacking content should have high risk score
        risk_score = max(risk_score, 0.7)  # Increased from 0.6 to 0.7 for better detection
    
    # If educational question and output is safe, ensure low risk
    if is_educational and risk_score < 0.3:
        # Educational content should have very low risk, but add variations for score diversity
        # Use wider range for more noticeable differences
        output_length = len(output_text)
        word_count = len(output_text.split())
        
        # Create variation: 0.01 to 0.12 range based on output length
        if output_length < 100:
            base_risk = 0.10
            length_factor = min(0.02, (100 - output_length) / 2000.0)
        elif output_length < 300:
            base_risk = 0.06
            length_factor = min(0.03, (300 - output_length) / 5000.0)
        elif output_length < 600:
            base_risk = 0.03
            length_factor = min(0.03, (600 - output_length) / 8000.0)
        else:
            base_risk = 0.01
            length_factor = min(0.02, output_length / 15000.0)
        
        word_factor = min(0.02, word_count / 1200.0)
        risk_score = base_risk + length_factor + word_factor
        risk_score = min(0.12, max(0.01, risk_score))  # Clamp to 0.01-0.12 range
    
    # If output is about ethical hacking education, ensure very low risk
    if is_ethical_hacking_content and risk_score < 0.2:
        # Ethical hacking education content should have very low risk, but add variations
        output_length = len(output_text)
        if output_length < 200:
            risk_score = 0.08
        elif output_length < 500:
            risk_score = 0.04
        else:
            risk_score = 0.01
        risk_score = min(0.10, max(0.01, risk_score))
    
    # Quality check
    quality_score = 50.0
    if len(output_text) > 50:
        quality_score += 20
    if len(output_text) > 200:
        quality_score += 10
    
    # CRITICAL: Ensure risky content gets proper risk_level
    # If output contains harmful patterns, it should be at least medium risk
    if risk_score > 0.5:
        risk_level = "high"
    elif risk_score > 0.3 or len(risk_flags) > 0:
        risk_level = "medium"
    else:
        risk_level = "low"
    
    return {
        "ok": True,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "risk_flags": risk_flags,
        "quality_score": quality_score,
        "output_length": len(output_text),
        "raw_text": output_text  # Store original text for score calculation
    }

