# -*- coding: utf-8 -*-
"""
EthicalGradientEngine v1.0 – EZA Level-6 Safety Layer

Computes a refined ethical impact assessment based on multiple safety dimensions.
"""

from typing import Dict, Any, List, Optional


class EthicalGradientEngine:
    """
    EthicalGradientEngine v1.0: Computes refined ethical impact assessment.
    
    Based on:
    - self-harm / violence / illegal / manipulation / toxicity
    - privacy & identity risk
    - legal risk result
    - deception & psychological pressure
    - drift matrix (trend)
    
    Returns:
    - ethical_score (0–100)
    - grade ("A"–"F")
    - dimensions: dict with keys like "individual_harm", "societal_harm", "consent", "privacy", "legal"
    - summary
    """

    def __init__(self):
        """Initialize EthicalGradientEngine."""
        pass

    def compute(self, report: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compute ethical gradient from report.
        
        Args:
            report: Report dict containing various analysis results
            
        Returns:
            {
                "ethical_score": float (0-100),
                "grade": str ("A" | "B" | "C" | "D" | "F"),
                "dimensions": Dict[str, float],
                "summary": str
            }
        """
        try:
            if not report or not isinstance(report, dict):
                return self._fallback("Invalid or empty report")
            
            dimensions: Dict[str, float] = {}
            
            # 1) Individual Harm Dimension
            # Based on intent, reasoning, deception, pressure
            intent_engine = report.get("intent_engine", {})
            intent_score = intent_engine.get("risk_score", 0.0) if intent_engine else 0.0
            
            reasoning_shield = report.get("reasoning_shield", {})
            reasoning_score = 0.0
            if reasoning_shield:
                alignment_score = reasoning_shield.get("alignment_score", 100)
                reasoning_score = 1.0 - (alignment_score / 100.0)
            
            deception = report.get("deception", {})
            deception_score = deception.get("score", 0.0) if deception else 0.0
            
            psych_pressure = report.get("psychological_pressure", {})
            pressure_score = psych_pressure.get("score", 0.0) if psych_pressure else 0.0
            
            # Check for specific harm types
            risk_flags = report.get("risk_flags", [])
            has_violence = any("violence" in str(flag).lower() for flag in risk_flags)
            has_self_harm = any("self-harm" in str(flag).lower() or "suicide" in str(flag).lower() 
                              for flag in risk_flags)
            
            individual_harm = max(
                intent_score,
                reasoning_score,
                deception_score * 0.8,
                pressure_score * 0.7,
                0.9 if has_violence else 0.0,
                0.95 if has_self_harm else 0.0
            )
            dimensions["individual_harm"] = round(individual_harm, 3)
            
            # 2) Societal Harm Dimension
            # Based on manipulation, illegal activity, drift
            has_manipulation = any("manipulation" in str(flag).lower() for flag in risk_flags)
            has_illegal = any("illegal" in str(flag).lower() for flag in risk_flags)
            
            drift = report.get("drift_matrix", {})
            drift_score = 0.0
            if drift:
                drift_raw = drift.get("score", 0.0)
                drift_score = max(0.0, min(1.0, (drift_raw + 5.0) / 10.0))
            
            societal_harm = max(
                deception_score * 0.6,
                0.8 if has_manipulation else 0.0,
                0.9 if has_illegal else 0.0,
                drift_score * 0.5
            )
            dimensions["societal_harm"] = round(societal_harm, 3)
            
            # 3) Consent Dimension
            # Based on deception and pressure
            consent_violation = max(
                deception_score * 0.9,
                pressure_score * 0.85
            )
            dimensions["consent"] = round(consent_violation, 3)
            
            # 4) Privacy Dimension
            # Based on identity_block
            identity_block = report.get("identity_block", {})
            privacy_score = identity_block.get("risk_score", 0.0) if identity_block else 0.0
            dimensions["privacy"] = round(privacy_score, 3)
            
            # 5) Legal Dimension
            # Based on legal_risk
            legal_risk = report.get("legal_risk", {})
            legal_score = legal_risk.get("score", 0.0) if legal_risk else 0.0
            dimensions["legal"] = round(legal_score, 3)
            
            # Compute overall ethical score (0-100, where 0 = worst, 100 = best)
            # Weighted average of dimensions (inverted: high dimension = low ethical score)
            weighted_sum = (
                individual_harm * 0.30 +
                societal_harm * 0.25 +
                consent_violation * 0.20 +
                privacy_score * 0.15 +
                legal_score * 0.10
            )
            
            # Convert to 0-100 scale (inverted: high risk = low score)
            ethical_score = round((1.0 - weighted_sum) * 100.0, 2)
            ethical_score = max(0.0, min(100.0, ethical_score))
            
            # Determine grade
            if ethical_score >= 90:
                grade = "A"
            elif ethical_score >= 75:
                grade = "B"
            elif ethical_score >= 60:
                grade = "C"
            elif ethical_score >= 40:
                grade = "D"
            else:
                grade = "F"
            
            # Generate summary
            worst_dimension = max(dimensions.items(), key=lambda x: x[1])
            if worst_dimension[1] > 0.6:
                summary = f"Ethical score: {ethical_score:.1f} (Grade: {grade}). Primary concern: {worst_dimension[0]} ({worst_dimension[1]:.2f})"
            else:
                summary = f"Ethical score: {ethical_score:.1f} (Grade: {grade}). All dimensions within acceptable range."
            
            return {
                "ethical_score": ethical_score,
                "grade": grade,
                "dimensions": dimensions,
                "summary": summary
            }
            
        except Exception as e:
            return self._fallback(f"Error in ethical gradient computation: {str(e)}")
    
    def _fallback(self, error_msg: str) -> Dict[str, Any]:
        """Return fallback structure on error."""
        return {
            "ok": False,
            "error": error_msg,
            "ethical_score": 50.0,
            "grade": "C",
            "dimensions": {
                "individual_harm": 0.0,
                "societal_harm": 0.0,
                "consent": 0.0,
                "privacy": 0.0,
                "legal": 0.0
            },
            "summary": "Ethical gradient computation failed."
        }

