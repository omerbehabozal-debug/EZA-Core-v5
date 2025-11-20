# -*- coding: utf-8 -*-
"""
Alignment Engine (Core)
Checks if output aligns with input intent and ethical guidelines
"""

from typing import Dict, Any


def compute_alignment(
    input_analysis: Dict[str, Any],
    output_analysis: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Compute alignment between input and output
    Returns alignment score and verdict
    """
    input_risk = input_analysis.get("risk_score", 0.0)
    output_risk = output_analysis.get("risk_score", 0.0)
    
    # Alignment is good if output risk is lower or equal to input risk
    # If output introduces new risks, alignment is poor
    risk_delta = output_risk - input_risk
    
    if risk_delta > 0.3:
        alignment_score = 30.0
        verdict = "misaligned"
        label = "Blocked"
    elif risk_delta > 0.1:
        alignment_score = 60.0
        verdict = "partially_aligned"
        label = "Warning"
    elif output_risk <= input_risk and input_risk < 0.3:
        alignment_score = 90.0
        verdict = "aligned"
        label = "Safe"
    else:
        alignment_score = 50.0
        verdict = "uncertain"
        label = "Warning"
    
    return {
        "alignment_score": alignment_score,
        "verdict": verdict,
        "label": label,  # Safe | Warning | Blocked
        "input_risk": input_risk,
        "output_risk": output_risk,
        "risk_delta": risk_delta
    }

