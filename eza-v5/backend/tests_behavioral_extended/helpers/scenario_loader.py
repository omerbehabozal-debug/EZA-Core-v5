# -*- coding: utf-8 -*-
"""Scenario loader for extended behavioral tests"""
import json
from pathlib import Path
from typing import Dict, Any, List

def load_behavior_matrix() -> Dict[str, Any]:
    """Load behavior matrix from JSON"""
    # Try 100-scenario file first, fallback to original
    path_100 = Path(__file__).parent / "behavior_matrix_100.json"
    path_original = Path(__file__).parent / "behavior_matrix.json"
    
    if path_100.exists():
        with open(path_100, "r", encoding="utf-8") as f:
            return json.load(f)
    elif path_original.exists():
        with open(path_original, "r", encoding="utf-8") as f:
            return json.load(f)
    else:
        raise FileNotFoundError("Behavior matrix not found")

def get_scenarios_by_category(category: str) -> List[Dict[str, Any]]:
    """Get scenarios for a category"""
    matrix = load_behavior_matrix()
    return matrix.get(category, [])

