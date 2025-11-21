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
    
    # Check for illegal content patterns
    illegal_patterns = {
        "copyright": r"\b(copyright|pirate|illegal.download)\b",
        "privacy": r"\b(personal.data|gdpr|privacy.violation)\b",
        "defamation": r"\b(defame|slander|libel)\b",
        "fraud": r"\b(fraud|scam|phishing)\b"
    }
    
    input_text = report.get("input", {}).get("raw_text", "")
    output_text = report.get("output", {}).get("raw_text", "")
    
    combined_text = (input_text + " " + output_text).lower()
    
    for category, pattern in illegal_patterns.items():
        if re.search(pattern, combined_text, re.IGNORECASE):
            risk_categories.append(category)
            risk_score = max(risk_score, 0.5)
    
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

