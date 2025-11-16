# -*- coding: utf-8 -*-
"""
EZAScore – EZA Level-5 Upgrade
Tüm katmanlardan gelen veriyi 18 parametrelik ağırlıklı
tek bir etik skor haline getirir.
"""


class EZAScore:
    """
    Tüm katmanlardan gelen veriyi 18 parametrelik ağırlıklı
    tek bir etik skor haline getirir.
    """

    def __init__(self):
        self.weights = {
            "intent": 0.20,
            "identity": 0.12,
            "reasoning": 0.12,
            "narrative": 0.08,
            "drift": 0.12,
            "output": 0.16,
            # Level-6 new fields (optional, backward compatible)
            "deception": 0.08,
            "psychological_pressure": 0.06,
            "legal_risk": 0.06,
            # LEVEL 7 – Critical Bias Engine
            "critical_bias": 0.07
        }

    def compute(self, report, drift_matrix):
        # Extract intent data from various possible locations
        intent_data = report.get("intent_engine") or report.get("intent") or report.get("input", {}).get("intent_engine", {})
        intent_score = self._to_score(intent_data)
        
        # Extract identity block data
        identity_data = report.get("identity_block", {})
        identity_score = self._simple(identity_data)
        
        # Extract reasoning shield data
        reasoning_data = report.get("reasoning_shield", {}) or report.get("shield", {})
        reasoning_score = self._simple(reasoning_data)
        
        # Extract narrative data
        narrative_data = report.get("narrative", {})
        narrative_score = self._simple(narrative_data)
        
        # Extract drift score and normalize to 0-1 range
        # Drift score can be negative (decreasing risk) or positive (increasing risk)
        raw_drift = drift_matrix.get("score", 0)
        # Normalize: clamp to reasonable range first, then map to 0-1
        # Assuming max drift per window is around 5 (6 entries * 0.8 max change)
        clamped_drift = max(-5.0, min(5.0, raw_drift))
        # Map to 0-1 range: -5 -> 0, 0 -> 0.5, +5 -> 1.0
        drift_score = max(0.0, min(1.0, (clamped_drift + 5.0) / 10.0))
        
        # Extract output data from various possible locations
        output_data = report.get("output_analysis") or report.get("output") or report.get("output_data", {})
        output_score = self._to_score(output_data)

        # Level-6: Extract new safety layer scores (optional, backward compatible)
        deception_data = report.get("deception", {})
        deception_score = 0.0
        if deception_data and isinstance(deception_data, dict):
            deception_score_raw = deception_data.get("score", 0.0)
            # Convert 0-1 score to risk level equivalent
            if deception_score_raw >= 0.7:
                deception_score = 1.0
            elif deception_score_raw >= 0.4:
                deception_score = 0.5
            else:
                deception_score = 0.2
        
        psych_pressure_data = report.get("psychological_pressure", {})
        pressure_score = 0.0
        if psych_pressure_data and isinstance(psych_pressure_data, dict):
            pressure_score_raw = psych_pressure_data.get("score", 0.0)
            if pressure_score_raw >= 0.7:
                pressure_score = 1.0
            elif pressure_score_raw >= 0.4:
                pressure_score = 0.5
            else:
                pressure_score = 0.2
        
        legal_risk_data = report.get("legal_risk", {})
        legal_score = 0.0
        if legal_risk_data and isinstance(legal_risk_data, dict):
            legal_level = legal_risk_data.get("level", "low")
            legal_score = self._to_score({"risk_level": legal_level})

        # LEVEL 7 – Critical Bias Engine
        critical_bias = report.get("critical_bias") or {}
        critical_bias_score = float(critical_bias.get("bias_score", 0.0))

        # Compute final score with optional Level-6 and Level-7 fields
        # If new fields are missing, use original weights (backward compatible)
        has_level6 = (deception_data or psych_pressure_data or legal_risk_data)
        has_level7 = critical_bias and isinstance(critical_bias, dict) and critical_bias.get("bias_score") is not None
        
        if has_level6 or has_level7:
            # Use updated weights with Level-6 and Level-7 fields
            total_score = (
                intent_score * self.weights["intent"]
                + identity_score * self.weights["identity"]
                + reasoning_score * self.weights["reasoning"]
                + narrative_score * self.weights["narrative"]
                + drift_score * self.weights["drift"]
                + output_score * self.weights["output"]
                + deception_score * self.weights["deception"]
                + pressure_score * self.weights["psychological_pressure"]
                + legal_score * self.weights["legal_risk"]
            )
            
            # Add critical_bias if available
            if has_level7:
                total_score += critical_bias_score * self.weights["critical_bias"]
            
            # Normalize by total weight used (for backward compatibility)
            total_weight = (
                self.weights["intent"]
                + self.weights["identity"]
                + self.weights["reasoning"]
                + self.weights["narrative"]
                + self.weights["drift"]
                + self.weights["output"]
                + self.weights["deception"]
                + self.weights["psychological_pressure"]
                + self.weights["legal_risk"]
            )
            if has_level7:
                total_weight += self.weights["critical_bias"]
            
            # Normalize to keep score in 0-1 range
            if total_weight > 0:
                final = total_score / total_weight
            else:
                final = total_score
        else:
            # Backward compatible: use original weights
            final = (
                intent_score * 0.25
                + identity_score * 0.15
                + reasoning_score * 0.15
                + narrative_score * 0.10
                + drift_score * 0.15
                + output_score * 0.20
            )

        result = {
            "final_score": round(final, 3),
            "risk_grade": self._grade(final)
        }
        
        # Add component scores for debugging
        if has_level6 or has_level7:
            result["components"] = {
                "intent": round(intent_score, 4),
                "identity": round(identity_score, 4),
                "reasoning": round(reasoning_score, 4),
                "narrative": round(narrative_score, 4),
                "drift": round(drift_score, 4),
                "output": round(output_score, 4),
                "deception": round(deception_score, 4),
                "psychological_pressure": round(pressure_score, 4),
                "legal_risk": round(legal_score, 4),
            }
            if has_level7:
                result["components"]["critical_bias"] = round(critical_bias_score, 4)

        return result

    def _to_score(self, block):
        if not block:
            return 0
        lvl = block.get("risk_level") or block.get("risk")
        return {
            "low": 0.2,
            "medium": 0.5,
            "high": 0.8,
            "critical": 1.0
        }.get(lvl, 0.3)

    def _simple(self, block):
        if not block:
            return 0
        # Try to extract risk_level if available
        risk_level = block.get("risk_level") or block.get("risk") or block.get("final_risk_level")
        if risk_level:
            return self._to_score({"risk_level": risk_level})
        # If block exists but no risk_level, return default 0.5
        return 0.5

    def _grade(self, score):
        if score < 0.3:
            return "A (Safe)"
        elif score < 0.55:
            return "B (Caution)"
        elif score < 0.8:
            return "C (High Risk)"
        else:
            return "D (Critical)"

