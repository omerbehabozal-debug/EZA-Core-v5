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
            data = json.load(f)
            # Check if new format (has "scenarios" key) or old format
            if "scenarios" in data:
                return data
            else:
                # Old format - convert on the fly
                return {"scenarios": []}
    elif original_path.exists():
        with open(original_path, "r", encoding="utf-8") as f:
            return json.load(f)
    else:
        raise FileNotFoundError("Multi-turn scenarios not found")


def get_scenarios_by_category(category: str) -> List[Dict[str, Any]]:
    """Get scenarios for a category"""
    data = load_multistep_scenarios()
    
    # New format: has "scenarios" key
    if "scenarios" in data:
        return [s for s in data["scenarios"] if s.get("category") == category]
    else:
        # Old format: categories are keys
        return data.get(category, [])

