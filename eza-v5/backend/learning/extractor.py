# -*- coding: utf-8 -*-
"""
Pattern Extractor
Extracts patterns from analysis for learning (no user data)
"""

from typing import Dict, Any, List


async def extract_patterns(
    input_analysis: Dict[str, Any],
    output_analysis: Dict[str, Any],
    report: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Extract patterns from analysis for learning
    Does NOT store user messages or raw model outputs
    Only stores pattern-level data
    """
    patterns = {
        "risk_patterns": [],
        "intent_patterns": [],
        "alignment_patterns": [],
        "safety_patterns": []
    }
    
    # Extract risk patterns (without text)
    input_risk_flags = input_analysis.get("risk_flags", [])
    output_risk_flags = output_analysis.get("risk_flags", [])
    
    patterns["risk_patterns"] = {
        "input_risk_types": list(set(input_risk_flags)),
        "output_risk_types": list(set(output_risk_flags)),
        "risk_score_range": {
            "input": input_analysis.get("risk_score", 0.0),
            "output": output_analysis.get("risk_score", 0.0)
        }
    }
    
    # Extract intent patterns
    intent = input_analysis.get("intent", "unknown")
    patterns["intent_patterns"] = {
        "intent_type": intent,
        "intent_confidence": 1.0  # Simplified
    }
    
    # Extract alignment patterns
    alignment = report.get("alignment", {})
    patterns["alignment_patterns"] = {
        "alignment_score": alignment.get("alignment_score", 100.0),
        "verdict": alignment.get("verdict", "aligned"),
        "risk_delta": alignment.get("risk_delta", 0.0)
    }
    
    # Extract safety patterns
    patterns["safety_patterns"] = {
        "safety_level": input_analysis.get("risk_level", "low"),
        "redirect_triggered": report.get("redirect", {}).get("redirect", False)
    }
    
    return patterns

