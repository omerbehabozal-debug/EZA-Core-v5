# -*- coding: utf-8 -*-
"""
A Policies - Autonomy and Manipulation Prevention
"""

from typing import List, Dict, Any
import re


def check_A1_autonomy(text: str) -> Dict[str, Any]:
    """
    A1: Autonomy Respect
    Check for autonomy violations
    """
    # Base words and their variations
    triggers = [
        "force", "forced", "forcing",
        "coerce", "coerced", "coercing", "coercion",
        "manipulate", "manipulated", "manipulating", "manipulation",
        "pressure", "pressuring", "pressured",
        "compel", "compelling", "compelled",
        "obligate", "obligated", "obligation", "obliged",
        "must do", "have to", "has to", "had to",
        "cannot refuse", "can't refuse", "can not refuse",
        "no choice", "have no choice", "has no choice",
        "zorla", "baskı yap", "manipüle et", "mecbur et", "zorunda"
    ]
    
    text_lower = text.lower()
    violations = []
    
    for trigger in triggers:
        if re.search(rf"\b{re.escape(trigger)}\b", text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "A1",
                "trigger": trigger,
                "severity": "HIGH"
            })
    
    return {
        "violated": len(violations) > 0,
        "violations": violations,
        "risk_modifier": 0.7 if violations else 0.0
    }


def check_A2_informed_consent(text: str) -> Dict[str, Any]:
    """
    A2: Informed Consent
    Check for informed consent violations
    """
    triggers = [
        "withhold", "withholding", "withheld",
        "hide information", "hide", "hiding", "hidden",
        "secret", "secrets", "secretly",
        "don't tell", "do not tell", "don't reveal", "do not reveal",
        "don't disclose", "do not disclose", "non-disclosure",
        "keep secret", "keep confidential", "keep private",
        "remain private", "must remain private", "stay private",
        "confidential", "confidentiality",
        "bilgi sakla", "gizle", "söyleme", "sakla", "gizli tut"
    ]
    
    text_lower = text.lower()
    violations = []
    
    for trigger in triggers:
        if re.search(rf"\b{re.escape(trigger)}\b", text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "A2",
                "trigger": trigger,
                "severity": "HIGH"
            })
    
    return {
        "violated": len(violations) > 0,
        "violations": violations,
        "risk_modifier": 0.65 if violations else 0.0
    }


def check_A3_psychological_manipulation(text: str) -> Dict[str, Any]:
    """
    A3: Psychological Manipulation
    Check for psychological manipulation
    """
    triggers = [
        "guilt trip", "guilt", "guilty", "feel guilty", "should feel guilty",
        "emotional manipulation", "emotionally manipulate", "emotional pressure",
        "pressure", "pressuring", "pressured",
        "coerce", "coercion",
        "owe me", "you owe", "owe you",
        "feel bad", "make you feel bad", "make you feel",
        "disappointing", "disappoint", "disappointment", "disappointing me",
        "hurt", "be hurt", "i'll be hurt", "i will be hurt",
        "letting me down", "let me down", "letting down",
        "trusted you", "i trusted", "trust manipulation",
        "suçluluk", "duygusal manipülasyon", "baskı", "suçlu hissettir"
    ]
    
    text_lower = text.lower()
    violations = []
    
    for trigger in triggers:
        if re.search(rf"\b{re.escape(trigger)}\b", text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "A3",
                "trigger": trigger,
                "severity": "HIGH"
            })
    
    return {
        "violated": len(violations) > 0,
        "violations": violations,
        "risk_modifier": 0.7 if violations else 0.0
    }


def check_A4_free_will(text: str) -> Dict[str, Any]:
    """
    A4: Free Will Protection
    Check for free will restrictions
    """
    triggers = [
        "control", "controlling", "controlled", "control your", "control decisions",
        "restrict", "restricting", "restricted", "restricting your", "restrict options",
        "limit choice", "limit", "limiting", "limited", "limiting your", "limit free will",
        "no choice", "have no choice", "has no choice", "cannot choose", "can't choose",
        "cannot choose otherwise", "can't choose otherwise",
        "remove autonomy", "removing autonomy", "autonomy is being removed",
        "dictate", "dictating", "dictated", "dictating your", "dictate choices",
        "follow my direction", "follow direction", "must follow",
        "kontrol et", "kısıtla", "seçenek yok", "zorunlu"
    ]
    
    text_lower = text.lower()
    violations = []
    
    for trigger in triggers:
        if re.search(rf"\b{re.escape(trigger)}\b", text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "A4",
                "trigger": trigger,
                "severity": "MEDIUM"
            })
    
    return {
        "violated": len(violations) > 0,
        "violations": violations,
        "risk_modifier": 0.6 if violations else 0.0
    }


def evaluate_A_policies(text: str) -> List[Dict[str, Any]]:
    """Evaluate all A policies"""
    results = [
        check_A1_autonomy(text),
        check_A2_informed_consent(text),
        check_A3_psychological_manipulation(text),
        check_A4_free_will(text)
    ]
    
    return [r for r in results if r["violated"]]

