# -*- coding: utf-8 -*-
"""
N Policies - Physical Harm Prevention
"""

from typing import List, Dict, Any
import re


def check_N1_physical_harm(text: str) -> Dict[str, Any]:
    """
    N1: Physical Harm Prevention
    Check for content that could cause physical harm
    """
    triggers = ["bomb", "explosive", "weapon", "poison", "kill", "murder", "harm", "violence",
                "bomba", "silah", "zehir", "öldür", "zarar", "patlayıcı"]
    
    text_lower = text.lower()
    violations = []
    
    for trigger in triggers:
        if re.search(rf"\b{re.escape(trigger)}\b", text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "N1",
                "trigger": trigger,
                "severity": "CRITICAL"
            })
    
    return {
        "violated": len(violations) > 0,
        "violations": violations,
        "risk_modifier": 0.8 if violations else 0.0
    }


def check_N2_self_harm(text: str) -> Dict[str, Any]:
    """
    N2: Self-Harm Prevention
    Check for content that encourages self-harm
    """
    triggers = ["suicide", "self-harm", "kill yourself", "end your life",
                "intihar", "kendine zarar", "kendini öldür", "kendini bitir"]
    
    text_lower = text.lower()
    violations = []
    
    for trigger in triggers:
        if re.search(rf"\b{re.escape(trigger)}\b", text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "N2",
                "trigger": trigger,
                "severity": "CRITICAL"
            })
    
    return {
        "violated": len(violations) > 0,
        "violations": violations,
        "risk_modifier": 0.9 if violations else 0.0
    }


def check_N3_violence_against_others(text: str) -> Dict[str, Any]:
    """
    N3: Violence Against Others
    Check for content promoting violence
    """
    triggers = ["attack", "violence", "assault", "hurt someone", "harm others",
                "saldır", "şiddet", "zarar ver", "döv", "vur"]
    
    text_lower = text.lower()
    violations = []
    
    for trigger in triggers:
        if re.search(rf"\b{re.escape(trigger)}\b", text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "N3",
                "trigger": trigger,
                "severity": "CRITICAL"
            })
    
    return {
        "violated": len(violations) > 0,
        "violations": violations,
        "risk_modifier": 0.85 if violations else 0.0
    }


def check_N4_dangerous_activities(text: str) -> Dict[str, Any]:
    """
    N4: Dangerous Activities
    Check for dangerous activity instructions
    """
    triggers = ["dangerous", "risky", "unsafe", "life-threatening",
                "tehlikeli", "riskli", "hayati tehlike", "ölümcül"]
    
    text_lower = text.lower()
    violations = []
    
    for trigger in triggers:
        if re.search(rf"\b{re.escape(trigger)}\b", text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "N4",
                "trigger": trigger,
                "severity": "HIGH"
            })
    
    return {
        "violated": len(violations) > 0,
        "violations": violations,
        "risk_modifier": 0.7 if violations else 0.0
    }


def evaluate_N_policies(text: str) -> List[Dict[str, Any]]:
    """Evaluate all N policies"""
    results = [
        check_N1_physical_harm(text),
        check_N2_self_harm(text),
        check_N3_violence_against_others(text),
        check_N4_dangerous_activities(text)
    ]
    
    return [r for r in results if r["violated"]]

