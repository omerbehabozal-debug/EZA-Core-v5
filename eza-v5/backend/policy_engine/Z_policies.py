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
    # Single word triggers first
    single_word_triggers = [
        "privacy", "private", "confidential", "invade", "violate",
        "kişisel veri", "gizlilik ihlali", "özel bilgi", "yetkisiz erişim"
    ]
    
    # Multi-word triggers
    multi_word_triggers = [
        "personal data", "private information", "private data", "access private data",
        "unauthorized access", "breach privacy", "violate privacy", "violate someone's privacy",
        "invade privacy", "access confidential information", "breach confidentiality",
        "get unauthorized access to private information"
    ]
    
    text_lower = text.lower()
    violations = []
    
    # Check single word triggers first
    for trigger in single_word_triggers:
        if re.search(rf"\b{re.escape(trigger)}\b", text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "Z1",
                "trigger": trigger,
                "severity": "HIGH"
            })
    
    # Check multi-word triggers
    for trigger in multi_word_triggers:
        pattern = r"\b" + r"\s+".join(re.escape(word) for word in trigger.split()) + r"\b"
        if re.search(pattern, text_lower, re.IGNORECASE):
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
    # Single word triggers first
    single_word_triggers = [
        "hack", "breach", "penetrate", "compromise", "break",
        "hackla", "güvenlik ihlali", "yetkisiz erişim", "veri ihlali", "sistem kır"
    ]
    
    # Multi-word triggers
    multi_word_triggers = [
        "unauthorized access", "security violation", "data breach", "breach security",
        "hack into", "hack systems", "break into systems", "penetrate security",
        "compromise a system", "compromise system", "cause a data breach"
    ]
    
    text_lower = text.lower()
    violations = []
    
    # Check single word triggers first
    for trigger in single_word_triggers:
        if re.search(rf"\b{re.escape(trigger)}\b", text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "Z2",
                "trigger": trigger,
                "severity": "CRITICAL"
            })
    
    # Check multi-word triggers
    for trigger in multi_word_triggers:
        pattern = r"\b" + r"\s+".join(re.escape(word) for word in trigger.split()) + r"\b"
        if re.search(pattern, text_lower, re.IGNORECASE):
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
    # Single word triggers first
    single_word_triggers = [
        "password", "passwords", "SSN", "PII", "pii",
        "gizli bilgi", "şifre", "banka hesabı", "kredi kartı", "TC kimlik"
    ]
    
    # Multi-word triggers
    multi_word_triggers = [
        "social security", "credit card", "credit card number", "bank account", "bank accounts",
        "access bank accounts", "social security numbers", "steal passwords",
        "personal identifiers", "obtain personal identifiers", "personal identifier",
        "sensitive personal data", "extract sensitive personal data", "harvest PII"
    ]
    
    text_lower = text.lower()
    violations = []
    
    # Check single word triggers first
    for trigger in single_word_triggers:
        if re.search(rf"\b{re.escape(trigger)}\b", text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "Z3",
                "trigger": trigger,
                "severity": "HIGH"
            })
    
    # Check multi-word triggers
    for trigger in multi_word_triggers:
        pattern = r"\b" + r"\s+".join(re.escape(word) for word in trigger.split()) + r"\b"
        if re.search(pattern, text_lower, re.IGNORECASE):
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
    # Single word triggers first
    single_word_triggers = [
        "surveillance", "surveil", "spy", "monitor", "track", "stalk", "observe",
        "gözetle", "izle", "takip et", "casusluk", "gizlice izle"
    ]
    
    # Multi-word triggers
    multi_word_triggers = [
        "surveil someone", "spy on", "monitor someone", "track someone", "stalk someone",
        "track someone's activities", "track someone's movements",
        "watch someone secretly", "observe someone", "observe someone without consent"
    ]
    
    text_lower = text.lower()
    violations = []
    
    # Check single word triggers first
    for trigger in single_word_triggers:
        if re.search(rf"\b{re.escape(trigger)}\b", text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "Z4",
                "trigger": trigger,
                "severity": "HIGH"
            })
    
    # Check multi-word triggers
    for trigger in multi_word_triggers:
        pattern = r"\b" + r"\s+".join(re.escape(word) for word in trigger.split()) + r"\b"
        if re.search(pattern, text_lower, re.IGNORECASE):
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

