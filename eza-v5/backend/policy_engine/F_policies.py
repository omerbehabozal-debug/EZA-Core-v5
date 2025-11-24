# -*- coding: utf-8 -*-
"""
F Policies - Fraud and Deception Prevention
"""

from typing import List, Dict, Any
import re


def check_F1_fraud(text: str) -> Dict[str, Any]:
    """
    F1: Fraud Prevention
    Check for fraud-related content
    """
    triggers = ["fraud", "scam", "phishing", "steal money", "trick", "deceive",
                "dolandırıcılık", "aldat", "hile", "sahte", "fake"]
    
    text_lower = text.lower()
    violations = []
    
    for trigger in triggers:
        if re.search(rf"\b{re.escape(trigger)}\b", text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "F1",
                "trigger": trigger,
                "severity": "HIGH"
            })
    
    return {
        "violated": len(violations) > 0,
        "violations": violations,
        "risk_modifier": 0.75 if violations else 0.0
    }


def check_F2_identity_theft(text: str) -> Dict[str, Any]:
    """
    F2: Identity Theft Prevention
    Check for identity theft-related content
    """
    triggers = ["identity theft", "steal identity", "impersonate", "fake identity",
                "kimlik hırsızlığı", "taklit et", "kimlik çal", "sahte kimlik"]
    
    text_lower = text.lower()
    violations = []
    
    for trigger in triggers:
        if re.search(rf"\b{re.escape(trigger)}\b", text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "F2",
                "trigger": trigger,
                "severity": "HIGH"
            })
    
    return {
        "violated": len(violations) > 0,
        "violations": violations,
        "risk_modifier": 0.8 if violations else 0.0
    }


def check_F3_deceptive_practices(text: str) -> Dict[str, Any]:
    """
    F3: Deceptive Practices
    Check for deceptive or manipulative content
    """
    triggers = ["deceive", "mislead", "false information", "lie", "manipulate",
                "aldat", "yanılt", "yalan", "manipüle et", "yanlış bilgi"]
    
    text_lower = text.lower()
    violations = []
    
    for trigger in triggers:
        if re.search(rf"\b{re.escape(trigger)}\b", text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "F3",
                "trigger": trigger,
                "severity": "HIGH"
            })
    
    return {
        "violated": len(violations) > 0,
        "violations": violations,
        "risk_modifier": 0.7 if violations else 0.0
    }


def evaluate_F_policies(text: str) -> List[Dict[str, Any]]:
    """Evaluate all F policies"""
    results = [
        check_F1_fraud(text),
        check_F2_identity_theft(text),
        check_F3_deceptive_practices(text)
    ]
    
    return [r for r in results if r["violated"]]

