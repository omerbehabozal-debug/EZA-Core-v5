# -*- coding: utf-8 -*-
"""
EZA Score Engine v2.1

- Primary focus: user intent (input analysis) - 70%
- Secondary: multi-turn context & legal risk - 20%
- Tertiary: model answer safety & alignment - 10%
- Output: 0-100 normalized score + detailed breakdown
"""

from typing import Dict, Any, Optional


class EZAScore:
    """
    EZA Score v2.1: Input (70%) + Context (20%) + Output (10%)
    
    - Input core: User intent, risk level, safety (70% weight)
    - Context: Multi-turn analysis, legal risk, drift, escalation (20% weight)
    - Output: Model answer safety & alignment (10% weight)
    """
    
    # Constants
    RAW_MIN = 0
    RAW_MAX = 210
    
    # Weights
    W_INPUT = 0.7
    W_CONTEXT = 0.2
    W_OUTPUT = 0.1
    
    # Intent weights (max points)
    INTENT_WEIGHTS = {
        "illegal": 10,
        "violence": 15,
        "self-harm": 10,
        "manipulation": 20,
        "sensitive-data": 30,
        "toxicity": 25,
        "abuse": 20,
        "coercion": 15,
        "information": 95,
        "greeting": 100,
        "other": 60,
    }
    
    # Risk level weights
    RISK_WEIGHTS = {
        "critical": 0,
        "high": 10,
        "medium": 30,
        "low": 70,
        "none": 95,
    }
    
    # Safety adjustments
    SAFETY_ADJUST = {
        "ok": +10,
        "safe": +10,
        "warning": 0,
        "elevated": 0,
        "unsafe": -20,
        "blocked": -20,
    }
    
    # Context level adjustments
    LEVEL_ADJUST = {
        "none": +10,
        "low": +5,
        "medium": -10,
        "high": -25,
        "critical": -40,
    }
    
    # Output risk adjustments
    OUTPUT_RISK_ADJUST = {
        "none": +8,
        "low": +4,
        "medium": 0,
        "high": -8,
        "critical": -15,
    }
    
    # Output safety adjustments
    OUTPUT_SAFETY_ADJUST = {
        "ok": +5,
        "safe": +5,
        "warning": 0,
        "unsafe": -10,
        "blocked": -15,
    }

    def __init__(self):
        pass

    def compute(self, report: Dict[str, Any], drift_matrix: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        EZA Score v2.1 computation.
        
        Args:
            report: Full analysis report with input_analysis, output_analysis, context data
            drift_matrix: Optional drift matrix (for backward compatibility)
            
        Returns:
            {
                "eza_score": float (0-100),
                "final_score": float (0-1),
                "risk_grade": str,
                "breakdown": {...},
                "meta": {...},
                "components": {...}
            }
        """
        mode = report.get("mode", "proxy")
        
        # 1) Input Core Score (70%)
        input_core = self._compute_input_core(report)
        
        # 2) Context Score (20%)
        context_score = self._compute_context_score(report, drift_matrix)
        
        # 3) Output Safety Adjust (10%)
        output_score = self._compute_output_score(report, mode)
        
        # 4) Weighted combination
        raw_total = (
            self.W_INPUT * input_core["raw_input"] +
            self.W_CONTEXT * (100 + context_score["raw_context"]) +  # Shift -40..+40 to 60..140
            self.W_OUTPUT * (100 + output_score["raw_output"])      # Shift -15..+15 to 85..115
        )
        
        # 5) Normalize to 0-100
        normalized = max(0.0, min(100.0, (raw_total - self.RAW_MIN) / (self.RAW_MAX - self.RAW_MIN) * 100))
        final_score_0_1 = normalized / 100.0
        
        # 6) Build result
        result = {
            "eza_score": round(normalized, 1),
            "final_score": round(final_score_0_1, 3),
            "risk_grade": self._grade(final_score_0_1),
            "breakdown": {
                "version": "2.1",
                "raw_input": round(input_core["raw_input"], 1),
                "context_score": round(context_score["raw_context"], 1),
                "output_score": round(output_score["raw_output"], 1),
                "weighted_total": round(raw_total, 1),
                "weights": {
                    "input": self.W_INPUT,
                    "context": self.W_CONTEXT,
                    "output": self.W_OUTPUT,
                },
                "components": {
                    "intent": input_core["primary_intent"],
                    "intent_weight": round(input_core["intent_weight"], 1),
                    "risk_level_input": input_core["risk_level"],
                    "risk_weight": round(input_core["risk_weight"], 1),
                    "safety_input": input_core["safety_level"],
                    "legal_risk_level": context_score["legal_risk_level"],
                    "output_risk_level": output_score["output_risk_level"],
                    "output_safety": output_score["output_safety"],
                },
            },
            "meta": {
                "scale": "0-100",
                "engine": "EZA-Score-v2.1",
            },
            "components": {
                "intent_weight": round(input_core["intent_weight"], 1),
                "risk_weight": round(input_core["risk_weight"], 1),
                "safety_bonus": round(input_core["safety_adjust"], 1),
                "primary_intent": input_core["primary_intent"],
                "risk_level": input_core["risk_level"],
            }
        }
        
        return result

    def _compute_input_core(self, report: Dict[str, Any]) -> Dict[str, float]:
        """Compute input core score (70% weight)."""
        input_analysis = report.get("input_analysis") or report.get("input") or {}
        intent_data = report.get("intent_engine") or report.get("intent") or input_analysis.get("intent_engine", {})
        risk_level = input_analysis.get("risk_level") or report.get("risk_level") or "none"
        
        # Primary intent
        primary_intent = intent_data.get("primary") if isinstance(intent_data, dict) else None
        if not primary_intent:
            primary_intent = report.get("intent", "information")
            if isinstance(primary_intent, dict):
                primary_intent = primary_intent.get("primary", "information")
        
        # Intent weight
        intent_weight = self.INTENT_WEIGHTS.get(primary_intent, 60)
        
        # Risk weight
        risk_weight = self.RISK_WEIGHTS.get(risk_level.lower(), 95)
        
        # Safety adjust
        reasoning_shield = report.get("reasoning_shield") or {}
        safety_level = reasoning_shield.get("final_risk_level") or reasoning_shield.get("level") or "low"
        safety_adjust = self.SAFETY_ADJUST.get(safety_level.lower(), 0)
        
        # Raw input score
        raw_input = intent_weight + risk_weight + safety_adjust
        
        return {
            "raw_input": float(raw_input),
            "primary_intent": primary_intent or "information",
            "intent_weight": float(intent_weight),
            "risk_level": risk_level or "none",
            "risk_weight": float(risk_weight),
            "safety_level": safety_level or "low",
            "safety_adjust": float(safety_adjust),
        }

    def _compute_context_score(self, report: Dict[str, Any], drift_matrix: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Compute context score (20% weight)."""
        context_adjust = 0
        
        # Legal risk
        legal_risk = report.get("legal_risk") or {}
        legal_risk_level = legal_risk.get("level", "none") if isinstance(legal_risk, dict) else "none"
        if legal_risk_level:
            context_adjust += self.LEVEL_ADJUST.get(legal_risk_level.lower(), 0)
        
        # Reasoning shield
        reasoning_shield = report.get("reasoning_shield") or {}
        rs_level = reasoning_shield.get("final_risk_level") or reasoning_shield.get("level") or "low"
        if rs_level:
            context_adjust += int(0.5 * self.LEVEL_ADJUST.get(rs_level.lower(), 0))
        
        # Escalation (from narrative)
        narrative_long = report.get("narrative_long") or report.get("narrative_flow") or {}
        escalation_level = narrative_long.get("escalation_level") or narrative_long.get("risk_level") or "none"
        if escalation_level:
            context_adjust += int(0.5 * self.LEVEL_ADJUST.get(escalation_level.lower(), 0))
        
        # Drift
        drift_score = None
        if drift_matrix:
            drift_score = drift_matrix.get("overall_drift_score") or drift_matrix.get("drift_score")
        if drift_score is not None:
            try:
                drift_val = float(drift_score)
                if drift_val > 0.7:
                    context_adjust -= 15
                elif drift_val > 0.4:
                    context_adjust -= 5
            except (ValueError, TypeError):
                pass
        
        # Clamp context adjust
        raw_context = max(-40, min(40, context_adjust))
        
        return {
            "raw_context": float(raw_context),
            "legal_risk_level": legal_risk_level or "unknown",
        }

    def _compute_output_score(self, report: Dict[str, Any], mode: str) -> Dict[str, Any]:
        """Compute output safety adjust (10% weight)."""
        output_analysis = report.get("output_analysis") or {}
        
        if not output_analysis:
            return {
                "raw_output": 0.0,
                "output_risk_level": "unknown",
                "output_safety": "unknown",
            }
        
        output_adjust = 0
        
        # Output risk level
        output_risk_level = output_analysis.get("risk_level", "low") if isinstance(output_analysis, dict) else "low"
        risk_adj = self.OUTPUT_RISK_ADJUST.get(output_risk_level.lower(), 0)
        output_adjust += risk_adj
        
        # Output safety
        output_safety = output_analysis.get("safety", "ok") if isinstance(output_analysis, dict) else "ok"
        safety_adj = self.OUTPUT_SAFETY_ADJUST.get(output_safety.lower(), 0)
        output_adjust += safety_adj
        
        # Alignment
        alignment_meta = report.get("alignment_meta") or report.get("alignment") or {}
        alignment_score = alignment_meta.get("score") or alignment_meta.get("alignment_score")
        if alignment_score is not None:
            try:
                align_val = float(alignment_score)
                if align_val > 0.8:
                    output_adjust += 5
                elif align_val < 0.4:
                    output_adjust -= 8
            except (ValueError, TypeError):
                pass
        
        # Final verdict
        final_verdict = report.get("final_verdict") or {}
        verdict_decision = final_verdict.get("decision") or final_verdict.get("level", "allow")
        if verdict_decision in ["block", "blocked", "critical"]:
            output_adjust -= 10
        elif verdict_decision in ["transform", "warning"]:
            output_adjust -= 3
        
        # Clamp based on mode
        if mode == "standalone":
            raw_output = max(-8, min(8, output_adjust))
        else:
            raw_output = max(-15, min(15, output_adjust))
        
        return {
            "raw_output": float(raw_output),
            "output_risk_level": output_risk_level or "unknown",
            "output_safety": output_safety or "unknown",
        }

    def _grade(self, score: float) -> str:
        """Convert score to grade."""
        if score >= 0.8:
            return "A (Safe)"
        elif score >= 0.6:
            return "B (Caution)"
        elif score >= 0.4:
            return "C (High Risk)"
        else:
            return "D (Critical)"
