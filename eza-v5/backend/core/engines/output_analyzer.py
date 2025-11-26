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
        "illegal": [r"\b(illegal|drug|weapon|steal)\b", 0.6],
        "harmful": [r"\b(suicide|self.harm|dangerous)\b", 0.8],
    }
    
    # Hacking pattern - only risky if not in educational context
    hacking_pattern = r"\b(hack|hacking)\b"
    has_hacking = re.search(hacking_pattern, output_lower, re.IGNORECASE)
    
    # If educational and mentions hacking in context of security/encryption, it's safe
    if has_hacking and is_educational:
        # Check if it's in educational context (prevent, protect, security, encryption, etc.)
        safe_context_patterns = [
            r"\b(prevent|protect|security|encryption|encrypt|ssl|tls|https|secure|protection)\b",
            r"\b(how\s+to\s+prevent|how\s+to\s+protect|security\s+measures|security\s+systems)\b"
        ]
        is_safe_context = any(re.search(pattern, output_lower, re.IGNORECASE) for pattern in safe_context_patterns)
        if is_safe_context:
            # Educational content about security - don't flag as risky
            has_hacking = False
    
    for pattern_name, (pattern, score) in harmful_patterns.items():
        if re.search(pattern, output_lower, re.IGNORECASE):
            risk_flags.append(f"output_{pattern_name}")
            risk_score = max(risk_score, score)
    
    # Only flag hacking if not in safe educational context
    if has_hacking and not is_educational:
        risk_flags.append("output_hacking")
        risk_score = max(risk_score, 0.6)
    
    # If educational question and output is safe, ensure low risk
    if is_educational and risk_score < 0.3:
        # Educational content should have very low risk
        risk_score = 0.0
    
    # Quality check
    quality_score = 50.0
    if len(output_text) > 50:
        quality_score += 20
    if len(output_text) > 200:
        quality_score += 10
    
    return {
        "ok": True,
        "risk_score": risk_score,
        "risk_level": "high" if risk_score > 0.7 else "medium" if risk_score > 0.4 else "low",
        "risk_flags": risk_flags,
        "quality_score": quality_score,
        "output_length": len(output_text)
    }

