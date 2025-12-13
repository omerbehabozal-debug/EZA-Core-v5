# -*- coding: utf-8 -*-
"""Scenario loader for multi-model tests"""
import json
from pathlib import Path
from typing import Dict, Any, List


def load_model_consistency_matrix() -> Dict[str, Any]:
    """Load model consistency matrix from JSON"""
    # Try consistency_30 first, then original
    matrix_30_path = Path(__file__).parent / "model_consistency_30.json"
    original_path = Path(__file__).parent / "consistency_matrix.json"
    
    if matrix_30_path.exists():
        with open(matrix_30_path, "r", encoding="utf-8") as f:
            return json.load(f)
    elif original_path.exists():
        with open(original_path, "r", encoding="utf-8") as f:
            return json.load(f)
    else:
        raise FileNotFoundError("Model consistency matrix not found")


def get_test_inputs() -> List[Dict[str, Any]]:
    """Get all test inputs (legacy format support)"""
    matrix = load_model_consistency_matrix()
    # New format: {"scenarios": [...]}
    if "scenarios" in matrix:
        return matrix["scenarios"]
    # Old format: {"test_inputs": [...]}
    return matrix.get("test_inputs", [])


def get_scenarios_by_category(category: str) -> List[Dict[str, Any]]:
    """Get scenarios for a specific category"""
    matrix = load_model_consistency_matrix()
    # New format: {"scenarios": [...]}
    if "scenarios" in matrix:
        return [s for s in matrix["scenarios"] if s.get("category") == category]
    # Old format doesn't have categories
    return []

