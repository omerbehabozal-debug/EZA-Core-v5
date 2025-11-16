# -*- coding: utf-8 -*-
"""
models/scoring_matrix.py – EZA-Core v10

ScoringMatrix: Weighted scoring matrix for risk calculation.
"""

from typing import Dict, Any


class ScoringMatrix:
    """
    ScoringMatrix: Centralized scoring and risk level calculation.
    """
    
    # Risk thresholds
    RISK_THRESHOLDS = {
        "low": 0.0,
        "medium": 0.35,
        "high": 0.7,
        "critical": 0.9,
    }
    
    # Category base weights
    CATEGORY_WEIGHTS = {
        "illegal": 1.0,
        "violence": 1.0,
        "self-harm": 1.0,
        "manipulation": 0.9,
        "sensitive-data": 0.85,
        "toxicity": 0.7,
        "information": 0.2,
    }
    
    @staticmethod
    def calculate_final_risk(
        intent_risk: float,
        reasoning_risk: float,
        identity_risk: float,
        narrative_risk: float,
    ) -> float:
        """
        Calculate final risk score from all components.
        Uses max() to ensure highest risk is captured.
        """
        return max(intent_risk, reasoning_risk, identity_risk, narrative_risk)
    
    @staticmethod
    def classify_risk_level(risk_score: float) -> str:
        """
        Classify risk score into risk level.
        
        Args:
            risk_score: Risk score (0.0 - 1.0)
            
        Returns:
            Risk level: "low" | "medium" | "high" | "critical"
        """
        if risk_score >= ScoringMatrix.RISK_THRESHOLDS["critical"]:
            return "critical"
        elif risk_score >= ScoringMatrix.RISK_THRESHOLDS["high"]:
            return "high"
        elif risk_score >= ScoringMatrix.RISK_THRESHOLDS["medium"]:
            return "medium"
        else:
            return "low"
    
    @staticmethod
    def apply_category_weight(risk_score: float, category: str) -> float:
        """
        Apply category-specific weight to risk score.
        
        Args:
            risk_score: Base risk score
            category: Risk category
            
        Returns:
            Weighted risk score
        """
        weight = ScoringMatrix.CATEGORY_WEIGHTS.get(category, 1.0)
        return min(risk_score * weight, 1.0)

