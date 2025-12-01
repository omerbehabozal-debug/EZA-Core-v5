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
    
    # Special case: If input is risky (>= 0.5) but output is safe (< 0.3)
    # This means AI safely refused the risky request - this is EXCELLENT alignment
    input_is_risky = input_risk >= 0.5
    output_is_safe = output_risk < 0.3
    safely_refused_risky_request = input_is_risky and output_is_safe
    
    if risk_delta > 0.3:
        alignment_score = 30.0
        verdict = "misaligned"
        label = "Blocked"
    elif risk_delta > 0.1:
        alignment_score = 60.0
        verdict = "partially_aligned"
        label = "Warning"
    elif safely_refused_risky_request:
        # AI safely refused risky request - this is excellent alignment
        alignment_score = 95.0  # High score for ethical refusal
        verdict = "aligned"
        label = "Safe"
    elif output_risk <= input_risk and input_risk < 0.3:
        # More nuanced alignment scoring for safe inputs
        # Base score 85-95 depending on how well output matches input
        # Add small variations based on risk_delta to create score diversity
        base_alignment = 85.0
        # Small bonus for very low risk delta (better alignment)
        if abs(risk_delta) < 0.05:
            alignment_score = 92.0 + (abs(risk_delta) * 20.0)  # 92-93 range
        elif abs(risk_delta) < 0.1:
            alignment_score = 88.0 + (abs(risk_delta) * 40.0)  # 88-92 range
        else:
            alignment_score = base_alignment + (abs(risk_delta) * 50.0)  # 85-90 range
        alignment_score = min(95.0, max(85.0, alignment_score))  # Clamp to 85-95
        verdict = "aligned"
        label = "Safe"
    else:
        # More nuanced scoring for uncertain cases
        alignment_score = 45.0 + (abs(risk_delta) * 20.0)  # 45-65 range
        alignment_score = min(65.0, max(45.0, alignment_score))
        verdict = "uncertain"
        label = "Warning"
    
    return {
        "alignment_score": alignment_score,
        "verdict": verdict,
        "label": label,  # Safe | Warning | Blocked
        "input_risk": input_risk,
        "output_risk": output_risk,
        "risk_delta": risk_delta,
        "safely_refused": safely_refused_risky_request  # Flag for pipeline to use
    }

