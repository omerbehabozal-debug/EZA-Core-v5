# -*- coding: utf-8 -*-
"""
Policy Evaluator
Evaluates AI Safety Constitution policies against input and output
"""

from typing import Dict, Any, List, Tuple, Optional
import json
from pathlib import Path

from backend.policy_engine.N_policies import evaluate_N_policies
from backend.policy_engine.F_policies import evaluate_F_policies
from backend.policy_engine.Z_policies import evaluate_Z_policies
from backend.policy_engine.A_policies import evaluate_A_policies


def load_policy_map() -> Dict[str, Any]:
    """Load policy map from JSON"""
    path = Path(__file__).parent / "policy_map.json"
    
    if not path.exists():
        raise FileNotFoundError(f"Policy map not found: {path}")
    
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def evaluate_policies(
    input_text: str,
    output_text: Optional[str] = None
) -> Tuple[List[str], float]:
    """
    Evaluate policies against input and output text
    
    Args:
        input_text: User input text
        output_text: Optional output text to evaluate
    
    Returns:
        Tuple of (violation_ids, total_risk_modifier)
    """
    violations: List[str] = []
    risk_modifiers: List[float] = []
    
    # Evaluate input
    input_results = []
    input_results.extend(evaluate_N_policies(input_text))
    input_results.extend(evaluate_F_policies(input_text))
    input_results.extend(evaluate_Z_policies(input_text))
    input_results.extend(evaluate_A_policies(input_text))
    
    # Collect violations and risk modifiers from input
    for result in input_results:
        for violation in result.get("violations", []):
            policy_id = violation.get("policy_id")
            if policy_id and policy_id not in violations:
                violations.append(policy_id)
            risk_modifiers.append(result.get("risk_modifier", 0.0))
    
    # Evaluate output if provided
    if output_text:
        output_results = []
        output_results.extend(evaluate_N_policies(output_text))
        output_results.extend(evaluate_F_policies(output_text))
        output_results.extend(evaluate_Z_policies(output_text))
        output_results.extend(evaluate_A_policies(output_text))
        
        # Collect violations and risk modifiers from output
        for result in output_results:
            for violation in result.get("violations", []):
                policy_id = violation.get("policy_id")
                if policy_id and policy_id not in violations:
                    violations.append(policy_id)
            risk_modifiers.append(result.get("risk_modifier", 0.0))
    
    # Calculate total risk modifier (use maximum, not sum)
    total_risk_modifier = max(risk_modifiers) if risk_modifiers else 0.0
    
    return violations, total_risk_modifier


def get_policy_details(policy_id: str) -> Optional[Dict[str, Any]]:
    """
    Get details for a specific policy
    
    Args:
        policy_id: Policy ID (e.g., "N1", "F2")
    
    Returns:
        Policy details dictionary or None
    """
    policy_map = load_policy_map()
    
    for policy in policy_map.get("policies", []):
        if policy.get("id") == policy_id:
            return policy
    
    return None


def get_policy_flags(violations: List[str]) -> Dict[str, Any]:
    """
    Get policy flags for alignment engine
    
    Args:
        violations: List of violated policy IDs
    
    Returns:
        Dictionary of policy flags
    """
    flags = {
        "has_critical": False,
        "has_high": False,
        "has_medium": False,
        "violation_count": len(violations),
        "categories": set()
    }
    
    policy_map = load_policy_map()
    
    for violation_id in violations:
        policy = get_policy_details(violation_id)
        if policy:
            severity = policy.get("severity", "").upper()
            if severity == "CRITICAL":
                flags["has_critical"] = True
            elif severity == "HIGH":
                flags["has_high"] = True
            elif severity == "MEDIUM":
                flags["has_medium"] = True
            
            category = policy.get("category", "")
            if category:
                flags["categories"].add(category)
    
    flags["categories"] = list(flags["categories"])
    
    return flags


def calculate_score_adjustment(violations: List[str], risk_modifier: float) -> float:
    """
    Calculate score adjustment based on policy violations
    
    Args:
        violations: List of violated policy IDs
        risk_modifier: Total risk modifier from evaluation
    
    Returns:
        Score adjustment (negative value to subtract from score)
    """
    if not violations:
        return 0.0
    
    # Base adjustment from risk modifier (more aggressive)
    base_adjustment = risk_modifier * 55.0  # Increased from 50.0 to 55.0 for better penalty
    
    # Additional penalty for critical violations
    policy_map = load_policy_map()
    critical_count = 0
    
    for violation_id in violations:
        policy = get_policy_details(violation_id)
        if policy and policy.get("severity", "").upper() == "CRITICAL":
            critical_count += 1
    
    # Extra penalty for critical violations
    critical_penalty = critical_count * 10.0
    
    return -(base_adjustment + critical_penalty)

