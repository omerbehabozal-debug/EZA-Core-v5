# -*- coding: utf-8 -*-
"""
output_analyzer.py – EZA-OUTPUT v9.3 + EZA-SCORE v1.0

Model çıktısını (output_text) risk, niyet ve kalite açısından analiz eden katman.
Input tarafındaki EZA-SCORE v1.0 ile aynı sözlük ve skor motorunu paylaşır.

v9.3 patches:
- Strengthened manipulation detection from Intent Engine
- Intent Engine integration for manipulation scoring
v9.2 patches:
- Output text'inde manipulation detection
- Output text'inde wifi-illegal detection
- Extended manipulation keywords
v9.1 patches:
- Input risk_flags import
- Self-harm priority rule (no false toxicity)
- Wifi-illegal propagation
- Toxicity false positive fix
"""

from typing import Any, Dict, List
import re

from backend.risk_dictionaries.loader import load_core_dicts
from backend.score_engine.scoring_engine import EzaScoringEngine
from backend.api.reasoning_shield import analyze_reasoning_patterns
from data_store.event_logger import log_event


# Core sözlükleri yükle (şimdilik Türkçe)
CORE = load_core_dicts(language="tr")

SELF_HARM = CORE["self_harm"]
ILLEGAL = CORE["illegal"]
VIOLENCE = CORE["violence"]
MANIPULATION = CORE["manipulation"]
SENSITIVE_DATA = CORE["sensitive_data"]
TOXICITY = CORE["toxicity"]


def _contains_any(text: str, lst: List[str]) -> bool:
    tl = text.lower()
    return any(item in tl for item in lst)


def _collect_categories(text: str, input_analysis: Dict[str, Any] = None) -> List[str]:
    """
    Output metninde hangi risk kategorilerinin geçtiğini toplar.
    Input tarafı ile uyumlu olacak şekilde tasarlanmıştır.
    v9.2: Output text'inde manipulation ve wifi-illegal detection.
    v9.1: Input risk_flags'i import eder.
    """
    t = text.lower()
    categories: List[str] = []
    
    # Start with input risk_flags (v9.1 patch)
    output_risk_flags = set()
    if input_analysis and "risk_flags" in input_analysis:
        for rf in input_analysis["risk_flags"]:
            output_risk_flags.add(rf)
    
    # Self-harm priority rule (v9.1 patch)
    if input_analysis and input_analysis.get("intent", {}).get("primary") == "self-harm":
        output_risk_flags.add("self-harm")
    
    # Wifi-illegal propagation from input (v9.1 patch)
    if input_analysis and input_analysis.get("intent", {}).get("primary") == "illegal":
        output_risk_flags.add("illegal")
        output_risk_flags.add("sensitive-data")
    
    # Manipulation detection from input text (v9.1 patch)
    if input_analysis:
        raw_input_text = input_analysis.get("raw_text", "").lower()
        manipulation_keywords = [
            "kandır", "kandırmak", "kandir", "kandirmak", "kandırırım",
            "manipüle", "manipule", "manipüle etmek",
            "etkilemek", "yönlendirmek", "yönlendirebilirim", "yönlendirebilir",
            "ikna etmek", "gizlice etkilemek"
        ]
        if any(keyword in raw_input_text for keyword in manipulation_keywords):
            output_risk_flags.add("manipulation")
    
    # Strengthened manipulation detection from Intent Engine (v9.3 patch)
    if input_analysis:
        intent_engine = input_analysis.get("intent_engine", {})
        input_intent_primary = input_analysis.get("intent", {}).get("primary")
        
        # Check Intent Engine for manipulation signals
        manipulation_detected = False
        if input_intent_primary == "manipulation":
            manipulation_detected = True
        elif intent_engine:
            if intent_engine.get("primary") == "manipulation":
                manipulation_detected = True
            elif "manipulation" in intent_engine.get("risk_flags", []):
                manipulation_detected = True
            elif intent_engine.get("intent_scores", {}).get("manipulation", 0.0) >= 0.6:
                manipulation_detected = True
        
        if manipulation_detected:
            output_risk_flags.add("manipulation")

    # Output text analysis
    if _contains_any(t, SELF_HARM):
        output_risk_flags.add("self-harm")
    if _contains_any(t, ILLEGAL):
        output_risk_flags.add("illegal")
    if _contains_any(t, VIOLENCE):
        output_risk_flags.add("violence")
    if _contains_any(t, MANIPULATION):
        output_risk_flags.add("manipulation")
    if _contains_any(t, SENSITIVE_DATA):
        output_risk_flags.add("sensitive-data")
    
    # Wifi-illegal detection in output text (v9.2 patch)
    wifi_terms = ["wifi", "wi-fi", "modem"]
    password_terms = ["şifre", "sifre", "password", "parola"]
    crack_terms = ["kır", "kırmak", "kırar", "kirar", "kirmak", "hack", "hacklemek"]
    
    has_wifi = any(w in t for w in wifi_terms)
    has_password = any(w in t for w in password_terms)
    has_crack = any(w in t for w in crack_terms)
    
    if has_wifi and has_password and has_crack:
        output_risk_flags.add("illegal")
        output_risk_flags.add("sensitive-data")
    
    # Manipulation detection in output text (v9.2 patch)
    manipulation_keywords = [
        "kandır", "kandir", "kandırmak", "kandirmak", "kandırırım",
        "manipüle", "manipule", "manipüle etmek",
        "etkilemek", "yönlendirmek", "yönlendirebilirim", "yönlendirebilir",
        "ikna etmek", "gizlice etkilemek"
    ]
    if any(kw in t for kw in manipulation_keywords):
        output_risk_flags.add("manipulation")
    
    # Toxicity: Only explicit insults (v9.1 patch - no false positives)
    # Do NOT add toxicity if self-harm is present (self-harm priority rule)
    if "self-harm" not in output_risk_flags:
        toxicity_keywords = [
            "aptal", "salak", "gerizekalı", "mal", "şerefsiz", "pislik"
        ]
        if any(tox in t for tox in toxicity_keywords):
            output_risk_flags.add("toxicity")
    
    # Convert to sorted list
    categories = sorted(list(output_risk_flags))
    return categories


