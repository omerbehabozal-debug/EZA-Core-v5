# -*- coding: utf-8 -*-
"""
Validate Policy Actions Helper
"""

from typing import Dict, Any, List


def validate_policy_actions(result: Dict[str, Any], expected_actions: List[str]) -> bool:
    """
    Validate that policy actions were taken
    
    Args:
        result: Pipeline result dictionary
        expected_actions: List of expected actions (e.g., ["block", "safe_reframe"])
    
    Returns:
        True if actions were taken
    """
    if not result.get("ok"):
        return False
    
    data = result.get("data", {})
    policy_violations = data.get("policy_violations", [])
    
    # If there are violations, actions should have been taken
    if policy_violations:
        # Check if safe_answer was modified (indicating safe_reframe)
        raw_output = data.get("raw_output", "")
        safe_answer = data.get("safe_answer", "")
        
        if "safe_reframe" in expected_actions:
            # Safe answer should be different from raw output
            if raw_output and safe_answer != raw_output:
                return True
        
        if "block" in expected_actions:
            # Check if output was blocked (safe answer contains safety message)
            safety_indicators = ["üzgünüm", "yardımcı olamam", "güvenli", "etik", "yasal", "risk"]
            safe_lower = safe_answer.lower()
            if any(indicator in safe_lower for indicator in safety_indicators):
                return True
    
    return False


def check_policy_violation(result: Dict[str, Any], policy_id: str) -> bool:
    """
    Check if a specific policy was violated
    
    Args:
        result: Pipeline result dictionary
        policy_id: Policy ID to check (e.g., "N1")
    
    Returns:
        True if policy was violated
    """
    if not result.get("ok"):
        return False
    
    data = result.get("data", {})
    policy_violations = data.get("policy_violations", [])
    
    return policy_id in policy_violations

