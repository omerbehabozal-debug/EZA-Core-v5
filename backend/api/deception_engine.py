# -*- coding: utf-8 -*-
"""
DeceptionEngine v1.0 – EZA Level-6 Safety Layer

Detects deception, hidden intention, and "ben sadece soruyorum" style false innocence.
"""

from typing import Dict, Any, List, Optional


class DeceptionEngine:
    """
    DeceptionEngine v1.0: Detects deception, hidden intention, and false innocence.
    
    Uses:
    - input text
    - existing report fields (intent_engine, reasoning_shield, narrative, drift, identity_block, output)
    
    Returns:
    - score (0–1)
    - level ("low" | "medium" | "high")
    - flags: list[str] e.g. ["hidden-agenda", "disguised-illegal-intent"]
    - summary: short human-readable explanation in English
    """

    def __init__(self):
        """Initialize DeceptionEngine."""
        # Turkish phrases indicating deception or false innocence
        self.deception_phrases = [
            "belli etmeden", "çaktırmadan", "sadece meraktan", "teorik olarak",
            "sadece soruyorum", "merak ettim", "sadece öğrenmek istiyorum",
            "hipotetik olarak", "farz edelim", "diyelim ki", "varsayalım",
            "gizlice", "haberi olmadan", "fark ettirmeden", "sessizce",
            "belli etme", "çaktırma", "kimse bilmesin", "gizli tut",
            "sadece benim için", "kimseye söyleme", "arada kal",
        ]
        
        # English phrases
        self.deception_phrases_en = [
            "just asking", "hypothetically", "theoretically", "just curious",
            "don't tell anyone", "keep it secret", "between us",
            "just wondering", "what if", "suppose", "imagine",
            "without them knowing", "behind their back", "on the sly",
        ]

    def analyze(
        self,
        text: str,
        report: Optional[Dict[str, Any]] = None,
        memory: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Analyze text and report for deception indicators.
        
        Args:
            text: Input text to analyze
            report: Existing report dict (optional)
            memory: Conversation memory (optional)
            
        Returns:
            {
                "score": float (0-1),
                "level": str ("low" | "medium" | "high"),
                "flags": List[str],
                "summary": str
            }
        """
        try:
            if not text or not isinstance(text, str):
                return self._fallback("Empty or invalid text")
            
            text_lower = text.lower()
            flags: List[str] = []
            score = 0.0
            
            # 1) Check for deception phrases
            deception_count = 0
            for phrase in self.deception_phrases + self.deception_phrases_en:
                if phrase in text_lower:
                    deception_count += 1
                    if "hidden-agenda" not in flags:
                        flags.append("hidden-agenda")
            
            if deception_count > 0:
                score += min(0.6, deception_count * 0.2)
            
            # 2) Check intent vs wording conflict
            if report:
                intent_engine = report.get("intent_engine", {})
                reasoning_shield = report.get("reasoning_shield", {})
                
                # If intent suggests risk but wording is innocent
                primary_intent = intent_engine.get("primary", "")
                risk_score = intent_engine.get("risk_score", 0.0)
                
                # Check for conflict: high risk intent but innocent wording
                innocent_words = ["sadece", "just", "merak", "curious", "teorik", "theoretical"]
                has_innocent_wording = any(word in text_lower for word in innocent_words)
                
                if risk_score > 0.5 and has_innocent_wording:
                    score = max(score, 0.7)
                    if "disguised-illegal-intent" not in flags:
                        flags.append("disguised-illegal-intent")
                
                # Check reasoning shield for deception patterns
                if reasoning_shield:
                    shield_issues = reasoning_shield.get("issues", [])
                    if any("deception" in str(issue).lower() for issue in shield_issues):
                        score = max(score, 0.6)
                        if "reasoning-deception" not in flags:
                            flags.append("reasoning-deception")
            
            # 3) Check narrative for hidden agenda
            if report:
                narrative = report.get("narrative", {})
                if narrative and isinstance(narrative, dict):
                    signals = narrative.get("signals", {})
                    if signals.get("hidden_agenda"):
                        score = max(score, 0.65)
                        if "narrative-hidden-agenda" not in flags:
                            flags.append("narrative-hidden-agenda")
            
            # 4) Check drift for sudden intent change (could indicate deception)
            if report:
                drift = report.get("drift_matrix", {})
                if drift and isinstance(drift, dict):
                    trend = drift.get("trend", "")
                    if trend == "increasing-risk" and score > 0.3:
                        score = min(1.0, score + 0.15)
            
            # Normalize score to 0-1
            score = min(1.0, max(0.0, score))
            
            # Determine level
            if score >= 0.7:
                level = "high"
            elif score >= 0.4:
                level = "medium"
            else:
                level = "low"
            
            # Generate summary
            if flags:
                summary = f"Deception detected: {', '.join(flags)}. Score: {score:.2f}"
            else:
                summary = f"No significant deception indicators found. Score: {score:.2f}"
            
            return {
                "score": round(score, 3),
                "level": level,
                "flags": flags,
                "summary": summary
            }
            
        except Exception as e:
            return self._fallback(f"Error in deception analysis: {str(e)}")
    
    def _fallback(self, error_msg: str) -> Dict[str, Any]:
        """Return fallback structure on error."""
        return {
            "ok": False,
            "error": error_msg,
            "score": 0.0,
            "level": "unknown",
            "flags": [],
            "summary": "Deception analysis failed."
        }