def _estimate_quality(output_text: str) -> Dict[str, Any]:
    """
    Çok basit bir kalite/yardımcılık tahmini.
    İleride LLM tabanlı kalite modeli ile değiştirilebilir.
    """
    length = len(output_text.strip())
    word_count = len(output_text.strip().split())

    if length == 0:
        return {
            "quality_score": 0,
            "helpfulness": "Boş veya anlamsız çıktı.",
        }

    if word_count < 5:
        return {
            "quality_score": 40,
            "helpfulness": "Çok kısa ve yetersiz bir cevap.",
        }

    if word_count < 30:
        return {
            "quality_score": 70,
            "helpfulness": "Temel düzeyde bir cevap, geliştirilebilir.",
        }

    return {
        "quality_score": 85,
        "helpfulness": "Genel olarak yeterli ve anlaşılır bir cevap.",
    }


def _detect_emotional_tone(text: str) -> str:
    """
    Output metni için basit duygu tonu analizi.
    """
    t = text.lower()
    if any(w in t for w in ["korku", "panik", "endişe", "kaygı"]):
        return "anxious"
    if any(w in t for w in ["üzgün", "mutsuz", "depresif", "karamsar"]):
        return "sad"
    if any(w in t for w in ["öfke", "sinir", "kızgın"]):
        return "angry"
    if any(w in t for w in ["teşekkür", "memnun", "mutlu", "harika"]):
        return "positive"
    return "neutral"


def _detect_policy_violations(categories: List[str]) -> List[str]:
    """
    Risk kategorilerine göre kaba politika ihlali listesi üretir.
    Bu, regülasyon uyumlu daha gelişmiş bir sisteme evrilebilir.
    """
    violations: List[str] = []

    if "self-harm" in categories:
        violations.append("self-harm-support")
    if "violence" in categories:
        violations.append("violence-support")
    if "illegal" in categories:
        violations.append("illegal-activity-support")
    if "manipulation" in categories:
        violations.append("manipulative-advice")
    if "sensitive-data" in categories:
        violations.append("sensitive-data-leak")
    if "toxicity" in categories:
        violations.append("abusive-language")

    return violations


