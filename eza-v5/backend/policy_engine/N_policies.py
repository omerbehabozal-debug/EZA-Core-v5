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
    triggers = [
        "bomb", "bombs", "bomba", "bomb making", "bomb creation", "create a bomb", "make a bomb",
        "explosive", "explosives", "explosive device", "make explosives", "explosives making",
        "explosives recipe", "recipe for explosives",
        "weapon", "weapons", "make a weapon", "create a weapon", "build a weapon", "weapon creation",
        "poison", "poisoning", "poison someone", "how to poison",
        "kill", "killing", "murder", "murdering",
        "harm", "harming", "physical harm", "cause physical harm",
        "violence", "violent",
        "bomba", "silah", "zehir", "öldür", "zarar", "patlayıcı"
    ]
    
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
    # Single word triggers first
    single_word_triggers = [
        "suicide", "self-harm", "self harm", "hurt myself",
        "die", "intihar", "kendine zarar", "kendini öldür", "kendini bitir"
    ]
    
    # Multi-word triggers
    multi_word_triggers = [
        "commit suicide", "suicide method",
        "self-harm method", "how to self-harm",
        "kill yourself", "self-killing",
        "end your life", "end my life", "end life", "end suffering", "end my suffering",
        "best way to die", "death method"
    ]
    
    text_lower = text.lower()
    violations = []
    
    # Check single word triggers first
    for trigger in single_word_triggers:
        if re.search(rf"\b{re.escape(trigger)}\b", text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "N2",
                "trigger": trigger,
                "severity": "CRITICAL"
            })
    
    # Check multi-word triggers
    for trigger in multi_word_triggers:
        # Replace spaces with \s+ to allow flexible matching
        pattern = r"\b" + r"\s+".join(re.escape(word) for word in trigger.split()) + r"\b"
        if re.search(pattern, text_lower, re.IGNORECASE):
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
    triggers = [
        "attack", "attacking", "attacked", "attack someone", "attack method", "attack strategy",
        "violence", "violent", "commit violence",
        "assault", "assaulting", "assaulted", "assault someone",
        "hurt someone", "hurt others", "hurt people", "how to hurt",
        "harm someone", "harm others", "how can i harm",
        "cause physical harm", "physical harm",
        "saldır", "şiddet", "zarar ver", "döv", "vur"
    ]
    
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
    # Single word triggers first
    single_word_triggers = [
        "dangerous", "risky", "unsafe", "hazardous", "perilous",
        "tehlikeli", "riskli", "hayati tehlike", "ölümcül"
    ]
    
    # Multi-word triggers
    multi_word_triggers = [
        "dangerous activity", "dangerous activities", "dangerous things", "do something dangerous",
        "risky activities", "extremely risky", "extreme risk",
        "unsafe actions", "perform unsafe actions",
        "life-threatening", "life threatening", "life-threatening activities",
        "hazardous behavior", "engage in hazardous behavior",
        "perilous activities"
    ]
    
    text_lower = text.lower()
    violations = []
    
    # Check single word triggers first
    for trigger in single_word_triggers:
        if re.search(rf"\b{re.escape(trigger)}\b", text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "N4",
                "trigger": trigger,
                "severity": "HIGH"
            })
    
    # Check multi-word triggers
    for trigger in multi_word_triggers:
        # Replace spaces with \s+ to allow flexible matching
        pattern = r"\b" + r"\s+".join(re.escape(word) for word in trigger.split()) + r"\b"
        if re.search(pattern, text_lower, re.IGNORECASE):
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

