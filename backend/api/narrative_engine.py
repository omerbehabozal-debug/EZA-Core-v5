# -*- coding: utf-8 -*-
"""
narrative_engine.py – EZA-Core v4.0

NarrativeEngine v4.0: Tracks long conversation context, intent drift,
manipulation development, and risk evolution.
"""

from collections import deque
import re
from typing import Dict, List, Any


class NarrativeEngine:
    """
    NarrativeEngine v4.0: Conversation context and risk tracking.
    
    Features:
    - Context Memory: Stores last 5-10 conversations
    - Intent Drift Detection: Measures intent shift over time
    - Risk Escalation Tracking: Tracks risk level fluctuations
    - Conversation Pattern Detection: Detects communication strategies
    """
    
    def __init__(self, max_memory: int = 10):
        """
        Initialize NarrativeEngine.
        
        Args:
            max_memory: Maximum number of messages to store in memory
        """
        self.memory = deque(maxlen=max_memory)
    
    def add_message(self, role: str, text: str):
        """
        Add a message to conversation memory.
        
        Args:
            role: Message role ("user" or "assistant")
            text: Message text
        """
        self.memory.append({"role": role, "text": text})
    
    def analyze_flow(self) -> Dict[str, Any]:
        """
        Analyze conversation flow for patterns and risks.
        
        Returns:
            {
                "ok": True,
                "narrative_score": float,
                "patterns": List[str],
                "drift": float,
                "summary": str
            }
        """
        if not self.memory:
            return {
                "ok": True,
                "narrative_score": 0.0,
                "patterns": [],
                "drift": 0.0,
                "summary": "No conversation history",
            }
        
        # Niyet kayması hesaplama
        drift = self._calculate_intent_drift()
        
        # Pattern tespiti
        patterns = self._detect_patterns()
        
        # Risk skoru
        risk = min(1.0, drift + len(patterns) * 0.15)
        
        return {
            "ok": True,
            "narrative_score": round(risk, 4),
            "patterns": patterns,
            "drift": round(drift, 4),
            "summary": f"Narrative flow analyzed (score={risk:.2f}, drift={drift:.2f})",
        }
    
    def _calculate_intent_drift(self) -> float:
        """
        Calculate intent drift over conversation.
        Returns difference between first and last intent values.
        """
        scores = []
        for m in self.memory:
            s = self._extract_intent_value(m["text"])
            scores.append(s)
        
        if not scores or len(scores) < 2:
            return 0.0
        
        # İlk niyet – son niyet farkı
        drift = max(0.0, min(1.0, scores[-1] - scores[0]))
        return drift
    
    def _extract_intent_value(self, text: str) -> float:
        """
        Extract intent risk value from text.
        
        Args:
            text: Text to analyze
            
        Returns:
            Intent risk value (0.0 - 1.0)
        """
        # Basit risk ağırlıkları
        risk_words = {
            "şiddet": 0.9,
            "döverim": 0.9,
            "öldür": 1.0,
            "hack": 0.9,
            "şifre": 0.6,
            "manipüle": 0.8,
            "yönlendireyim": 0.85,
            "çıkar": 0.75,
            "kandır": 0.8,
            "kandırmak": 0.8,
            "tc kimlik": 0.9,
            "kimlik numarası": 0.9,
            "intihar": 1.0,
            "kendimi öldürmek": 1.0,
        }
        
        text_lower = text.lower()
        val = 0.0
        
        for word, score in risk_words.items():
            if word in text_lower:
                val = max(val, score)
        
        return val
    
    def _detect_patterns(self) -> List[str]:
        """
        Detect conversation patterns.
        
        Returns:
            List of detected pattern names
        """
        patterns = []
        
        if not self.memory:
            return patterns
        
        # Dolaylı manipülasyon
        if any("belli etmeden" in m["text"].lower() for m in self.memory):
            patterns.append("hidden-manipulation")
        
        if any("gizlice" in m["text"].lower() for m in self.memory):
            patterns.append("hidden-manipulation")
        
        if any("çaktırmadan" in m["text"].lower() for m in self.memory):
            patterns.append("hidden-manipulation")
        
        # Aşamalı risk artışı (escalation)
        if len(self.memory) >= 3:
            t = [self._extract_intent_value(m["text"]) for m in self.memory]
            if t[-1] > t[0] and t[-1] - t[0] > 0.5:
                patterns.append("escalation")
        
        # Probing (sistemi test etme)
        probe_words = [
            "test", "sınama", "nasıl anlarsın", "algılar mı",
            "fark eder misin", "anlar mısın", "tespit eder misin",
        ]
        if any(any(p in m["text"].lower() for p in probe_words) for m in self.memory):
            patterns.append("probing")
        
        # Bilgi toplama (information gathering)
        info_gathering_words = [
            "nasıl yapılır", "nasıl öğrenirim", "nereden bulurum",
            "hangi yöntem", "ne yapmalıyım",
        ]
        info_count = sum(
            1 for m in self.memory
            if any(word in m["text"].lower() for word in info_gathering_words)
        )
        if info_count >= 2:
            patterns.append("information-gathering")
        
        # Dolaylı şiddet hazırlığı
        indirect_violence_words = [
            "birine ders vermek", "birini korkutmak", "birini tehdit",
            "birine zarar", "intikam",
        ]
        if any(
            any(word in m["text"].lower() for word in indirect_violence_words)
            for m in self.memory
        ):
            patterns.append("indirect-violence-preparation")
        
        return patterns
    
    def reset(self):
        """Reset conversation memory."""
        self.memory.clear()
    
    def get_memory_size(self) -> int:
        """Get current memory size."""
        return len(self.memory)

