# -*- coding: utf-8 -*-
"""
EU AI Act Policy Pack
European Union AI Act compliance
"""

from typing import Optional, Dict, Any
from backend.regulation.base_policy import BasePolicyPack, PolicyResult


class EUAIPolicyPack(BasePolicyPack):
    """EU AI Act compliance policy pack"""
    
    name = "eu_ai"
    version = "1.0.0"
    
    def evaluate(
        self,
        input_text: str,
        output_text: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
    ) -> PolicyResult:
        """Evaluate against EU AI Act"""
        reasons = []
        tags = []
        score = 1.0
        
        # Extract risk indicators
        eza_score = meta.get("eza_score", {}) if meta else {}
        risk_score = eza_score.get("overall", 0.0) if isinstance(eza_score, dict) else 0.0
        
        # EU AI Act has strict requirements
        if risk_score > 0.5:
            score = 0.3
            reasons.append("Risk level exceeds EU AI Act thresholds")
            tags.append("high_risk")
        
        # Check for bias
        output_analysis = meta.get("output_analysis", {}) if meta else {}
        if isinstance(output_analysis, dict):
            bias_flags = output_analysis.get("bias_flags", [])
            if bias_flags:
                score = min(score, 0.4)
                reasons.append(f"Bias detected: {', '.join(bias_flags[:2])}")
                tags.append("bias")
        
        # Check for transparency
        alignment = meta.get("alignment", {}) if meta else {}
        if isinstance(alignment, dict):
            transparency = alignment.get("transparency", 1.0)
            if transparency < 0.8:
                score = min(score, transparency)
                reasons.append("Transparency requirements not met")
                tags.append("transparency")
        
        passed = score >= 0.7
        
        if not reasons:
            reasons.append("EU AI Act compliance check passed")
        
        return PolicyResult(
            passed=passed,
            score=score,
            reasons=reasons,
            tags=tags,
            metadata={"policy": "eu_ai", "version": self.version}
        )

