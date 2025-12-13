# -*- coding: utf-8 -*-
"""
Policy Test Scenario Loader
"""

import json
from pathlib import Path
from typing import Dict, Any, List


def load_policy_scenarios() -> Dict[str, Any]:
    """Load policy test scenarios from JSON"""
    # Try matrix_80 first, then extended, then original
    matrix_80_path = Path(__file__).parent / "policy_matrix_80.json"
    extended_path = Path(__file__).parent / "policy_scenarios_extended.json"
    original_path = Path(__file__).parent / "policy_scenarios.json"
    
    if matrix_80_path.exists():
        with open(matrix_80_path, "r", encoding="utf-8") as f:
            return json.load(f)
    elif extended_path.exists():
        with open(extended_path, "r", encoding="utf-8") as f:
            return json.load(f)
    elif original_path.exists():
        with open(original_path, "r", encoding="utf-8") as f:
            return json.load(f)
    else:
        raise FileNotFoundError(f"Policy scenarios not found")


def get_scenarios_by_policy(policy_id: str) -> List[Dict[str, Any]]:
    """Get scenarios for a specific policy"""
    scenarios = load_policy_scenarios()
    return scenarios.get(policy_id, [])


def get_all_scenarios() -> List[Dict[str, Any]]:
    """Get all scenarios"""
    scenarios = load_policy_scenarios()
    all_scenarios = []
    
    for policy_id, items in scenarios.items():
        for item in items:
            item["_policy_id"] = policy_id
            all_scenarios.append(item)
    
    return all_scenarios

