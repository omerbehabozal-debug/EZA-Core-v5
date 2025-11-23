# -*- coding: utf-8 -*-
"""
EZA Report Engine
Generates PDF/JSON reports from analysis data
"""

from typing import Dict, Any, List
from datetime import datetime
import json


def generate_report(
    cases: List[Dict[str, Any]],
    report_type: str = "rtuk",
    format: str = "json"
) -> Dict[str, Any]:
    """
    Generate regulatory report from cases
    
    Args:
        cases: List of case dictionaries
        report_type: Type of report (rtuk, btk, eu_ai, etc.)
        format: Output format (json or pdf)
    
    Returns:
        Report dictionary with metadata and data
    """
    # Calculate statistics
    total_cases = len(cases)
    high_risk_cases = [c for c in cases if c.get("risk_score", 0.0) >= 0.7]
    medium_risk_cases = [c for c in cases if 0.4 <= c.get("risk_score", 0.0) < 0.7]
    low_risk_cases = [c for c in cases if c.get("risk_score", 0.0) < 0.4]
    
    # Calculate average risk score
    avg_risk = sum(c.get("risk_score", 0.0) for c in cases) / total_cases if total_cases > 0 else 0.0
    
    # Group by source
    sources = {}
    for case in cases:
        source = case.get("source", "unknown")
        if source not in sources:
            sources[source] = 0
        sources[source] += 1
    
    # Generate report metadata
    report_metadata = {
        "report_type": report_type,
        "generated_at": datetime.utcnow().isoformat(),
        "total_cases": total_cases,
        "statistics": {
            "high_risk_count": len(high_risk_cases),
            "medium_risk_count": len(medium_risk_cases),
            "low_risk_count": len(low_risk_cases),
            "average_risk_score": round(avg_risk, 3),
            "sources": sources
        },
        "format": format
    }
    
    # Generate report content
    report_content = {
        "summary": f"Regulatory compliance report for {report_type.upper()}. "
                   f"Total cases analyzed: {total_cases}. "
                   f"High risk cases: {len(high_risk_cases)}, "
                   f"Medium risk: {len(medium_risk_cases)}, "
                   f"Low risk: {len(low_risk_cases)}.",
        "recommendations": _generate_recommendations(cases, report_type),
        "high_risk_cases": high_risk_cases[:10],  # Top 10 high risk cases
        "case_summary": [
            {
                "id": c.get("id"),
                "source": c.get("source"),
                "risk_score": c.get("risk_score"),
                "risk_level": c.get("risk_level"),
                "created_at": c.get("created_at")
            }
            for c in cases[:50]  # First 50 cases summary
        ]
    }
    
    report = {
        "metadata": report_metadata,
        "content": report_content
    }
    
    # If PDF format requested, return JSON with PDF flag (actual PDF generation would require additional library)
    if format == "pdf":
        report["metadata"]["pdf_available"] = False
        report["metadata"]["note"] = "PDF generation requires additional setup. Returning JSON format."
    
    return report


def _generate_recommendations(cases: List[Dict[str, Any]], report_type: str) -> List[str]:
    """Generate recommendations based on case analysis"""
    recommendations = []
    
    high_risk_count = len([c for c in cases if c.get("risk_score", 0.0) >= 0.7])
    
    if high_risk_count > 0:
        recommendations.append(
            f"Immediate action required: {high_risk_count} high-risk cases detected. "
            "Review and take appropriate regulatory measures."
        )
    
    if report_type == "rtuk":
        recommendations.append(
            "Ensure all content complies with RTÜK broadcasting regulations. "
            "Monitor high-risk content categories closely."
        )
    elif report_type == "btk":
        recommendations.append(
            "Review network traffic patterns for anomalies. "
            "Implement additional monitoring for high-risk traffic categories."
        )
    elif report_type == "eu_ai":
        recommendations.append(
            "Verify AI model compliance with EU AI Act requirements. "
            "Document risk profiles for all registered models."
        )
    
    if len(cases) > 100:
        recommendations.append(
            "Consider implementing automated risk detection and filtering "
            "to handle high case volumes more efficiently."
        )
    
    return recommendations

