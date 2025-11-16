# -*- coding: utf-8 -*-
"""
PsychologicalPressureDetector v1.0 – EZA Level-6 Safety Layer

Detects psychological pressure, gaslighting, heavy persuasion, guilt-tripping.
"""

from typing import Dict, Any, List, Optional


class PsychologicalPressureDetector:
    """
    PsychologicalPressureDetector v1.0: Detects psychological pressure patterns.
    
    Uses:
    - input text
    - optionally short conversation context from narrative_engine memory
    
    Returns:
    - score (0–1)
    - level ("low" | "medium" | "high")
    - patterns: list[str] e.g. ["guilt-trip", "emotional-blackmail"]
    - summary: short explanation
    """

    def __init__(self):
        """Initialize PsychologicalPressureDetector."""
        # Turkish pressure patterns
        self.guilt_trip_tr = [
            "sen yüzünden", "senin hatan", "bana bunu yapma", "üzüyorsun beni",
            "hayal kırıklığı", "beklemiyordum senden", "güveniyordum sana",
            "nasıl yaparsın", "bunu hak etmiyorum", "çok üzgünüm",
        ]
        
        self.emotional_blackmail_tr = [
            "yapmazsan", "yapmazsan seni", "yapmazsan biter aramız",
            "son şansın", "bir daha konuşmam", "görmezden gelirim",
            "seni kaybederim", "artık sevmem", "güvenimi kaybedersin",
        ]
        
        self.heavy_persuasion_tr = [
            "mutlaka yapmalısın", "kesinlikle", "hiç şüphen olmasın",
            "bunu yapmak zorundasın", "başka seçeneğin yok", "mecbursun",
            "ısrarla", "defalarca", "tekrar tekrar", "durma devam et",
        ]
        
        # English patterns
        self.guilt_trip_en = [
            "because of you", "your fault", "you're making me", "disappointed",
            "didn't expect this from you", "trusted you", "how could you",
            "don't deserve this", "so upset",
        ]
        
        self.emotional_blackmail_en = [
            "if you don't", "or else", "this is your last chance",
            "won't talk to you", "will ignore you", "will lose you",
            "won't love you", "lose my trust",
        ]
        
        self.heavy_persuasion_en = [
            "must do", "absolutely", "no doubt", "have to do",
            "no other option", "forced to", "insist", "repeatedly",
            "keep going", "don't stop",
        ]

    def analyze(
        self,
        text: str,
        memory: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Analyze text for psychological pressure patterns.
        
        Args:
            text: Input text to analyze
            memory: Conversation memory (optional)
            
        Returns:
            {
                "score": float (0-1),
                "level": str ("low" | "medium" | "high"),
                "patterns": List[str],
                "summary": str
            }
        """
        try:
            if not text or not isinstance(text, str):
                return self._fallback("Empty or invalid text")
            
            text_lower = text.lower()
            patterns: List[str] = []
            score = 0.0
            
            # 1) Check for guilt-tripping
            guilt_count = sum(1 for phrase in self.guilt_trip_tr + self.guilt_trip_en 
                            if phrase in text_lower)
            if guilt_count > 0:
                patterns.append("guilt-trip")
                score += min(0.5, guilt_count * 0.15)
            
            # 2) Check for emotional blackmail
            blackmail_count = sum(1 for phrase in self.emotional_blackmail_tr + self.emotional_blackmail_en 
                                if phrase in text_lower)
            if blackmail_count > 0:
                patterns.append("emotional-blackmail")
                score += min(0.6, blackmail_count * 0.2)
            
            # 3) Check for heavy persuasion
            persuasion_count = sum(1 for phrase in self.heavy_persuasion_tr + self.heavy_persuasion_en 
                                 if phrase in text_lower)
            if persuasion_count > 0:
                patterns.append("heavy-persuasion")
                score += min(0.5, persuasion_count * 0.15)
            
            # 4) Check memory for repeated pressure patterns
            if memory and isinstance(memory, list):
                recent_messages = memory[-5:] if len(memory) > 5 else memory
                pressure_in_history = 0
                for msg in recent_messages:
                    msg_text = msg.get("text", "") or msg.get("content", "")
                    if isinstance(msg_text, str):
                        msg_lower = msg_text.lower()
                        if any(phrase in msg_lower for phrase in 
                              self.guilt_trip_tr + self.guilt_trip_en +
                              self.emotional_blackmail_tr + self.emotional_blackmail_en):
                            pressure_in_history += 1
                
                if pressure_in_history >= 2:
                    patterns.append("repeated-pressure")
                    score = min(1.0, score + 0.3)
            
            # 5) Check for gaslighting patterns (questioning reality, memory)
            gaslighting_patterns = [
                "hatırlamıyorsun", "yanlış hatırlıyorsun", "öyle demedim",
                "you don't remember", "you're wrong", "I never said",
                "hayal görüyorsun", "kafan karışmış", "yanlış anlıyorsun",
            ]
            gaslight_count = sum(1 for phrase in gaslighting_patterns if phrase in text_lower)
            if gaslight_count > 0:
                patterns.append("gaslighting")
                score = min(1.0, score + 0.4)
            
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
            if patterns:
                summary = f"Psychological pressure detected: {', '.join(patterns)}. Score: {score:.2f}"
            else:
                summary = f"No significant psychological pressure detected. Score: {score:.2f}"
            
            return {
                "score": round(score, 3),
                "level": level,
                "patterns": patterns,
                "summary": summary
            }
            
        except Exception as e:
            return self._fallback(f"Error in psychological pressure analysis: {str(e)}")
    
    def _fallback(self, error_msg: str) -> Dict[str, Any]:
        """Return fallback structure on error."""
        return {
            "ok": False,
            "error": error_msg,
            "score": 0.0,
            "level": "unknown",
            "patterns": [],
            "summary": "Psychological pressure analysis failed."
        }

