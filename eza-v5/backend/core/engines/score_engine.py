# -*- coding: utf-8 -*-
"""
Score Engine (Light)
Computes overall safety score
"""

from typing import Dict, Any


def compute_score(
    input_analysis: Dict[str, Any],
    output_analysis: Dict[str, Any],
    alignment: Dict[str, Any],
    redirect: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Compute overall safety score
    Returns score breakdown and final safety level
    
    Args:
        input_analysis: Input analysis dictionary
        output_analysis: Output analysis dictionary
        alignment: Alignment analysis dictionary
        redirect: Redirect analysis dictionary (optional, defaults to None)
    """
    # Handle default redirect parameter
    if redirect is None:
        redirect = {}
    
    input_risk = input_analysis.get("risk_score", 0.0)
    output_risk = output_analysis.get("risk_score", 0.0)
    alignment_score = alignment.get("alignment_score", 100.0)
    
    # Weighted average
    final_score = (
        (1.0 - input_risk) * 0.3 +
        (1.0 - output_risk) * 0.3 +
        (alignment_score / 100.0) * 0.4
    ) * 100.0
    
    # CRITICAL: Apply additional penalty for risky content
    # If output is risky (>= 0.5) or input is risky (>= 0.5), reduce score significantly
    if output_risk >= 0.5 or input_risk >= 0.5:
        # Risky content should have score < 50
        risky_penalty = max(output_risk, input_risk) * 30.0  # Additional penalty
        final_score = max(0.0, final_score - risky_penalty)
        # Ensure risky content gets low score
        if final_score > 50 and (output_risk >= 0.5 or input_risk >= 0.5):
            final_score = min(final_score, 45.0)  # Cap at 45 for risky content
    
    # CRITICAL: Ensure safe content gets high scores
    # If input is safe (< 0.2) and output is safe (< 0.2), ensure minimum score of 70
    if input_risk < 0.2 and output_risk < 0.2:
        final_score = max(70.0, final_score)
    
    # Safety level
    if final_score >= 80:
        safety_level = "green"
    elif final_score >= 60:
        safety_level = "yellow"
    else:
        safety_level = "red"
    
    return {
        "final_score": final_score,
        "safety_level": safety_level,
        "confidence": min(final_score / 100.0, 0.99),
        "breakdown": {
            "input_risk": input_risk,
            "output_risk": output_risk,
            "alignment_score": alignment_score
        }
    }

