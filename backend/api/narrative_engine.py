# -*- coding: utf-8 -*-
"""
narrative_engine.py – EZA-Core v4.0

NarrativeEngine v4.0: Tracks long conversation context, intent drift,
manipulation development, and risk evolution.
"""

from collections import deque
import re
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta


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
        # EZA-NarrativeEngine v2.2: Extended history for detailed analysis
        self.history: List[Dict[str, Any]] = []
        self.max_history = 25
    
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
    
    def add(
        self,
        text: str,
        intent: Dict[str, Any],
        identity: Dict[str, Any],
        reasoning: Dict[str, Any],
    ):
        """
        EZA-NarrativeEngine v2.2: Add analysis results to history.
        
        Args:
            text: User message text
            intent: Intent engine results
            identity: IdentityBlock results
            reasoning: ReasoningShield results
        """
        entry = {
            "text": text,
            "intent": intent,
            "identity": identity,
            "reasoning": reasoning,
            "timestamp": datetime.utcnow(),
        }
        self.history.append(entry)

        # Hafıza aşarsa
        if len(self.history) > self.max_history:
            self.history.pop(0)

    def analyze_narrative(self, current_text: str) -> Dict[str, Any]:
        """
        EZA-NarrativeEngine v2.2: Analyze long conversation context.
        
        Uzun konuşmalarda bağlam, niyet, risk birikimi,
        gizli amaç değişimi ve senaryo zincirlerini tespit eder.
        
        Args:
            current_text: Current message text (for future use)
            
        Returns:
            {
                "ok": True,
                "risk_score": float,
                "risk_level": str,
                "summary": str,
                "signals": Dict[str, Any],
            }
        """
        if not self.history:
            return {
                "ok": True,
                "risk_score": 0.0,
                "risk_level": "low",
                "summary": "No narrative context yet.",
                "signals": {},
            }

        last_items = self.history[-5:]  # son 5 mesaj üzerinden hesapla

        # 1) Risk birikimi
        risk_values = []
        for item in last_items:
            intent_score = item["intent"].get("risk_score", 0.0) if isinstance(item["intent"], dict) else 0.0
            identity_score = item["identity"].get("risk_score", 0.0) if isinstance(item["identity"], dict) else 0.0
            reasoning_score = item["reasoning"].get("risk_score", 0.0) if isinstance(item["reasoning"], dict) else 0.0
            total = max(intent_score, identity_score, reasoning_score)
            risk_values.append(total)

        rolling_risk = sum(risk_values) / len(risk_values) if risk_values else 0.0

        # 2) Niyet kayması (intent drift)
        intents = []
        for item in last_items:
            intent_data = item["intent"]
            if isinstance(intent_data, dict):
                primary = intent_data.get("primary")
                if primary:
                    intents.append(primary)
        
        drift = len(set(intents)) > 3 if intents else False  # çok farklı niyet birikirse

        # 3) Gizli senaryo
        hidden_agenda = False
        for item in last_items:
            intent_data = item["intent"]
            if isinstance(intent_data, dict):
                secondary = intent_data.get("secondary", [])
                if isinstance(secondary, list):
                    if any("hidden" in str(s).lower() for s in secondary):
                        hidden_agenda = True
                        break

        # 4) Pattern tekrarları
        repeated_illegal = 0
        repeated_manip = 0
        repeated_identity = 0
        
        for item in last_items:
            intent_data = item["intent"]
            if isinstance(intent_data, dict):
                primary = intent_data.get("primary")
                if primary == "illegal":
                    repeated_illegal += 1
                elif primary == "manipulation":
                    repeated_manip += 1
            
            identity_data = item["identity"]
            if isinstance(identity_data, dict):
                risk_flags = identity_data.get("risk_flags", [])
                if isinstance(risk_flags, list) and "personal-data" in risk_flags:
                    repeated_identity += 1

        escalation = (repeated_illegal >= 2) or (repeated_manip >= 2) or (repeated_identity >= 2)

        # Genel risk hesaplaması
        base_score = rolling_risk
        if drift:
            base_score += 0.15
        if hidden_agenda:
            base_score += 0.15
        if escalation:
            base_score += 0.2

        risk_score = min(1.0, base_score)

        if risk_score >= 0.85:
            risk_level = "critical"
        elif risk_score >= 0.6:
            risk_level = "high"
        elif risk_score >= 0.3:
            risk_level = "medium"
        else:
            risk_level = "low"

        return {
            "ok": True,
            "risk_score": round(risk_score, 4),
            "risk_level": risk_level,
            "summary": "NarrativeEngine v2.2 – long-context behavioural analysis completed.",
            "signals": {
                "rolling_risk": round(rolling_risk, 4),
                "intent_drift": drift,
                "hidden_agenda": hidden_agenda,
                "escalation": escalation,
                "recent_intents": intents,
            },
        }

    def analyze(self, text: str) -> Dict[str, Any]:
        """
        EZA NarrativeEngine v3.0: Analyze single text for context patterns,
        hidden intent, and indirect risks in multi-sentence content.
        
        This method analyzes the context within a single text (can be multi-sentence),
        detecting hidden manipulation, aggressive context, and indirect risks.
        
        Args:
            text: Text to analyze (can be multi-sentence/paragraph)
            
        Returns:
            {
                "ok": True,
                "risk_flags": List[str],
                "risk_score": float,
                "risk_level": str,
                "hits": Dict[str, List[str]],
                "summary": str
            }
        """
        # Örtülü manipülasyon tetikleyicileri
        hidden_intent_keywords = [
            "belli etmeden", "haberi olmadan", "fark etmeden",
            "anlamasın", "anlamadan", "gizlice", "çaktırmadan", "hissettirmeden",
            "fark ettirmeden", "gizli", "sessizce", "habersizce",
            "kimse anlamadan", "kimse fark etmeden", "kimse bilmeden",
        ]
        
        # Niyet yükselten bağlam kelimeleri
        aggressive_context = [
            "zorla", "mecbur bırak", "kontrol et", "ne olursa olsun",
            "istediğim gibi", "benim dediğim olsun", "mecbur et",
            "baskı yap", "tehdit et", "zorunda bırak",
        ]
        
        # Çok cümleli analiz için bağlam desenleri
        manipulation_patterns = [
            r".*etkile.*", r".*yönlendir.*", r".*ikna.*",
            r".*kandır.*", r".*manipüle.*", r".*etkilemek.*",
        ]
        
        text_lower = text.lower()
        
        flags = []
        hits = {
            "hidden_intent": [],
            "aggressive_context": [],
            "manipulation": []
        }
        
        # Gizli manipülasyon tespiti
        for k in hidden_intent_keywords:
            if k in text_lower:
                if "hidden-intent" not in flags:
                    flags.append("hidden-intent")
                hits["hidden_intent"].append(k)
        
        # Bağlam agresifleşmesi
        for k in aggressive_context:
            if k in text_lower:
                if "aggressive-context" not in flags:
                    flags.append("aggressive-context")
                hits["aggressive_context"].append(k)
        
        # Manipülasyon patern tespiti
        for p in manipulation_patterns:
            if re.search(p, text_lower):
                if "manipulation-context" not in flags:
                    flags.append("manipulation-context")
                hits["manipulation"].append(p)
        
        # Risk skoru hesaplama
        # Her flag için ağırlıklandırılmış puanlama
        risk_weights = {
            "hidden-intent": 0.3,
            "aggressive-context": 0.4,
            "manipulation-context": 0.35,
        }
        
        score = 0.0
        for flag in set(flags):  # Unique flags
            score += risk_weights.get(flag, 0.2)
        
        # Cap at 1.0
        score = min(1.0, score)
        
        # Risk level determination
        if score >= 0.75:
            risk_level = "critical"
        elif score >= 0.4:
            risk_level = "high"
        elif score >= 0.2:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        return {
            "ok": True,
            "risk_flags": list(set(flags)),  # Unique flags
            "risk_score": round(score, 4),
            "risk_level": risk_level,
            "hits": hits,
            "summary": "NarrativeEngine v3.0 context analysis complete.",
        }