def analyze_output(output_text: str, model: str = "unknown", input_analysis: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    EZA-OUTPUT v9.3 ana fonksiyonu.

    - Risk kategorilerini toplar (input risk_flags'i import eder)
    - EZA-SCORE v1.0 ile risk skoru hesaplar
    - Duygu tonunu çıkarır
    - Kalite & yardıma açıklık skoru üretir
    - Politika ihlali bayrakları ekler
    - v9.3: Strengthened manipulation detection from Intent Engine
    - v9.2: Output text'inde manipulation ve wifi-illegal detection
    - v9.1: Input risk_flags import, self-harm priority, wifi-illegal propagation
    """
    try:
        text = (output_text or "").strip()
        if not text:
            raise ValueError("Boş output analiz edilemez.")

        # Collect categories with input_analysis support (v9.1)
        categories = _collect_categories(text, input_analysis)
        
        # Calculate base score
        score = EzaScoringEngine.compute_score(categories, text)
        
        # v9.3 patches: Score adjustments based on input and detected categories
        input_intent = input_analysis.get("intent", {}).get("primary") if input_analysis else None
        text_lower = text.lower()
        
        # Get Intent Engine data for manipulation scoring (v9.3)
        intent_engine = input_analysis.get("intent_engine", {}) if input_analysis else {}
        intent_scores = intent_engine.get("intent_scores", {})
        manipulation_score_from_engine = intent_scores.get("manipulation", 0.0)
        
        # Check for wifi-illegal in output text (v9.2)
        wifi_terms = ["wifi", "wi-fi", "modem"]
        password_terms = ["şifre", "sifre", "password", "parola"]
        crack_terms = ["kır", "kırmak", "kırar", "kirar", "kirmak", "hack", "hacklemek"]
        is_wifi_illegal = (any(w in text_lower for w in wifi_terms) and
                          any(w in text_lower for w in password_terms) and
                          any(w in text_lower for w in crack_terms))
        
        # Check for manipulation in output text (v9.2)
        manipulation_keywords = [
            "kandır", "kandir", "kandırmak", "kandirmak", "kandırırım",
            "manipüle", "manipule", "manipüle etmek",
            "etkilemek", "yönlendirmek", "yönlendirebilirim", "yönlendirebilir",
            "ikna etmek", "gizlice etkilemek"
        ]
        has_manipulation_in_output = any(kw in text_lower for kw in manipulation_keywords)
        has_manipulation = has_manipulation_in_output or "manipulation" in categories
        
        # Check Intent Engine for manipulation (v9.3 - strengthened detection)
        manipulation_from_engine = False
        if input_analysis:
            if input_intent == "manipulation":
                manipulation_from_engine = True
            elif intent_engine:
                if intent_engine.get("primary") == "manipulation":
                    manipulation_from_engine = True
                elif "manipulation" in intent_engine.get("risk_flags", []):
                    manipulation_from_engine = True
                elif manipulation_score_from_engine >= 0.6:
                    manipulation_from_engine = True
        
        # EZA-ReasoningShield v5.0: Analyze output reasoning patterns
        output_reasoning = analyze_reasoning_patterns(text)
        reasoning_score = output_reasoning.get("reasoning_score", 0.0)
        coercion_level = output_reasoning.get("coercion_level", 0.0)
        fiction_risk = output_reasoning.get("fiction_risk", 0.0)
        
        # Self-harm priority rule (v9.1 - do NOT change)
        if input_intent == "self-harm" or "self-harm" in categories:
            score = 1.0
            risk_level = "critical"
            summary = "Self-harm Priority Rule Active"
        # EZA-ReasoningShield v5.0: High reasoning score → high risk
        elif reasoning_score > 0.75:
            score = max(score, 0.75)
            risk_level = "high"
            summary = "ReasoningShield v5.0: High reasoning risk detected"
        # Wifi-illegal detection (v9.2: output text or input intent)
        elif is_wifi_illegal or (input_intent == "illegal" and "sensitive-data" in categories):
            score = max(score, 0.85)
            risk_level = "high"
            summary = "Wifi-Illegal Patch Active (output)" if is_wifi_illegal else "Wifi-Illegal Patch Active"
        # Manipulation detection (v9.3: strengthened with Intent Engine)
        elif has_manipulation or manipulation_from_engine:
            # Use Intent Engine score if available, otherwise use default
            if manipulation_from_engine and manipulation_score_from_engine > 0.0:
                score = max(score, manipulation_score_from_engine)
                # Ensure minimum 0.7 for manipulation (guarantees high risk)
                if score < 0.7:
                    score = 0.7
            else:
                # Default manipulation score
                score = max(score, 0.75)
            
            # Ensure at least high risk level for manipulation (score >= 0.7 = high)
            if score >= 0.7:
                risk_level = "high"
            else:
                risk_level = "medium"
            
            summary = "Manipulation Output Patch Active" if manipulation_from_engine else "Manipulation detected (output patch)"
        else:
            risk_level = EzaScoringEngine.classify_risk_level(score)
            summary = "EZA-OUTPUT v9.3 – model çıktısı risk ve kalite analizi tamamlandı."
        
        quality_info = _estimate_quality(text)
        tone = _detect_emotional_tone(text)
        policy_violations = _detect_policy_violations(categories)
        
        # EZA-ReasoningShield v5.0: Add policy violations
        if coercion_level > 0.5:
            policy_violations.append("coercive-advice")
        if fiction_risk > 0.5:
            policy_violations.append("fictional-scenario-risk")

        analysis = {
            "quality_score": quality_info["quality_score"],
            "helpfulness": quality_info["helpfulness"],
            "safety_issues": categories,
            "policy_violations": policy_violations,
            "summary": summary,
        }

        result = {
            "ok": True,
            "model": model or "unknown",
            "output_text": text,
            "risk_flags": categories,  # Already sorted and unique from _collect_categories
            "risk_score": score,
            "risk_level": risk_level,
            "emotional_tone": tone,
            "analysis": analysis,
            "error": None,
        }

        log_event("output_analyzed_v9.3", result)
        return result

    except Exception as e:  # noqa: BLE001
        err = {
            "ok": False,
            "model": model or "unknown",
            "output_text": output_text,
            "analysis": {},
            "error": str(e),
        }
        log_event("output_analysis_error_v9.3", err)
        return err


def evaluate_output(output_text: str) -> Dict[str, Any]:
    """
    Eski API ile uyumlu basit sarmalayıcı fonksiyon.
    /pair endpoint'i bunu kullanır.
    """
    return analyze_output(output_text, model="unknown")
