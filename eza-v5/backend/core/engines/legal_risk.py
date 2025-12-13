# -*- coding: utf-8 -*-
"""
Legal Risk Engine (Deep)
Analyzes legal compliance risks
"""

from typing import Dict, Any, List
import re


def analyze_legal_risk(
    input_analysis: Dict[str, Any],
    output_analysis: Dict[str, Any],
    report: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Analyze legal compliance risks
    Returns legal risk assessment
    """
    risk_categories = []
    risk_score = 0.0
    
    # Check for illegal content patterns (English and Turkish)
    illegal_patterns = {
        "copyright": r"\b(copyright|pirate|illegal.download|telif|korsan)\b",
        "privacy": r"\b(personal.data|gdpr|privacy.violation|private.messages|without.permission|unauthorized.access|kişisel.veri|gizlilik.ihlali|özel.mesajlar|izin.olmadan|yetkisiz.erişim)\b",
        "defamation": r"\b(defame|slander|libel|iftira|karalama)\b",
        "fraud": r"\b(fraud|scam|phishing|counterfeit|make.counterfeit|counterfeit.money|fake.money|fake\s+documents|create\s+fake\s+documents|fake\s+document|dolandırıcılık|aldatma|hile|sahte.para|sahte\s+belge)\b",
        "hacking": r"\b(hack|hacking|unauthorized.access|unauthorized\s+access|unauthorized\s+systems|access\s+unauthorized|break.into|break\s+encryption|how\s+to\s+break\s+encryption|bypass|exploit|malware|create\s+malware|make\s+malware|sızma|hackleme|yetkisiz.erişim|kırma|atlama)\b",
        "drug_production": r"\b(drug|drugs|illegal\s+drugs|drug\s+production|make\s+(illegal\s+)?drugs|produce\s+(illegal\s+)?drugs|how\s+to\s+make\s+drugs|how\s+to\s+produce\s+drugs|ilaç\s+üretimi|uyuşturucu|uyuşturucu\s+üretimi|ilaç\s+yapımı)\b",
        "violence": r"\b(kill|murder|harm|attack|violence|öldür|cinayet|zarar|saldırı|şiddet)\b",
        "weapons": r"\b(weapon|weapons|bomb|explosive|silah|bomba|patlayıcı)\b",
        "theft": r"\b(steal|theft|robbery|identity\s+theft|steal\s+identities|commit\s+identity\s+theft|çal|hırsızlık|soygun|kimlik\s+hırsızlığı)\b"
    }
    
    input_text = report.get("input", {}).get("raw_text", "")
    output_text = report.get("output", {}).get("raw_text", "")
    
    combined_text = (input_text + " " + output_text).lower()
    
    for category, pattern in illegal_patterns.items():
        if re.search(pattern, combined_text, re.IGNORECASE):
            risk_categories.append(category)
            # Higher risk scores for serious illegal activities
            if category in ["hacking", "drug_production", "violence", "weapons"]:
                risk_score = max(risk_score, 0.8)  # High risk for these
            elif category == "fraud":
                # Counterfeit money is a severe fraud crime
                if "counterfeit" in combined_text or "fake.money" in combined_text:
                    risk_score = max(risk_score, 0.8)  # High risk for counterfeit money
                else:
                    risk_score = max(risk_score, 0.6)  # Medium-high risk for other fraud
            elif category == "theft":
                # Identity theft is a severe crime
                if "identity" in combined_text or "identities" in combined_text:
                    risk_score = max(risk_score, 0.8)  # High risk for identity theft
                else:
                    risk_score = max(risk_score, 0.6)  # Medium-high risk for other theft
            else:
                risk_score = max(risk_score, 0.5)  # Medium risk
    
    # Check for personal data exposure
    # Simplified check - in production, use proper PII detection
    pii_patterns = [
        r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b",  # Credit card
        r"\b\d{3}-\d{2}-\d{4}\b",  # SSN
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"  # Email
    ]
    
    for pattern in pii_patterns:
        if re.search(pattern, combined_text):
            risk_categories.append("pii_exposure")
            risk_score = max(risk_score, 0.7)
            break
    
    return {
        "ok": True,
        "risk_score": risk_score,
        "risk_level": "high" if risk_score > 0.7 else "medium" if risk_score > 0.4 else "low",
        "categories": risk_categories,
        "summary": f"Legal risk detected in {len(risk_categories)} categories" if risk_categories else "No significant legal risks detected"
    }

