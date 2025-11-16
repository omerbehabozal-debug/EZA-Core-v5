# -*- coding: utf-8 -*-
"""
input_analyzer.py – EZA-Core v10 + EZA-IntentEngine v3.0

Fully level-3 professional analysis system with modular Intent Engine:
- EZA-IntentEngine v3.0 (Action–Target–Purpose grid)
- Per-intent scores and confidence
- Risk fusion (score → level)
- Level-3 patches: Violence, Manipulation, Wifi-Illegal, Toxicity Fix
"""

from typing import Any, Dict, List, Tuple
import re

from backend.intent_engine import analyze_intent as intent_engine_analyze
from backend.intent_engine.lexicon import SENSITIVE_DATA_SIGNALS
from backend.intent_engine.features import extract_semantic_features
from backend.intent_engine.dictionaries import (
    illegal_actions,
    violence_actions,
    manipulation_actions,
    sensitive_data_signals,
    toxicity_signals,
)
from backend.risk_engine import compute_risk_and_alignment
from backend.api.reasoning_shield import analyze_reasoning_patterns
from backend.api.identity_block import analyze_identity_risk
from data_store.event_logger import log_event


# Intent engine handles all lexicon and scoring internally


def detect_language(text: str) -> str:
    """
    Enhanced language detector for Turkish.
    Checks Turkish-specific characters and stopwords.
    """
    t = text.lower()
    
    # Check for Turkish-specific characters
    turkish_chars = ["ğ", "ü", "ş", "ö", "ç", "ı", "İ", "Ğ", "Ü", "Ş", "Ö", "Ç"]
    if any(char in text for char in turkish_chars):
        return "tr"
    
    # Check for Turkish stopwords
    turkish_stopwords = [
        "birini", "nasıl", "nasil", "arkadaş", "kandır", "döver",
        "şifre", "sifre", "birine", "kandırmak", "kandir", "arkadaşımı",
        "kararlarını", "etkilemek", "istiyorum", "kırarım", "kirar"
    ]
    if any(stopword in t for stopword in turkish_stopwords):
        return "tr"
    
    # Fallback to English
    if re.search(r"[a-z]", t):
        return "en"
    
    return "unknown"


def detect_emotional_tone(text: str) -> str:
    """
    Simple emotional tone detection.
    """
    t = text.lower()
    if any(w in t for w in ["korkuyorum", "endişeliyim", "kaygılı"]):
        return "anxious"
    if any(w in t for w in ["üzgünüm", "mutsuzum", "yalnızım"]):
        return "sad"
    if any(w in t for w in ["sinirliyim", "öfkeliyim"]):
        return "angry"
    if any(w in t for w in ["mutluyum", "harika"]):
        return "positive"
    return "neutral"


def calculate_intent_scores(text: str) -> Tuple[Dict[str, float], Dict[str, List[str]]]:
    """
    EZA-IntentEngine v4.0: Weighted Multi-Feature Scoring
    
    Calculates intent scores using:
    - ACTION layer (illegal, violence, manipulation actions)
    - TARGET layer (self, others, relational targets)
    - PURPOSE layer (harm indicators)
    - STEALTH/HIDDEN layer (stealth intent signals)
    - MODAL strength multiplier (intent strength)
    
    Returns:
        (intent_scores: Dict[str, float], feature_metadata: Dict[str, List[str]])
    """
    f = extract_semantic_features(text)
    text_low = text.lower()
    
    scores: Dict[str, float] = {
        "illegal": 0.0,
        "violence": 0.0,
        "self-harm": 0.0,
        "manipulation": 0.0,
        "sensitive-data": 0.0,
        "toxicity": 0.0,
        "information": 0.1,
    }
    
    # ACTION layer
    for tok in illegal_actions:
        if tok in text_low:
            scores["illegal"] += 0.4
    
    for tok in violence_actions:
        if tok in text_low:
            scores["violence"] += 0.45
    
    for tok in manipulation_actions:
        if tok in text_low:
            scores["manipulation"] += 0.50
    
    # TARGET layer
    if f["target_hits"]:
        if "kendimi" in f["target_hits"] or "kendime" in f["target_hits"]:
            scores["self-harm"] += 0.6
        if any(t in f["target_hits"] for t in ["birini", "öğretmenim", "arkadaşım", "patronum", "sevgilim", "eşim"]):
            scores["manipulation"] += 0.3
            scores["sensitive-data"] += 0.3
    
    # PURPOSE layer
    if f["harm_hits"]:
        scores["violence"] += 0.5
        scores["self-harm"] += 0.4
    
    # STEALTH/HIDDEN layer
    if f["stealth_hits"]:
        scores["manipulation"] += 0.6
        scores["illegal"] += 0.2
    
    # Sensitive data detection (from Mega Patch v1.0)
    for sig in sensitive_data_signals:
        if sig in text_low:
            scores["sensitive-data"] += 0.4
    
    # Toxicity detection
    for sig in toxicity_signals:
        if sig in text_low:
            scores["toxicity"] += 0.3
    
    # MODAL strength multiplier
    multiplier = 1.0 + (0.1 * len(f["modal_hits"]))
    
    for k in scores:
        scores[k] *= multiplier
    
    # Normalize (cap at 1.0)
    for k in scores:
        scores[k] = min(scores[k], 1.0)
    
    return scores, f


