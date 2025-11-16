# -*- coding: utf-8 -*-
"""
models/intent_engine.py – EZA-Core v10

IntentEngine v3.0: Action–Target–Purpose model + weighted risk matrix.

Detects: illegal, violence, self-harm, manipulation, sensitive-data, toxicity.
"""

import re
from typing import Dict, List, Any, Tuple
from .utils import tokenize, normalize_text, contains_phrase, regex_match


class IntentEngine:
    """
    IntentEngine v3.0: Multi-layer intent detection with weighted scoring.
    """
    
    def __init__(self):
        """Initialize IntentEngine with dictionaries."""
        self._load_dictionaries()
    
    def _load_dictionaries(self):
        """Load action, target, and purpose dictionaries."""
        
        # Action verbs by category
        self.action_verbs = {
            "violence": [
                "döv", "dövmek", "döverim", "döver",
                "vur", "vurmak", "vururum",
                "bıçakla", "bıçaklamak",
                "yarala", "yaralamak",
                "öldür", "öldürmek", "öldürürüm",
                "saldır", "saldırmak", "saldırırım",
            ],
            "illegal": [
                "çal", "çalmak", "hack", "hackle", "hacklemek",
                "kır", "kırmak", "kırarım", "kirar",
                "kopyala", "kopyalamak",
                "dolandır", "dolandırmak",
            ],
            "manipulation": [
                "kandır", "kandırmak", "kandir", "kandirmak",
                "yönlendir", "yönlendirmek",
                "ikna etmek", "manipüle", "manipüle etmek",
                "etkilemek", "gizlice etkilemek",
            ],
            "self_harm": [
                "kendimi öldürmek", "intihar etmek",
                "kendime zarar vermek", "hayatıma son vermek",
                "ölmek istiyorum", "yaşamak istemiyorum",
            ],
        }
        
        # Target words
        self.target_words = {
            "self": ["kendimi", "kendime", "kendim"],
            "other_person": ["birini", "birine", "onu", "arkadaşımı", "arkadasimi"],
            "system": ["wifi", "wi-fi", "modem", "banka", "sistem", "hesap"],
            "identity": ["tc kimlik", "kimlik numarası", "şifre", "sifre", "iban"],
        }
        
        # Purpose clues
        self.purpose_clues = {
            "harm": ["zarar vermek", "acı çektirmek", "kötü", "mahvet"],
            "hidden": ["gizlice", "belli etmeden", "haberi olmadan", "çaktırmadan"],
            "learning": ["öğrenmek istiyorum", "bilmek istiyorum", "merak ediyorum"],
        }
        
        # Risk keywords (flat lists)
        self.risk_keywords = {
            "self-harm": [
                "intihar", "intihar etmek", "kendimi öldürmek",
                "kendime zarar vermek", "ölmek istiyorum",
                "yaşamak istemiyorum", "hayatıma son vermek",
            ],
            "violence": [
                "öldürmek", "öldürürüm", "saldırmak", "saldırırım",
                "döv", "döverim", "dövmek", "vurmak", "bıçaklamak",
                "birine zarar vermek", "birini öldürmek istiyorum",
            ],
            "illegal": [
                "hack", "hacklemek", "wifi şifresi kırmak",
                "hesap hack", "kimlik çalmak", "tc çalmak",
                "bomba yapmak", "uyuşturucu satmak",
            ],
            "manipulation": [
                "kandırmak", "kandır", "manipüle etmek",
                "etkilemek", "yönlendirmek", "ikna etmek",
                "gizlice etkilemek", "gaslighting",
            ],
            "sensitive-data": [
                "tc kimlik", "kimlik numarası", "telefon numarası",
                "iban", "kredi kartı", "şifre", "pasaport",
            ],
            "toxicity": [
                "aptal", "salak", "gerizekalı", "şerefsiz",
                "nefret ediyorum", "ırkçı", "aşağılama",
            ],
        }
        
        # Weights for scoring
        self.weights = {
            "action": 0.4,
            "target": 0.3,
            "purpose": 0.3,
        }
    
    def detect_action_phrases(self, text: str) -> Dict[str, List[str]]:
        """Detect action phrases in text."""
        text_norm = normalize_text(text)
        hits = {}
        
        for category, verbs in self.action_verbs.items():
            matches = contains_phrase(text_norm, verbs)
            if matches:
                hits[category] = matches
        
        return hits
    
    def detect_targets(self, text: str) -> Dict[str, List[str]]:
        """Detect target words in text."""
        text_norm = normalize_text(text)
        hits = {}
        
        for category, words in self.target_words.items():
            matches = contains_phrase(text_norm, words)
            if matches:
                hits[category] = matches
        
        return hits
    
    def detect_purpose_words(self, text: str) -> Dict[str, List[str]]:
        """Detect purpose clues in text."""
        text_norm = normalize_text(text)
        hits = {}
        
        for category, clues in self.purpose_clues.items():
            matches = contains_phrase(text_norm, clues)
            if matches:
                hits[category] = matches
        
        return hits
    
    def compute_intent_scores(self, text: str) -> Dict[str, float]:
        """
        Compute weighted intent scores.
        Returns dict with scores for each intent category.
        """
        scores = {
            "illegal": 0.0,
            "violence": 0.0,
            "self-harm": 0.0,
            "manipulation": 0.0,
            "sensitive-data": 0.0,
            "toxicity": 0.0,
            "information": 0.1,  # Default
        }
        
        text_norm = normalize_text(text)
        
        # Get hits
        action_hits = self.detect_action_phrases(text_norm)
        target_hits = self.detect_targets(text_norm)
        purpose_hits = self.detect_purpose_words(text_norm)
        
        # Self-harm: highest priority
        if any(keyword in text_norm for keyword in self.risk_keywords["self-harm"]):
            scores["self-harm"] = 1.0
        
        # Violence: action + target boost
        if "violence" in action_hits:
            scores["violence"] = 0.9
            if "other_person" in target_hits:
                scores["violence"] = 0.95
        elif any(keyword in text_norm for keyword in self.risk_keywords["violence"]):
            scores["violence"] = 0.9
        
        # Illegal: action + system target
        if "illegal" in action_hits:
            scores["illegal"] = 0.85
            if "system" in target_hits:
                scores["illegal"] = 0.95
        elif any(keyword in text_norm for keyword in self.risk_keywords["illegal"]):
            scores["illegal"] = 0.85
        
        # Manipulation: action + target + hidden purpose
        if "manipulation" in action_hits:
            scores["manipulation"] = 0.75
            if "other_person" in target_hits:
                scores["manipulation"] = 0.85
            if "hidden" in purpose_hits:
                scores["manipulation"] = 0.9
        elif any(keyword in text_norm for keyword in self.risk_keywords["manipulation"]):
            scores["manipulation"] = 0.75
        
        # Sensitive-data: keywords
        if any(keyword in text_norm for keyword in self.risk_keywords["sensitive-data"]):
            scores["sensitive-data"] = 0.7
        
        # Toxicity: explicit insults
        if any(keyword in text_norm for keyword in self.risk_keywords["toxicity"]):
            scores["toxicity"] = 0.65
        
        # Normalize scores
        for key in scores:
            scores[key] = min(scores[key], 1.0)
        
        return scores
    
    def analyze(self, text: str) -> Dict[str, Any]:
        """
        Main analysis function.
        Returns comprehensive intent analysis.
        """
        if not text or not text.strip():
            return {
                "primary": "information",
                "secondary": [],
                "intent_scores": {},
                "risk_score": 0.0,
                "risk_level": "low",
            }
        
        # Compute intent scores
        intent_scores = self.compute_intent_scores(text)
        
        # Determine primary intent
        primary = max(intent_scores, key=intent_scores.get)
        primary_score = intent_scores[primary]
        
        # Determine secondary intents (score >= 0.4)
        secondary = [
            intent for intent, score in intent_scores.items()
            if intent != primary and score >= 0.4
        ]
        
        # Calculate risk score and level
        risk_score = primary_score
        if risk_score >= 0.9:
            risk_level = "critical"
        elif risk_score >= 0.7:
            risk_level = "high"
        elif risk_score >= 0.4:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        return {
            "primary": primary,
            "secondary": secondary,
            "intent_scores": intent_scores,
            "risk_score": risk_score,
            "risk_level": risk_level,
        }

