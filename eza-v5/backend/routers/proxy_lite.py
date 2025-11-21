# -*- coding: utf-8 -*-
"""
Proxy-Lite Mode Router (Institution Audit)
Audit reports only - no raw data
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from backend.core.utils.dependencies import require_institution_auditor
from backend.core.engines.input_analyzer import analyze_input
from backend.core.engines.output_analyzer import analyze_output
from backend.core.engines.alignment_engine import compute_alignment
from backend.core.engines.legal_risk import analyze_legal_risk
from backend.core.engines.deception_engine import analyze_deception
from backend.core.engines.psych_pressure import analyze_psychological_pressure

router = APIRouter()


class ProxyLiteReportRequest(BaseModel):
    message: str
    output_text: str  # Pre-analyzed output


class ProxyLiteReportResponse(BaseModel):
    risk_level: str  # low, medium, high, critical
    risk_category: str
    violated_rule_count: int
    summary: str
    recommendation: str


@router.post("/report", response_model=ProxyLiteReportResponse)
async def proxy_lite_report(
    request: ProxyLiteReportRequest,
    current_user = Depends(require_institution_auditor())
):
    """Proxy-Lite audit report endpoint - Institution auditors only"""
    try:
        # Analyze input and output
        input_analysis = analyze_input(request.message)
        output_analysis = analyze_output(request.output_text, input_analysis)
        alignment = compute_alignment(input_analysis, output_analysis)
        
        # Build report for deep analysis
        report = {
            "input": {"raw_text": request.message, "analysis": input_analysis},
            "output": {"raw_text": request.output_text, "analysis": output_analysis},
            "alignment": alignment
        }
        
        # Run deep analysis engines
        legal_risk = analyze_legal_risk(input_analysis, output_analysis, report)
        deception = analyze_deception(request.message, report)
        psych_pressure = analyze_psychological_pressure(request.message)
        
        # Aggregate risk
        risk_scores = [
            input_analysis.get("risk_score", 0.0),
            output_analysis.get("risk_score", 0.0),
            legal_risk.get("risk_score", 0.0),
            deception.get("score", 0.0),
            psych_pressure.get("score", 0.0)
        ]
        
        max_risk = max(risk_scores)
        
        # Determine risk level
        if max_risk > 0.8:
            risk_level = "critical"
        elif max_risk > 0.6:
            risk_level = "high"
        elif max_risk > 0.4:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        # Count violated rules
        violated_rules = []
        if input_analysis.get("risk_score", 0.0) > 0.5:
            violated_rules.append("input_risk")
        if output_analysis.get("risk_score", 0.0) > 0.5:
            violated_rules.append("output_risk")
        if legal_risk.get("risk_score", 0.0) > 0.5:
            violated_rules.append("legal_risk")
        if deception.get("score", 0.0) > 0.5:
            violated_rules.append("deception")
        if psych_pressure.get("score", 0.0) > 0.5:
            violated_rules.append("psychological_pressure")
        
        # Determine risk category
        if legal_risk.get("risk_score", 0.0) > 0.6:
            risk_category = "legal_compliance"
        elif deception.get("score", 0.0) > 0.6:
            risk_category = "deception"
        elif psych_pressure.get("score", 0.0) > 0.6:
            risk_category = "psychological_manipulation"
        elif input_analysis.get("risk_score", 0.0) > 0.6:
            risk_category = "input_risk"
        else:
            risk_category = "general"
        
        # Generate summary and recommendation
        summary = f"Risk assessment completed. {len(violated_rules)} rule violations detected. Risk level: {risk_level}."
        
        if risk_level == "critical":
            recommendation = "Immediate action required. Content should be blocked and reviewed by compliance team."
        elif risk_level == "high":
            recommendation = "Content requires review. Consider blocking or modification before deployment."
        elif risk_level == "medium":
            recommendation = "Content should be monitored. Consider additional safeguards."
        else:
            recommendation = "Content appears safe. Standard monitoring recommended."
        
        return ProxyLiteReportResponse(
            risk_level=risk_level,
            risk_category=risk_category,
            violated_rule_count=len(violated_rules),
            summary=summary,
            recommendation=recommendation
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating audit report: {str(e)}"
        )

