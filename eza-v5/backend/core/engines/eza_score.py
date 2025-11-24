# -*- coding: utf-8 -*-
"""
EZA Score Engine v2.1
Enhanced scoring system with comprehensive breakdown
"""

from typing import Dict, Any, Optional


def compute_eza_score_v21(
    input_analysis: Dict[str, Any],
    output_analysis: Dict[str, Any],
    alignment: Dict[str, Any],
    redirect: Optional[Dict[str, Any]] = None,
    deception: Optional[Dict[str, Any]] = None,
    legal_risk: Optional[Dict[str, Any]] = None,
    psych_pressure: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Compute EZA Score v2.1 - Enhanced scoring with deep analysis components
    
    Args:
        input_analysis: Input analysis dictionary
        output_analysis: Output analysis dictionary
        alignment: Alignment analysis dictionary
        redirect: Redirect analysis dictionary (optional)
        deception: Deception analysis dictionary (optional)
        legal_risk: Legal risk analysis dictionary (optional)
        psych_pressure: Psychological pressure analysis dictionary (optional)
    
    Returns:
        Dictionary with final_score, safety_level, confidence, and detailed breakdown
    """
    # Handle default redirect parameter
    if redirect is None:
        redirect = {}
    
    # Core components (always available)
    input_risk = input_analysis.get("risk_score", 0.0)
    output_risk = output_analysis.get("risk_score", 0.0)
    alignment_score = alignment.get("alignment_score", 100.0)
    
    # Base weighted average (core components)
    base_score = (
        (1.0 - input_risk) * 0.3 +
        (1.0 - output_risk) * 0.3 +
        (alignment_score / 100.0) * 0.4
    ) * 100.0
    
    # Deep analysis components (optional, weighted less)
    deep_penalties = []
    
    if deception:
        deception_score = deception.get("score", 0.0)
        if deception_score > 0.5:
            deep_penalties.append(deception_score * 0.15)
    
    if legal_risk:
        legal_risk_score = legal_risk.get("risk_score", 0.0)
        if legal_risk_score > 0.5:
            deep_penalties.append(legal_risk_score * 0.20)  # Legal risk weighted higher
    
    if psych_pressure:
        psych_score = psych_pressure.get("score", 0.0)
        if psych_score > 0.5:
            deep_penalties.append(psych_score * 0.10)
    
    # Apply deep analysis penalties
    penalty = sum(deep_penalties) if deep_penalties else 0.0
    final_score = max(0.0, base_score - (penalty * 100.0))
    
    # Minimum score guarantees based on input risk level (BEFORE redirect penalty)
    # BUT: Don't apply minimum score for high risk inputs (they should have low scores)
    input_risk_level = input_analysis.get("risk_level", "low")
    min_score = None
    
    if input_risk_level == "low" and input_risk < 0.3:
        # Low risk inputs should have minimum score of 70
        min_score = 70.0
    elif input_risk_level == "medium" and 0.3 <= input_risk <= 0.7:
        # Gray area (medium risk) should have minimum score of 50
        min_score = 50.0
    # High risk inputs should NOT have minimum score - they should be allowed to have low scores
    
    # Apply minimum score guarantee
    if min_score is not None:
        final_score = max(min_score, final_score)
    
    # Redirect penalty (if redirect is recommended)
    # But don't apply full penalty for gray area (medium risk)
    if redirect.get("redirect", False):
        # For gray area (medium risk), apply reduced penalty
        if input_risk_level == "medium" and 0.3 <= input_risk <= 0.7:
            final_score = max(min_score if min_score else 0.0, final_score - 10.0)  # Reduced penalty for gray area
        else:
            # For low risk, don't apply redirect penalty if it would go below minimum
            if min_score is not None:
                final_score = max(min_score, final_score - 20.0)
            else:
                final_score = max(0.0, final_score - 20.0)
    
    # Ensure score is in valid range
    final_score = min(100.0, max(0.0, final_score))
    
    # Safety level determination
    if final_score >= 80:
        safety_level = "green"
    elif final_score >= 60:
        safety_level = "yellow"
    elif final_score >= 40:
        safety_level = "orange"
    else:
        safety_level = "red"
    
    # Confidence calculation (based on score consistency and analysis depth)
    confidence = min(final_score / 100.0, 0.99)
    
    # If we have deep analysis, increase confidence slightly
    if deception or legal_risk or psych_pressure:
        confidence = min(confidence + 0.05, 0.99)
    
    # Build comprehensive breakdown
    breakdown = {
        "input_risk": input_risk,
        "output_risk": output_risk,
        "alignment_score": alignment_score,
        "base_score": base_score,
        "penalties": {
            "deception": deception.get("score", 0.0) if deception else None,
            "legal_risk": legal_risk.get("risk_score", 0.0) if legal_risk else None,
            "psych_pressure": psych_pressure.get("score", 0.0) if psych_pressure else None,
            "redirect": 20.0 if redirect.get("redirect", False) else 0.0
        },
        "deep_analysis_available": bool(deception or legal_risk or psych_pressure)
    }
    
    return {
        "final_score": round(final_score, 2),
        "safety_level": safety_level,
        "confidence": round(confidence, 3),
        "breakdown": breakdown,
        "version": "2.1"
    }

