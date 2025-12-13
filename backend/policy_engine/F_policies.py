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
    # Single word triggers first (more reliable)
    single_word_triggers = [
        "fraud", "frauds", "fraudulent", "defraud", "defrauding",
        "scam", "scams", "scamming",
        "phishing",
        "trick", "tricking",
        "deceive", "deceiving", "deceived",
        "swindle", "swindling",
        "dolandırıcılık", "aldat", "hile", "sahte", "fake"
    ]
    
    # Multi-word triggers
    multi_word_triggers = [
        "commit fraud", "scam people", "scam creation", "create a scam",
        "phishing email", "create a phishing",
        "steal money", "trick someone", "trick for money",
        "swindle people"
    ]
    
    text_lower = text.lower()
    violations = []
    
    # Check single word triggers first
    for trigger in single_word_triggers:
        if re.search(rf"\b{re.escape(trigger)}\b", text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "F1",
                "trigger": trigger,
                "severity": "HIGH"
            })
    
    # Check multi-word triggers (use word boundaries more flexibly)
    for trigger in multi_word_triggers:
        # Replace spaces with \s+ to allow flexible matching
        pattern = r"\b" + r"\s+".join(re.escape(word) for word in trigger.split()) + r"\b"
        if re.search(pattern, text_lower, re.IGNORECASE):
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
    # Single word triggers first
    single_word_triggers = [
        "impersonate", "impersonating", "impersonated",
        "clone", "cloning", "cloned",
        "assume", "assuming", "assumed",
        "kimlik hırsızlığı", "taklit et", "kimlik çal", "sahte kimlik"
    ]
    
    # Multi-word triggers
    multi_word_triggers = [
        "identity theft", "commit identity theft", "identity theft method", "identity theft process",
        "steal identity", "steal someone's identity", "steal identities",
        "impersonate someone",
        "fake identity", "create a fake identity", "fake identities",
        "use someone else's identity", "use others identity",
        "assume identity", "assume someone's identity", "assuming identity",
        "clone identity", "clone an identity", "identity cloning"
    ]
    
    text_lower = text.lower()
    violations = []
    
    # Check single word triggers first
    for trigger in single_word_triggers:
        if re.search(rf"\b{re.escape(trigger)}\b", text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "F2",
                "trigger": trigger,
                "severity": "HIGH"
            })
    
    # Check multi-word triggers
    for trigger in multi_word_triggers:
        # Replace spaces with \s+ to allow flexible matching
        # Handle apostrophes in words (e.g., "someone's" -> "someone's" or "someone s")
        words = trigger.split()
        escaped_words = []
        for word in words:
            # If word contains apostrophe, escape it properly
            if "'" in word:
                escaped_words.append(re.escape(word))
            else:
                escaped_words.append(re.escape(word))
        pattern = r"\b" + r"\s+".join(escaped_words) + r"\b"
        if re.search(pattern, text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "F2",
                "trigger": trigger,
                "severity": "HIGH"
            })
    
    return {
        "violated": len(violations) > 0,
        "violations": violations,
        "risk_modifier": 0.85 if violations else 0.0  # Increased from 0.8 to 0.85 for better score reduction
    }


def check_F3_deceptive_practices(text: str) -> Dict[str, Any]:
    """
    F3: Deceptive Practices
    Check for deceptive or manipulative content
    """
    # Single word triggers first
    single_word_triggers = [
        "deceive", "deceiving", "deceived", "deception",
        "mislead", "misleading", "misled",
        "lie", "lying", "lied",
        "manipulate", "manipulating", "manipulated", "manipulation",
        "trick", "tricking",
        "con", "conning", "conned",
        "hoodwink", "hoodwinking", "hoodwinked",
        "aldat", "yanılt", "yalan", "manipüle et", "yanlış bilgi"
    ]
    
    # Multi-word triggers
    multi_word_triggers = [
        "use deception",
        "mislead people",
        "false information", "manipulate with false information", "false info manipulation",
        "lie effectively", "how to lie",
        "trick someone", "trick method",
        "con someone",
        "hoodwink people"
    ]
    
    text_lower = text.lower()
    violations = []
    
    # Check single word triggers first
    for trigger in single_word_triggers:
        if re.search(rf"\b{re.escape(trigger)}\b", text_lower, re.IGNORECASE):
            violations.append({
                "policy_id": "F3",
                "trigger": trigger,
                "severity": "HIGH"
            })
    
    # Check multi-word triggers
    for trigger in multi_word_triggers:
        # Replace spaces with \s+ to allow flexible matching
        pattern = r"\b" + r"\s+".join(re.escape(word) for word in trigger.split()) + r"\b"
        if re.search(pattern, text_lower, re.IGNORECASE):
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

