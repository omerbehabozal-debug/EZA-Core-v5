# -*- coding: utf-8 -*-
"""
OECD AI Principles Policy Pack
OECD AI Principles compliance
"""

from typing import Optional, Dict, Any
from backend.regulation.base_policy import BasePolicyPack, PolicyResult


class OECDPolicyPack(BasePolicyPack):
    """OECD AI Principles compliance policy pack"""
    
    name = "oecd"
    version = "1.0.0"
    
    def evaluate(
        self,
        input_text: str,
        output_text: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
    ) -> PolicyResult:
        """Evaluate against OECD AI Principles"""
        reasons = []
        tags = []
        score = 1.0
        
        # Extract risk indicators
        eza_score = meta.get("eza_score", {}) if meta else {}
        risk_score = eza_score.get("overall", 0.0) if isinstance(eza_score, dict) else 0.0
        
        # OECD focuses on inclusive growth and human-centered values
        if risk_score > 0.6:
            score = 0.5
            reasons.append("Risk level may conflict with OECD principles")
            tags.append("moderate_risk")
        
        # Check alignment with human values
        alignment = meta.get("alignment", {}) if meta else {}
        if isinstance(alignment, dict):
            alignment_score = alignment.get("score", 1.0)
            if alignment_score < 0.75:
                score = min(score, alignment_score)
                reasons.append("Alignment with human values below threshold")
                tags.append("alignment")
        
        # Check for fairness
        output_analysis = meta.get("output_analysis", {}) if meta else {}
        if isinstance(output_analysis, dict):
            fairness_score = output_analysis.get("fairness", 1.0)
            if fairness_score < 0.8:
                score = min(score, fairness_score)
                reasons.append("Fairness requirements not met")
                tags.append("fairness")
        
        passed = score >= 0.65
        
        if not reasons:
            reasons.append("OECD AI Principles compliance check passed")
        
        return PolicyResult(
            passed=passed,
            score=score,
            reasons=reasons,
            tags=tags,
            metadata={"policy": "oecd", "version": self.version}
        )

