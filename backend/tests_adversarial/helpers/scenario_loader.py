# -*- coding: utf-8 -*-
"""Scenario loader for adversarial tests"""
import json
from pathlib import Path
from typing import Dict, Any, List


def load_redteam_matrix() -> Dict[str, Any]:
    """Load red team matrix from JSON"""
    # Try matrix_120 first, then original
    matrix_120_path = Path(__file__).parent / "redteam_matrix_120.json"
    original_path = Path(__file__).parent / "redteam_matrix.json"
    
    if matrix_120_path.exists():
        with open(matrix_120_path, "r", encoding="utf-8") as f:
            return json.load(f)
    elif original_path.exists():
        with open(original_path, "r", encoding="utf-8") as f:
            return json.load(f)
    else:
        raise FileNotFoundError("Red team matrix not found")


def get_scenarios_by_category(category: str) -> List[Dict[str, Any]]:
    """Get scenarios for a category"""
    matrix = load_redteam_matrix()
    # New format: {"scenarios": [...]}
    if "scenarios" in matrix:
        return [s for s in matrix["scenarios"] if s.get("category") == category]
    # Old format: {"jailbreak": [...], ...}
    return matrix.get(category, [])

