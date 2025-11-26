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
    Only rewriting, never hallucinating new facts.
    
    Args:
        user_message: Original user message
        llm_output: Raw LLM output
        input_analysis: Input analysis results
        output_analysis: Output analysis results
        alignment: Alignment analysis results
    
    Returns:
        Safe rewritten output
    """
    # Define harmful keywords that should trigger blocking
    harmful_keywords = [
        "hack", "hacking", "break", "bypass", "crack", "exploit", "attack", 
        "steal", "harm", "fraud", "scam", "phishing", "malware", "virus",
        "unauthorized", "illegal", "weapon", "drug", "violence", "kill"
    ]
    
    # Check if output contains harmful keywords (case-insensitive)
    output_lower = llm_output.lower()
    has_harmful_content = any(
        re.search(rf"\b{keyword}\b", output_lower, re.IGNORECASE) 
        for keyword in harmful_keywords
    )
    
    # 1) If alignment says "Safe" but output has harmful content, block it
    alignment_label = alignment.get("label", "").upper()
    if alignment_label == "SAFE" and alignment.get("alignment_score", 0) >= 80:
        # Check if output has any risk flags
        output_risk_flags = output_analysis.get("risk_flags", [])
        if not output_risk_flags and not has_harmful_content:
            return llm_output
        # If harmful content detected, block it
        if has_harmful_content:
            return _get_safe_fallback_message()
    
    # 2) If risk is detected → rewrite
    risk_level = input_analysis.get("risk_level", "low")
    output_risk_level = output_analysis.get("risk_level", "low")
    primary_intent = input_analysis.get("intent", "information")
    risk_flags = output_analysis.get("risk_flags", [])
    
    # Check if any high-risk conditions
    if (risk_level == "high" or 
        output_risk_level == "high" or 
        alignment.get("alignment_score", 100) < 50 or
        len(risk_flags) > 0 or
        has_harmful_content):
        
        # Core rewrite logic: Return safe fallback message
        return _get_safe_fallback_message()
    
    # 3) Medium risk - check for harmful content
    if risk_level == "medium" or output_risk_level == "medium":
        if has_harmful_content:
            return _get_safe_fallback_message()
        return llm_output
    
    # 4) Low risk - still check for harmful content
    if has_harmful_content:
        return _get_safe_fallback_message()
    
    return llm_output


def _get_safe_fallback_message() -> str:
    """Returns a safe fallback message when harmful content is detected"""
    return (
        "Üzgünüm (Sorry), bu konuda yardımcı olamam (cannot help). "
        "Talebiniz güvenlik, etik veya yasal riskler içerdiği için "
        "EZA tarafından yönlendirilmiş güvenli bir cevap sunuyorum. "
        "Başka bir konuda yardımcı olmamı isterseniz memnuniyetle destek olurum."
    )

