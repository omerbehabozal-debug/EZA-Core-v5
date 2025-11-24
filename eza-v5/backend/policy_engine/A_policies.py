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
    triggers = ["force", "coerce", "manipulate", "pressure", "must do", "have to",
                "zorla", "baskı yap", "manipüle et", "mecbur et", "zorunda"]
    
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
    triggers = ["withhold", "hide information", "secret", "don't tell",
                "bilgi sakla", "gizle", "söyleme", "sakla", "gizli tut"]
    
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
    triggers = ["guilt trip", "emotional manipulation", "pressure", "coerce",
                "suçluluk", "duygusal manipülasyon", "baskı", "suçlu hissettir"]
    
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
    triggers = ["control", "restrict", "limit choice", "no choice",
                "kontrol et", "kısıtla", "seçenek yok", "zorunlu"]
    
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

