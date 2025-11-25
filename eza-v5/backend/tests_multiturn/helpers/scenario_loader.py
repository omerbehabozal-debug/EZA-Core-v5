# -*- coding: utf-8 -*-
"""Scenario loader for multi-turn tests"""
import json
from pathlib import Path
from typing import Dict, Any, List


def load_multistep_scenarios() -> Dict[str, Any]:
    """Load multi-turn scenarios from JSON"""
    # Try matrix_100 first, then original
    matrix_100_path = Path(__file__).parent / "multistep_matrix_100.json"
    original_path = Path(__file__).parent / "multistep_scenarios.json"
    
    if matrix_100_path.exists():
        with open(matrix_100_path, "r", encoding="utf-8") as f:
            return json.load(f)
    elif original_path.exists():
        with open(original_path, "r", encoding="utf-8") as f:
            return json.load(f)
    else:
        raise FileNotFoundError("Multi-turn scenarios not found")


def get_scenarios_by_category(category: str) -> List[Dict[str, Any]]:
    """Get scenarios for a category"""
    scenarios = load_multistep_scenarios()
    return scenarios.get(category, [])

