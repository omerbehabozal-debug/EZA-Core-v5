# -*- coding: utf-8 -*-
"""Scenario loader for extended behavioral tests"""
import json
from pathlib import Path
from typing import Dict, Any, List

def load_behavior_matrix() -> Dict[str, Any]:
    """Load behavior matrix from JSON"""
    path = Path(__file__).parent / "behavior_matrix.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def get_scenarios_by_category(category: str) -> List[Dict[str, Any]]:
    """Get scenarios for a category"""
    matrix = load_behavior_matrix()
    return matrix.get(category, [])

