# -*- coding: utf-8 -*-
"""
EZAScore – EZA Level-5 Upgrade (v2.0)
Kullanıcı mesajından (input) hesaplanan etik skor.
EZA cevabı skoru etkilemez.
"""


class EZAScore:
    """
    EZA Score v2.0: Sadece kullanıcı mesajından (input) hesaplanır.
    EZA cevabı skoru etkilemez.
    """

    def __init__(self):
        # Intent ağırlıkları (max puanlar)
        self.intent_weights = {
            "illegal": 10,      # max 10 puan
            "violence": 20,     # max 20 puan
            "self-harm": 15,    # max 15 puan
            "manipulation": 25, # max 25 puan
            "sensitive-data": 10, # max 10 puan
            "toxicity": 30,     # max 30 puan
            "information": 100, # max 100 puan
            "greeting": 100,    # max 100 puan
        }
        
        # Risk level ağırlıkları (max puanlar)
        self.risk_weights = {
            "critical": 0,   # max 0 puan
            "high": 10,      # max 10 puan
            "medium": 30,    # max 30 puan
            "low": 70,       # max 70 puan
            "none": 100,     # max 100 puan
        }
        
        # Safety bonus/penalty
        self.safety_bonus = 10   # Safety OK ise +10
        self.safety_penalty = -20  # Safety OK değilse -20

    def compute(self, report, drift_matrix):
        """
        EZA Score hesaplama - sadece input (kullanıcı mesajı) üzerinden.
        
        Args:
            report: Analiz raporu (input_analysis içermeli)
            drift_matrix: Drift matrisi (kullanılmıyor, backward compatibility için)
            
        Returns:
            {
                "eza_score": float (0-100),
                "final_score": float (0-1),
                "risk_grade": str,
                "components": {
                    "intent_weight": float,
                    "risk_weight": float,
                    "safety_bonus": float,
                }
            }
        """
        # 1) Input analizinden veri çek
        input_analysis = report.get("input_analysis") or report.get("input") or {}
        intent_data = report.get("intent_engine") or report.get("intent") or input_analysis.get("intent", {})
        risk_level = input_analysis.get("risk_level") or report.get("risk_level") or "none"
        
        # 2) Primary intent'i bul
        primary_intent = intent_data.get("primary") if isinstance(intent_data, dict) else None
        if not primary_intent:
            # Fallback: report'tan intent çek
            primary_intent = report.get("intent", {}).get("primary") if isinstance(report.get("intent"), dict) else "information"
        
        # 3) Intent weight hesapla
        intent_weight = self._compute_intent_weight(primary_intent)
        
        # 4) Risk weight hesapla
        risk_weight = self._compute_risk_weight(risk_level)
        
        # 5) Safety bonus/penalty hesapla
        safety_bonus = self._compute_safety_bonus(report, input_analysis)
        
        # 6) Final score: EZA_SCORE = (intent_weight + risk_weight + safety_bonus)
        # Her birinin max değerini al, sonra normalize et
        raw_score = intent_weight + risk_weight + safety_bonus
        
        # Normalize: max possible score = 100 (information intent) + 100 (none risk) + 10 (safety bonus) = 210
        # Min possible score = 0 (illegal intent) + 0 (critical risk) - 20 (safety penalty) = -20
        # Map to 0-100 range: (raw_score - min) / (max - min) * 100
        min_score = -20  # worst case
        max_score = 210  # best case
        normalized_score = max(0, min(100, ((raw_score - min_score) / (max_score - min_score)) * 100))
        
        # Convert to 0-1 range for final_score
        final_score_0_1 = normalized_score / 100.0
        
        result = {
            "eza_score": round(normalized_score, 1),  # 0-100 range for UI
            "final_score": round(final_score_0_1, 3),  # 0-1 range for internal use
            "risk_grade": self._grade(final_score_0_1),
            "components": {
                "intent_weight": round(intent_weight, 1),
                "risk_weight": round(risk_weight, 1),
                "safety_bonus": round(safety_bonus, 1),
                "primary_intent": primary_intent,
                "risk_level": risk_level,
            }
        }
        
        return result

    def _compute_intent_weight(self, primary_intent):
        """
        Intent'e göre weight hesapla.
        
        Returns:
            float: Intent weight (0-100 arası)
        """
        if not primary_intent:
            return 50  # Default
        
        # Intent weight'ini al
        weight = self.intent_weights.get(primary_intent, 50)  # Default 50 for unknown intents
        
        return float(weight)

    def _compute_risk_weight(self, risk_level):
        """
        Risk level'a göre weight hesapla.
        
        Returns:
            float: Risk weight (0-100 arası)
        """
        if not risk_level:
            return 100  # Default to none (safest)
        
        # Risk weight'ini al
        weight = self.risk_weights.get(risk_level.lower(), 100)  # Default to none (safest)
        
        return float(weight)

    def _compute_safety_bonus(self, report, input_analysis):
        """
        Safety durumuna göre bonus/penalty hesapla.
        
        Returns:
            float: Safety bonus (+10) veya penalty (-20)
        """
        # Safety bilgisini bul
        safety = report.get("safety") or input_analysis.get("safety")
        
        # Reasoning shield'den safety bilgisi
        if not safety:
            reasoning_shield = report.get("reasoning_shield") or {}
            safety = reasoning_shield.get("level") or reasoning_shield.get("final_risk_level")
        
        # Alignment meta'dan safety bilgisi
        if not safety:
            alignment_meta = report.get("alignment_meta") or {}
            if alignment_meta.get("label") == "Safe":
                safety = "OK"
        
        # Safety OK kontrolü
        if safety and (safety == "OK" or safety == "safe" or safety == "low" or safety == "none"):
            return self.safety_bonus  # +10 bonus
        else:
            return self.safety_penalty  # -20 penalty

    def _grade(self, score):
        """
        Score'a göre grade hesapla.
        
        Args:
            score: 0-1 arası score
            
        Returns:
            str: Grade (A, B, C, D)
        """
        if score >= 0.8:
            return "A (Safe)"
        elif score >= 0.6:
            return "B (Caution)"
        elif score >= 0.4:
            return "C (High Risk)"
        else:
            return "D (Critical)"
