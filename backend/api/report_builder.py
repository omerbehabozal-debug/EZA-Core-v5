# -*- coding: utf-8 -*-
"""
report_builder.py – EZA-Core v4.0

EZA Professional Reporting Layer v3.2: Standardized JSON report builder.
Combines all analysis modules into a single professional report format.
"""

import time
from typing import Dict, Any


class ReportBuilder:
    """
    EZA'nın tüm analiz modüllerinden çıkan verileri
    tek bir profesyonel rapor formatında birleştirir.
    
    Features:
    - Standardized JSON report format
    - Can write reports to logs/ folder
    - Can prepare reports for external APIs
    - Generates frontend-friendly "report card" format
    """

    def build(
        self,
        input_data: Dict[str, Any],
        output_data: Dict[str, Any],
        intent_data: Dict[str, Any] = None,
        narrative_data: Dict[str, Any] = None,
        shield_data: Dict[str, Any] = None,
        advisor_data: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """
        Build a comprehensive EZA report from all analysis modules.
        
        Args:
            input_data: Input analysis results
            output_data: Output analysis results
            intent_data: Intent engine results (optional)
            narrative_data: Narrative engine results (optional)
            shield_data: ReasoningShield results (optional)
            advisor_data: Advisor results (optional)
            
        Returns:
            Standardized JSON report with all analysis data
        """
        return {
            "input": input_data,
            "output": output_data,
            "intent": intent_data or {},
            "narrative": narrative_data or {},
            "shield": shield_data or {},
            "advisor": advisor_data or {},
            "meta": {
                "timestamp": time.time(),
                "version": "EZA-Core v4.0 + RS v5.0",
                "status": "completed",
            },
        }
    
    def build_report_card(
        self,
        input_data: Dict[str, Any],
        output_data: Dict[str, Any],
        shield_data: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """
        Build a simplified "report card" format for frontend display.
        
        Args:
            input_data: Input analysis results
            output_data: Output analysis results
            shield_data: ReasoningShield results (optional)
            
        Returns:
            Simplified report card format
        """
        shield_level = shield_data.get("level", "safe") if shield_data else "safe"
        shield_score = shield_data.get("alignment_score", 100) if shield_data else 100
        
        return {
            "eza_alignment": {
                "level": shield_level,
                "score": shield_score,
                "label": shield_level.upper(),
            },
            "risk_level": input_data.get("risk_level", "low"),
            "risk_flags": input_data.get("risk_flags", []),
            "summary": self._generate_summary(input_data, output_data, shield_data),
            "timestamp": time.time(),
        }
    
    def _generate_summary(
        self,
        input_data: Dict[str, Any],
        output_data: Dict[str, Any],
        shield_data: Dict[str, Any] = None,
    ) -> str:
        """
        Generate a human-readable summary of the analysis.
        
        Args:
            input_data: Input analysis results
            output_data: Output analysis results
            shield_data: ReasoningShield results (optional)
            
        Returns:
            Human-readable summary string
        """
        if shield_data:
            level = shield_data.get("level", "safe")
            score = shield_data.get("alignment_score", 100)
            issues = shield_data.get("issues", [])
            
            if level == "critical":
                return f"Critical risk detected. Alignment score: {score}/100. Issues: {', '.join(issues[:3])}"
            elif level == "caution":
                return f"Caution required. Alignment score: {score}/100. Issues: {', '.join(issues[:3])}"
            else:
                return f"Safe content. Alignment score: {score}/100"
        
        risk_level = input_data.get("risk_level", "low")
        return f"Analysis completed. Risk level: {risk_level}"

