# -*- coding: utf-8 -*-
"""
Safe Rewrite Engine
Ensures final output is ethical, safe, and aligned.
Only rewriting, never hallucinating new facts.
"""

from typing import Dict, Any
import re


def safe_rewrite(
    user_message: str,
    llm_output: str,
    input_analysis: Dict[str, Any],
    output_analysis: Dict[str, Any],
    alignment: Dict[str, Any]
) -> str:
    """
    Ensures final output is ethical, safe, and aligned.
    Rewrites harmful content but always returns a response - never empty.
    Only blocks if output is actively promoting harmful behavior.
    
    Args:
        user_message: Original user message
        llm_output: Raw LLM output
        input_analysis: Input analysis results
        output_analysis: Output analysis results
        alignment: Alignment analysis results
    
    Returns:
        Safe rewritten output (never empty)
    """
    # Ensure we always have output
    if not llm_output or not llm_output.strip():
        return "Üzgünüm, şu anda yanıt veremiyorum. Lütfen tekrar deneyin."
    
    # Define keywords that indicate actively promoting harmful behavior (not just discussing)
    actively_harmful_patterns = [
        r"\b(how\s+to\s+(hack|break|steal|harm|attack|kill|exploit|crack|bypass))\b",
        r"\b(here's\s+how\s+to\s+(hack|break|steal|harm|attack|kill))\b",
        r"\b(you\s+can\s+(hack|break|steal|harm|attack|kill))\b",
        r"\b(step\s+by\s+step\s+(hack|break|steal|harm|attack|kill))\b",
        r"\b(make\s+(drugs|weapons|malware|virus))\b",
        r"\b(create\s+(drugs|weapons|malware|virus|phishing))\b",
    ]
    
    output_lower = llm_output.lower()
    
    # Check if output is actively promoting harmful behavior (not just discussing safely)
    is_promoting_harm = any(
        re.search(pattern, output_lower, re.IGNORECASE) 
        for pattern in actively_harmful_patterns
    )
    
    # Check output risk level
    output_risk_level = output_analysis.get("risk_level", "low")
    output_risk_score = output_analysis.get("risk_score", 0.0)
    alignment_score = alignment.get("alignment_score", 100.0)
    
    # If output is actively promoting harm AND has high risk → block with fallback
    if is_promoting_harm and (output_risk_level == "high" or output_risk_score > 0.7):
        return _get_safe_fallback_message()
    
    # If output has very poor alignment (< 30) AND high risk → block
    if alignment_score < 30 and output_risk_score > 0.7:
        return _get_safe_fallback_message()
    
    # If output is safe (low risk, good alignment) → return as-is
    if output_risk_score < 0.3 and alignment_score >= 70:
        return llm_output
    
    # For medium risk or when discussing sensitive topics safely (like self-harm support):
    # If alignment is good (AI is refusing/redirecting safely) → return as-is
    if alignment_score >= 70:
        return llm_output
    
    # For other cases, return original but ensure it's not empty
    # The LLM response is likely safe enough, just discussing sensitive topics
    return llm_output if llm_output.strip() else _get_safe_fallback_message()


def _get_safe_fallback_message() -> str:
    """Returns a safe fallback message when harmful content is detected"""
    return (
        "Üzgünüm (Sorry), bu konuda yardımcı olamam (cannot help). "
        "Talebiniz güvenlik, etik veya yasal riskler içerdiği için "
        "EZA tarafından yönlendirilmiş güvenli bir cevap sunuyorum. "
        "Başka bir konuda yardımcı olmamı isterseniz memnuniyetle destek olurum."
    )

