# -*- coding: utf-8 -*-
"""
models/reasoning_shield.py – EZA-Core v10

ReasoningShield v5.0: Detects manipulative logic, misleading scenarios,
psychological forcing, social engineering, disguised illegal intent.
"""

import re
from typing import Dict, List, Any
from .utils import normalize_text, contains_phrase, regex_match


class ReasoningShield:
    """
    ReasoningShield v5.0: Advanced reasoning pattern detection.
    """
    
    def __init__(self):
        """Initialize ReasoningShield with manipulative patterns."""
        self._load_patterns()
    
    def _load_patterns(self):
        """Load manipulative reasoning patterns."""
        
        # Manipulative logic patterns
        self.manipulative_patterns = [
            r"eğer.*yapmazsan.*olur",
            r"herkes.*yapıyor",
            r"sen.*yapmazsan.*başkası.*yapar",
            r"bunu.*yapmazsan.*kaybedersin",
            r"sadece.*bir.*kez",
            r"kimse.*anlamaz",
            r"bunu.*yap.*sonra.*söylerim",
            r"güven.*bana",
            r"bunu.*yap.*çünkü.*ben.*diyorum",
        ]
        
        # Psychological forcing patterns
        self.forcing_patterns = [
            r"yapmak.*zorundasın",
            r"yapmalısın.*yoksa",
            r"eğer.*sevmiyorsan.*yap",
            r"gerçek.*arkadaş.*olsaydın.*yapardın",
            r"bunu.*yapmazsan.*seni.*terk.*ederim",
            r"bunu.*yap.*yoksa.*kızarım",
        ]
        
        # Social engineering patterns
        self.social_engineering_patterns = [
            r"ben.*senin.*için.*yaptım",
            r"sen.*benim.*için.*yap",
            r"arkadaş.*olsaydık.*yapardın",
            r"bunu.*yap.*sonra.*ödüllendiririm",
            r"bunu.*yap.*gizli.*kalacak",
            r"bunu.*yap.*kimse.*bilmez",
        ]
        
        # Disguised illegal intent patterns
        self.disguised_illegal_patterns = [
            r"masum.*soru",
            r"sadece.*merak.*ediyorum",
            r"öğrenmek.*istiyorum",
            r"nasıl.*yapılır.*sadece.*bilgi",
            r"teorik.*olarak",
            r"hipotetik.*olarak",
        ]
        
        # Indirect violence patterns
        self.indirect_violence_patterns = [
            r"birine.*ders.*vermek",
            r"birini.*korkutmak",
            r"birini.*tehdit.*etmek",
            r"birine.*zarar.*vermesi.*için",
            r"birini.*cezalandırmak",
        ]
        
        # Hidden agenda patterns
        self.hidden_agenda_patterns = [
            r"aslında.*amaç",
            r"gerçek.*niyet",
            r"asıl.*istiyorum",
            r"aslında.*yapmak.*istiyorum",
            r"gizli.*plan",
        ]
        
        # Cause-effect distortion patterns
        self.cause_effect_patterns = [
            r"eğer.*yapmazsan.*her.*şey.*mahvolur",
            r"bunu.*yap.*her.*şey.*düzelecek",
            r"tek.*çözüm.*bu",
            r"başka.*yolu.*yok",
        ]
    
    def detect_manipulative_logic(self, text: str) -> List[str]:
        """Detect manipulative logic patterns."""
        return regex_match(text, self.manipulative_patterns)
    
    def detect_psychological_forcing(self, text: str) -> List[str]:
        """Detect psychological forcing patterns."""
        return regex_match(text, self.forcing_patterns)
    
    def detect_social_engineering(self, text: str) -> List[str]:
        """Detect social engineering patterns."""
        return regex_match(text, self.social_engineering_patterns)
    
    def detect_disguised_illegal(self, text: str) -> List[str]:
        """Detect disguised illegal intent patterns."""
        return regex_match(text, self.disguised_illegal_patterns)
    
    def detect_indirect_violence(self, text: str) -> List[str]:
        """Detect indirect violence patterns."""
        return regex_match(text, self.indirect_violence_patterns)
    
    def detect_hidden_agenda(self, text: str) -> List[str]:
        """Detect hidden agenda patterns."""
        return regex_match(text, self.hidden_agenda_patterns)
    
    def detect_cause_effect_distortion(self, text: str) -> List[str]:
        """Detect cause-effect distortion patterns."""
        return regex_match(text, self.cause_effect_patterns)
    
    def detect_friend_implies_self(self, text: str) -> bool:
        """
        Detect "friend-implies-self" recognition.
        Example: "arkadaşım için" → actually for self
        """
        text_norm = normalize_text(text)
        friend_patterns = [
            r"arkadaşım.*için",
            r"bir.*arkadaş.*için",
            r"tanıdığım.*biri.*için",
        ]
        return any(re.search(p, text_norm, re.IGNORECASE) for p in friend_patterns)
    
    def detect_hypothetical_abuse(self, text: str) -> bool:
        """
        Detect hypothetical scenario abuse.
        Example: "hypothetically, how would I..."
        """
        text_norm = normalize_text(text)
        hypothetical_keywords = [
            "hipotetik", "teorik", "varsayalım", "farz edelim",
            "diyelim ki", "sadece merak", "sadece bilgi",
        ]
        return any(kw in text_norm for kw in hypothetical_keywords)
    
    def analyze(self, text: str) -> Dict[str, Any]:
        """
        Main analysis function.
        Returns reasoning risk analysis.
        """
        if not text or not text.strip():
            return {
                "reasoning_risk": 0.0,
                "risk_level": "low",
                "detected_patterns": {},
            }
        
        text_norm = normalize_text(text)
        
        # Detect all patterns
        manipulative = self.detect_manipulative_logic(text_norm)
        forcing = self.detect_psychological_forcing(text_norm)
        social_eng = self.detect_social_engineering(text_norm)
        disguised = self.detect_disguised_illegal(text_norm)
        indirect_violence = self.detect_indirect_violence(text_norm)
        hidden_agenda = self.detect_hidden_agenda(text_norm)
        cause_effect = self.detect_cause_effect_distortion(text_norm)
        friend_self = self.detect_friend_implies_self(text_norm)
        hypothetical = self.detect_hypothetical_abuse(text_norm)
        
        # Calculate reasoning risk score
        reasoning_risk = 0.0
        
        # Weight different patterns
        reasoning_risk += len(manipulative) * 0.15
        reasoning_risk += len(forcing) * 0.20
        reasoning_risk += len(social_eng) * 0.18
        reasoning_risk += len(disguised) * 0.25
        reasoning_risk += len(indirect_violence) * 0.30
        reasoning_risk += len(hidden_agenda) * 0.22
        reasoning_risk += len(cause_effect) * 0.15
        
        if friend_self:
            reasoning_risk += 0.20
        if hypothetical:
            reasoning_risk += 0.15
        
        # Cap at 1.0
        reasoning_risk = min(reasoning_risk, 1.0)
        
        # Determine risk level
        if reasoning_risk >= 0.9:
            risk_level = "critical"
        elif reasoning_risk >= 0.7:
            risk_level = "high"
        elif reasoning_risk >= 0.4:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        return {
            "reasoning_risk": round(reasoning_risk, 4),
            "risk_level": risk_level,
            "detected_patterns": {
                "manipulative_logic": manipulative,
                "psychological_forcing": forcing,
                "social_engineering": social_eng,
                "disguised_illegal": disguised,
                "indirect_violence": indirect_violence,
                "hidden_agenda": hidden_agenda,
                "cause_effect_distortion": cause_effect,
                "friend_implies_self": friend_self,
                "hypothetical_abuse": hypothetical,
            },
        }

