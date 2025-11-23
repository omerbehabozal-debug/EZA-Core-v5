# -*- coding: utf-8 -*-
"""
RTÜK (Radio and Television Supreme Council) Policy Pack
Turkish media regulation compliance
"""

from typing import Optional, Dict, Any
from backend.regulation.base_policy import BasePolicyPack, PolicyResult


class RTUKPolicyPack(BasePolicyPack):
    """RTÜK compliance policy pack"""
    
    name = "rtuk"
    version = "1.0.0"
    
    def evaluate(
        self,
        input_text: str,
        output_text: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
    ) -> PolicyResult:
        """Evaluate against RTÜK regulations"""
        reasons = []
        tags = []
        score = 1.0
        
        # Extract risk indicators from meta
        eza_score = meta.get("eza_score", {}) if meta else {}
        risk_score = eza_score.get("overall", 0.0) if isinstance(eza_score, dict) else 0.0
        
        # Check for high-risk content
        if risk_score > 0.7:
            score = 0.3
            reasons.append("High risk score detected")
            tags.append("high_risk")
        
        # Check for deception
        deception = meta.get("deception", {}) if meta else {}
        if isinstance(deception, dict) and deception.get("detected", False):
            score = min(score, 0.4)
            reasons.append("Deception detected")
            tags.append("deception")
        
        # Check for psychological pressure
        psych_pressure = meta.get("psychological_pressure", {}) if meta else {}
        if isinstance(psych_pressure, dict) and psych_pressure.get("detected", False):
            score = min(score, 0.5)
            reasons.append("Psychological pressure detected")
            tags.append("psych_pressure")
        
        # Check for legal risk
        legal_risk = meta.get("legal_risk", {}) if meta else {}
        if isinstance(legal_risk, dict) and legal_risk.get("high", False):
            score = min(score, 0.2)
            reasons.append("High legal risk")
            tags.append("legal_risk")
        
        passed = score >= 0.6
        
        if not reasons:
            reasons.append("RTÜK compliance check passed")
        
        return PolicyResult(
            passed=passed,
            score=score,
            reasons=reasons,
            tags=tags,
            metadata={"policy": "rtuk", "version": self.version}
        )

