# -*- coding: utf-8 -*-
"""
Z Policies - Privacy and Data Security
"""

from typing import List, Dict, Any
import re


def check_Z1_privacy(text: str) -> Dict[str, Any]:
    """
    Z1: Privacy Protection
    Check for privacy violations
    """
    triggers = ["personal data", "private information", "unauthorized access", "breach privacy",
                "kişisel veri", "gizlilik ihlali", "özel bilgi", "yetkisiz erişim"]
    
    text_lower = text.lower()
    violations = []
    
    for trigger in triggers:
        if re.search(rf"\b{re.escape(trigger)}\b", text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "Z1",
                "trigger": trigger,
                "severity": "HIGH"
            })
    
    return {
        "violated": len(violations) > 0,
        "violations": violations,
        "risk_modifier": 0.75 if violations else 0.0
    }


def check_Z2_data_security(text: str) -> Dict[str, Any]:
    """
    Z2: Data Security
    Check for security violations
    """
    triggers = ["hack", "breach", "unauthorized access", "security violation", "data breach",
                "hackla", "güvenlik ihlali", "yetkisiz erişim", "veri ihlali", "sistem kır"]
    
    text_lower = text.lower()
    violations = []
    
    for trigger in triggers:
        if re.search(rf"\b{re.escape(trigger)}\b", text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "Z2",
                "trigger": trigger,
                "severity": "CRITICAL"
            })
    
    return {
        "violated": len(violations) > 0,
        "violations": violations,
        "risk_modifier": 0.85 if violations else 0.0
    }


def check_Z3_pii_exposure(text: str) -> Dict[str, Any]:
    """
    Z3: Personal Information Exposure
    Check for PII exposure risks
    """
    triggers = ["social security", "credit card", "bank account", "password", "SSN", "PII",
                "gizli bilgi", "şifre", "banka hesabı", "kredi kartı", "TC kimlik"]
    
    text_lower = text.lower()
    violations = []
    
    for trigger in triggers:
        if re.search(rf"\b{re.escape(trigger)}\b", text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "Z3",
                "trigger": trigger,
                "severity": "HIGH"
            })
    
    return {
        "violated": len(violations) > 0,
        "violations": violations,
        "risk_modifier": 0.7 if violations else 0.0
    }


def check_Z4_surveillance(text: str) -> Dict[str, Any]:
    """
    Z4: Surveillance and Monitoring
    Check for unauthorized surveillance
    """
    triggers = ["surveillance", "spy", "monitor", "track", "stalk",
                "gözetle", "izle", "takip et", "casusluk", "gizlice izle"]
    
    text_lower = text.lower()
    violations = []
    
    for trigger in triggers:
        if re.search(rf"\b{re.escape(trigger)}\b", text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "Z4",
                "trigger": trigger,
                "severity": "HIGH"
            })
    
    return {
        "violated": len(violations) > 0,
        "violations": violations,
        "risk_modifier": 0.7 if violations else 0.0
    }


def evaluate_Z_policies(text: str) -> List[Dict[str, Any]]:
    """Evaluate all Z policies"""
    results = [
        check_Z1_privacy(text),
        check_Z2_data_security(text),
        check_Z3_pii_exposure(text),
        check_Z4_surveillance(text)
    ]
    
    return [r for r in results if r["violated"]]

