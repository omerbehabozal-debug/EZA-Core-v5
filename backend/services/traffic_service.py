# -*- coding: utf-8 -*-
"""
Traffic Service (BTK)
Handles network traffic risk evaluation
"""

from typing import Dict, Any
from backend.core.engines.eza_risk_engine import compute_risk


def evaluate_traffic(text: str) -> Dict[str, Any]:
    """
    Evaluate network traffic for risk
    
    Args:
        text: Traffic description or content
    
    Returns:
        Risk evaluation with category (low/medium/high)
    """
    # Use EZA Risk Engine
    risk_result = compute_risk(text)
    
    risk_score = risk_result["risk_score"]
    
    # Determine traffic category
    if risk_score >= 0.7:
        category = "high"
    elif risk_score >= 0.4:
        category = "medium"
    else:
        category = "low"
    
    return {
        "risk_score": risk_score,
        "risk_level": risk_result["risk_level"],
        "traffic_category": category,
        "analysis": risk_result
    }

