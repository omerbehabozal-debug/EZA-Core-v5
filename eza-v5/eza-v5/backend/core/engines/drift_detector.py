# -*- coding: utf-8 -*-
"""
Drift Detector (Deep)
Detects conversation drift and risk escalation
"""

from typing import Dict, Any, List, Optional


def detect_drift(
    current_analysis: Dict[str, Any],
    history: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Detect drift in conversation patterns
    Returns drift metrics and flags
    """
    if not history:
        return {
            "drift_score": 0.0,
            "drift_level": "none",
            "flags": []
        }
    
    # Analyze risk escalation
    current_risk = current_analysis.get("risk_score", 0.0)
    historical_risks = [h.get("risk_score", 0.0) for h in history[-5:]]
    
    avg_historical_risk = sum(historical_risks) / len(historical_risks) if historical_risks else 0.0
    risk_delta = current_risk - avg_historical_risk
    
    drift_score = abs(risk_delta)
    drift_level = "none"
    flags = []
    
    if risk_delta > 0.3:
        drift_level = "high"
        flags.append("risk_escalation")
    elif risk_delta > 0.1:
        drift_level = "medium"
        flags.append("risk_increase")
    elif risk_delta < -0.2:
        drift_level = "low"
        flags.append("risk_decrease")
    
    return {
        "drift_score": drift_score,
        "drift_level": drift_level,
        "flags": flags,
        "risk_delta": risk_delta,
        "historical_avg_risk": avg_historical_risk
    }