def detect_sensitive_data(text: str) -> Tuple[bool, float, Dict[str, List[str]]]:
    """
    Level-3 Sensitive Data Recognition - EZA-Core Mega Patch v1.0
    
    Detects sensitive data requests using:
    - Identity extraction
    - Pattern detection
    - Relational targeting
    - Weighted risk scoring
    
    Returns:
        (detected: bool, score: float, hits: Dict[str, List[str]])
    """
    text_low = text.lower()
    
    sd_hits: Dict[str, List[str]] = {
        "id_numbers": [],
        "personal_identifiers": [],
        "relational_targets": [],
        "lookup_patterns": []
    }
    
    # Scan each category
    for category, items in SENSITIVE_DATA_SIGNALS.items():
        for item in items:
            if item in text_low:
                sd_hits[category].append(item)
    
    # Scoring logic with weights
    score = 0.0
    weight = {
        "id_numbers": 0.60,
        "personal_identifiers": 0.40,
        "relational_targets": 0.25,
        "lookup_patterns": 0.35
    }
    
    for cat, hits in sd_hits.items():
        if hits:
            score += len(hits) * weight[cat]
    
    # Cap at critical threshold
    score = min(score, 1.0)
    
    # Strong rule: ID numbers always critical
    if sd_hits["id_numbers"]:
        score = 1.0  # always critical
    
    detected = score >= 0.40
    return detected, score, sd_hits


def analyze_input(text: str) -> Dict[str, Any]:
    """
    EZA-Core v11.0 input analyzer using EZA-IntentEngine v4.0 + Risk Engine.
    """
    try:
        if not text.strip():
            raise ValueError("Boş metin analiz edilemez.")

        # Detect language
        language = detect_language(text)
        
        # EZA-IntentEngine v4.0: Weighted Multi-Feature Scoring
        intent_scores, feature_metadata = calculate_intent_scores(text)
        
        # EZA-Core v11.0: Risk Engine - centralized risk and alignment calculation
        risk_result = compute_risk_and_alignment(intent_scores, text)
        
        # EZA-ReasoningShield v5.0: Analyze reasoning patterns
        reasoning_result = analyze_reasoning_patterns(text)
        
        # EZA-IdentityBlock v3.0: Analyze identity risk
        identity_info = analyze_identity_risk(text)
        
        # Extract values from risk_result
        primary_intent = risk_result["primary"]
        risk_score = risk_result["risk_score"]
        risk_level = risk_result["risk_level"]
        alignment_score = risk_result["alignment_score"]
        category = risk_result["category"]
        
        # Determine risk flags (intents with score >= 0.4)
        risk_flags = [intent for intent, score in intent_scores.items() 
                     if score >= 0.4 and intent != "information"]
        
        # Add reasoning shield red flags to risk_flags
        if reasoning_result.get("red_flags"):
            risk_flags.extend(reasoning_result["red_flags"])
            risk_flags = list(set(risk_flags))  # Remove duplicates
        
        # EZA-IdentityBlock v3.0: Add identity risk to risk flags and score
        if identity_info.get("identity_risk_score", 0.0) > 0.5:
            risk_flags.append("identity-risk")
            risk_score = max(risk_score, identity_info["identity_risk_score"])
        
        # Secondary intents (all except primary with score >= 0.4)
        secondary = [intent for intent, score in intent_scores.items() 
                    if intent != primary_intent and score >= 0.4]
        
        # Extract intent structure
        intent = {
            "primary": primary_intent,
            "secondary": secondary,
        }
        
        # Emotional tone
        tone = detect_emotional_tone(text)
        
        # Analysis dict
        analysis = {
            "quality_score": 85,
            "helpfulness": "EZA-IntentEngine v4.0 – weighted multi-feature intent analysis completed.",
            "safety_issues": risk_flags,
            "policy_violations": [],
            "summary": "Level-4 intent engine: action–target–purpose + stealth + modal + weighted matrix.",
            "alignment_score": alignment_score,
            "identity": identity_info,  # EZA-IdentityBlock v3.0
        }

        result = {
            "ok": True,
            "model": "eza-input-v11",
            "raw_text": text,
            "language": language,
            "intent": intent,
            "emotional_tone": tone,
            "risk_flags": risk_flags,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "analysis": analysis,
            "error": None,
            # EZA-IntentEngine v4.0 + Risk Engine metadata
            "intent_engine": {
                "primary": primary_intent,
                "secondary": secondary,
                "intent_scores": intent_scores,
                "risk_flags": risk_flags,
                "risk_score": risk_score,
                "risk_level": risk_level,
                "meta": {
                    "features": feature_metadata,
                },
            },
            # EZA-ReasoningShield v5.0 metadata
            "reasoning_shield": reasoning_result,
            # EZA-IdentityBlock v3.0 metadata
            "identity_block": identity_info,
        }

        log_event("input_analyzed_v11", result)
        return result

    except Exception as e:  # noqa: BLE001
        err = {
            "ok": False,
            "model": "eza-input-v11",
            "raw_text": text,
            "analysis": {},
            "error": str(e),
        }
        log_event("input_analysis_error_v11", err)
        return err
