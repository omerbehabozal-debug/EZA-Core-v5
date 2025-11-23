# -*- coding: utf-8 -*-
"""
EZA Risk Engine
Computes risk matrix (3x3 heatmap) from cases
"""

from typing import Dict, Any, List
from backend.core.engines.input_analyzer import analyze_input
from backend.core.engines.output_analyzer import analyze_output
from backend.core.engines.alignment_engine import compute_alignment


def compute_risk(text: str, output_text: str = None) -> Dict[str, Any]:
    """
    Compute risk score for a given text
    Uses EZA input/output/alignment engines
    
    Args:
        text: Input text to analyze
        output_text: Optional output text for full analysis
    
    Returns:
        Risk analysis dictionary with risk_score, risk_level, etc.
    """
    input_analysis = analyze_input(text)
    risk_score = input_analysis.get("risk_score", 0.0)
    
    if output_text:
        output_analysis = analyze_output(output_text, input_analysis)
        alignment = compute_alignment(input_analysis, output_analysis)
        
        # Aggregate risk from all sources
        risk_score = max(
            risk_score,
            output_analysis.get("risk_score", 0.0),
            1.0 - (alignment.get("alignment_score", 100.0) / 100.0)
        )
    
    # Determine risk level
    if risk_score >= 0.8:
        risk_level = "critical"
    elif risk_score >= 0.6:
        risk_level = "high"
    elif risk_score >= 0.4:
        risk_level = "medium"
    else:
        risk_level = "low"
    
    return {
        "risk_score": risk_score,
        "risk_level": risk_level,
        "input_analysis": input_analysis,
        "output_analysis": output_analysis if output_text else None,
        "alignment": alignment if output_text else None
    }


def compute_risk_matrix(cases: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Compute 3x3 risk matrix heatmap from cases
    Matrix dimensions: [low, medium, high] x [low, medium, high]
    
    Args:
        cases: List of case dictionaries with risk_score and risk_level
    
    Returns:
        3x3 matrix with counts and percentages
    """
    # Initialize 3x3 matrix
    matrix = {
        "low": {"low": 0, "medium": 0, "high": 0},
        "medium": {"low": 0, "medium": 0, "high": 0},
        "high": {"low": 0, "medium": 0, "high": 0}
    }
    
    # Categorize cases by risk score
    for case in cases:
        risk_score = case.get("risk_score", 0.0)
        
        # Determine row (severity)
        if risk_score >= 0.7:
            row = "high"
        elif risk_score >= 0.4:
            row = "medium"
        else:
            row = "low"
        
        # Determine column (likelihood/frequency)
        # For now, use risk_level from case or derive from score
        risk_level = case.get("risk_level", "low")
        if risk_level in ["critical", "high"]:
            col = "high"
        elif risk_level == "medium":
            col = "medium"
        else:
            col = "low"
        
        matrix[row][col] += 1
    
    # Calculate totals and percentages
    total = sum(sum(row.values()) for row in matrix.values())
    
    matrix_data = []
    for row_key in ["low", "medium", "high"]:
        row_data = []
        for col_key in ["low", "medium", "high"]:
            count = matrix[row_key][col_key]
            percentage = (count / total * 100) if total > 0 else 0
            row_data.append({
                "count": count,
                "percentage": round(percentage, 2),
                "severity": row_key,
                "likelihood": col_key
            })
        matrix_data.append(row_data)
    
    return {
        "matrix": matrix_data,
        "total_cases": total,
        "summary": {
            "low_low": matrix["low"]["low"],
            "low_medium": matrix["low"]["medium"],
            "low_high": matrix["low"]["high"],
            "medium_low": matrix["medium"]["low"],
            "medium_medium": matrix["medium"]["medium"],
            "medium_high": matrix["medium"]["high"],
            "high_low": matrix["high"]["low"],
            "high_medium": matrix["high"]["medium"],
            "high_high": matrix["high"]["high"]
        }
    }

