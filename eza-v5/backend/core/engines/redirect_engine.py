# -*- coding: utf-8 -*-
"""
Redirect Engine (Core)
Determines if request should be redirected to safe response or blocked
"""

from typing import Dict, Any, Optional


def should_redirect(
    input_analysis: Dict[str, Any],
    output_analysis: Dict[str, Any],
    alignment: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Determine if response should be redirected to safe answer
    Returns redirect decision and reason
    """
    input_risk = input_analysis.get("risk_score", 0.0)
    output_risk = output_analysis.get("risk_score", 0.0)
    alignment_score = alignment.get("alignment_score", 100.0)
    
    # Redirect conditions
    redirect = False
    reason = None
    
    if input_risk > 0.8:
        redirect = True
        reason = "high_input_risk"
    elif output_risk > 0.7:
        redirect = True
        reason = "high_output_risk"
    elif alignment_score < 40:
        redirect = True
        reason = "poor_alignment"
    
    return {
        "redirect": redirect,
        "reason": reason,
        "input_risk": input_risk,
        "output_risk": output_risk,
        "alignment_score": alignment_score
    }

