# -*- coding: utf-8 -*-
"""
LegalRiskEngine v1.0 – EZA Level-6 Safety Layer

High-level legal risk inference (not legal advice).
Detects illegal-activity, data-privacy/identity issues, harassment/threat/extortion patterns.
"""

from typing import Dict, Any, List, Optional


class LegalRiskEngine:
    """
    LegalRiskEngine v1.0: High-level legal risk inference.
    
    Detects:
    - illegal-activity
    - data-privacy / identity issues
    - harassment / threat / extortion patterns
    
    Inputs:
    - intent_engine result
    - identity_block
    - reasoning_shield
    - deception_engine
    - psychological_pressure
    
    Returns:
    - score (0–1)
    - level ("low" | "medium" | "high" | "critical")
    - categories: list[str] e.g. ["illegal-activity", "privacy-violation"]
    - summary: short explanation
    """

    def __init__(self):
        """Initialize LegalRiskEngine."""
        pass

    def analyze(self, report: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze report for legal risk indicators.
        
        Args:
            report: Report dict containing various analysis results
            
        Returns:
            {
                "score": float (0-1),
                "level": str ("low" | "medium" | "high" | "critical"),
                "categories": List[str],
                "summary": str
            }
        """
        try:
            if not report or not isinstance(report, dict):
                return self._fallback("Invalid or empty report")
            
            categories: List[str] = []
            score = 0.0
            
            # 1) Check intent_engine for illegal activity
            intent_engine = report.get("intent_engine", {})
            if intent_engine:
                primary_intent = intent_engine.get("primary", "")
                risk_score = intent_engine.get("risk_score", 0.0)
                
                illegal_intents = ["illegal", "violence", "harassment", "threat", "extortion"]
                if any(illegal in primary_intent.lower() for illegal in illegal_intents):
                    categories.append("illegal-activity")
                    score = max(score, min(1.0, risk_score * 1.2))
                
                # Check risk flags
                risk_flags = report.get("risk_flags", [])
                if any(flag in ["illegal", "violence", "threat", "harassment"] 
                      for flag in risk_flags):
                    if "illegal-activity" not in categories:
                        categories.append("illegal-activity")
                    score = max(score, 0.7)
            
            # 2) Check identity_block for privacy violations
            identity_block = report.get("identity_block", {})
            if identity_block and isinstance(identity_block, dict):
                identity_risk = identity_block.get("risk_score", 0.0)
                if identity_risk > 0.5:
                    categories.append("privacy-violation")
                    score = max(score, min(1.0, identity_risk * 0.9))
                
                # Check for sensitive data exposure
                if identity_block.get("ok", False):
                    identity_flags = identity_block.get("risk_flags", [])
                    if any("sensitive" in str(flag).lower() or "privacy" in str(flag).lower() 
                          for flag in identity_flags):
                        if "privacy-violation" not in categories:
                            categories.append("privacy-violation")
                        score = max(score, 0.6)
            
            # 3) Check reasoning_shield for legal risk patterns
            reasoning_shield = report.get("reasoning_shield", {})
            if reasoning_shield and isinstance(reasoning_shield, dict):
                shield_issues = reasoning_shield.get("issues", [])
                if any("legal" in str(issue).lower() or "illegal" in str(issue).lower() 
                      for issue in shield_issues):
                    if "illegal-activity" not in categories:
                        categories.append("illegal-activity")
                    score = max(score, 0.65)
            
            # 4) Check deception_engine - deception can amplify legal risk
            deception = report.get("deception", {})
            if deception and isinstance(deception, dict):
                deception_score = deception.get("score", 0.0)
                if deception_score > 0.6:
                    # If high deception + any legal risk, escalate
                    if categories:
                        score = min(1.0, score * 1.2)
                        categories.append("disguised-illegal-intent")
            
            # 5) Check psychological_pressure - can indicate harassment/extortion
            psych_pressure = report.get("psychological_pressure", {})
            if psych_pressure and isinstance(psych_pressure, dict):
                pressure_score = psych_pressure.get("score", 0.0)
                pressure_patterns = psych_pressure.get("patterns", [])
                
                if "emotional-blackmail" in pressure_patterns or pressure_score > 0.7:
                    if "harassment" not in categories:
                        categories.append("harassment")
                    score = max(score, min(1.0, pressure_score * 0.8))
            
            # 6) Check output analysis for harmful content
            output_analysis = report.get("output_analysis", {})
            if output_analysis and isinstance(output_analysis, dict):
                output_risk = output_analysis.get("risk_score", 0.0)
                output_flags = output_analysis.get("risk_flags", [])
                
                if any(flag in ["illegal", "violence", "threat"] for flag in output_flags):
                    if "illegal-activity" not in categories:
                        categories.append("illegal-activity")
                    score = max(score, min(1.0, output_risk * 0.9))
            
            # Normalize score to 0-1
            score = min(1.0, max(0.0, score))
            
            # Determine level
            if score >= 0.9:
                level = "critical"
            elif score >= 0.7:
                level = "high"
            elif score >= 0.4:
                level = "medium"
            else:
                level = "low"
            
            # Generate summary
            if categories:
                summary = f"Legal risk detected: {', '.join(categories)}. Score: {score:.2f}, Level: {level}"
            else:
                summary = f"No significant legal risk detected. Score: {score:.2f}"
            
            return {
                "score": round(score, 3),
                "level": level,
                "categories": categories,
                "summary": summary
            }
            
        except Exception as e:
            return self._fallback(f"Error in legal risk analysis: {str(e)}")
    
    def _fallback(self, error_msg: str) -> Dict[str, Any]:
        """Return fallback structure on error."""
        return {
            "ok": False,
            "error": error_msg,
            "score": 0.0,
            "level": "unknown",
            "categories": [],
            "summary": "Legal risk analysis failed."
        }

