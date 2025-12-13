# -*- coding: utf-8 -*-
"""
Scenario Loader for Behavioral Tests
Loads test scenarios from JSON file
"""

import json
from pathlib import Path
from typing import Dict, Any, List


def load_scenarios() -> Dict[str, Any]:
    """
    Load test scenarios from scenarios.json
    
    Returns:
        Dictionary containing all test scenarios by category
    """
    path = Path(__file__).parent / "scenarios.json"
    
    if not path.exists():
        raise FileNotFoundError(f"Scenarios file not found: {path}")
    
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_scenarios_by_category(category: str) -> List[Dict[str, Any]]:
    """
    Get scenarios for a specific category
    
    Args:
        category: Category name (e.g., "intent_tests", "deception_tests")
    
    Returns:
        List of scenarios for the category
    """
    scenarios = load_scenarios()
    return scenarios.get(category, [])


def get_all_scenarios() -> List[Dict[str, Any]]:
    """
    Get all scenarios flattened into a single list
    
    Returns:
        List of all scenarios with category information
    """
    scenarios = load_scenarios()
    all_scenarios = []
    
    for category, items in scenarios.items():
        for item in items:
            item["_category"] = category
            all_scenarios.append(item)
    
    return all_scenarios

