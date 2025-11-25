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
    """Get all test inputs"""
    matrix = load_model_consistency_matrix()
    return matrix.get("test_inputs", [])

