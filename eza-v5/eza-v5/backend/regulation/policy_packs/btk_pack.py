# -*- coding: utf-8 -*-
"""
BTK (Information and Communication Technologies Authority) Policy Pack
Turkish ICT regulation compliance
"""

from typing import Optional, Dict, Any
from backend.regulation.base_policy import BasePolicyPack, PolicyResult


class BTKPolicyPack(BasePolicyPack):
    """BTK compliance policy pack"""
    
    name = "btk"
    version = "1.0.0"
    
    def evaluate(
        self,
        input_text: str,
        output_text: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
    ) -> PolicyResult:
        """Evaluate against BTK regulations"""
        reasons = []
        tags = []
        score = 1.0
        
        # Extract risk indicators
        eza_score = meta.get("eza_score", {}) if meta else {}
        risk_score = eza_score.get("overall", 0.0) if isinstance(eza_score, dict) else 0.0
        
        # BTK focuses on data protection and privacy
        if risk_score > 0.6:
            score = 0.4
            reasons.append("Moderate to high risk detected")
            tags.append("moderate_risk")
        
        # Check alignment
        alignment = meta.get("alignment", {}) if meta else {}
        if isinstance(alignment, dict):
            alignment_score = alignment.get("score", 1.0)
            if alignment_score < 0.7:
                score = min(score, alignment_score)
                reasons.append("Low alignment score")
                tags.append("low_alignment")
        
        passed = score >= 0.65
        
        if not reasons:
            reasons.append("BTK compliance check passed")
        
        return PolicyResult(
            passed=passed,
            score=score,
            reasons=reasons,
            tags=tags,
            metadata={"policy": "btk", "version": self.version}
        )

