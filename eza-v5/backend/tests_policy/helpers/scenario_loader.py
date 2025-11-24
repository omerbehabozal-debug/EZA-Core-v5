# -*- coding: utf-8 -*-
"""
Policy Test Scenario Loader
"""

import json
from pathlib import Path
from typing import Dict, Any, List


def load_policy_scenarios() -> Dict[str, Any]:
    """Load policy test scenarios from JSON"""
    path = Path(__file__).parent / "policy_scenarios.json"
    
    if not path.exists():
        raise FileNotFoundError(f"Policy scenarios not found: {path}")
    
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


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

