# -*- coding: utf-8 -*-
"""
Load Policy Map Helper
"""

import json
from pathlib import Path
from typing import Dict, Any, Optional


def load_policy_map() -> Dict[str, Any]:
    """Load policy map from JSON"""
    path = Path(__file__).parent.parent.parent / "policy_engine" / "policy_map.json"
    
    if not path.exists():
        raise FileNotFoundError(f"Policy map not found: {path}")
    
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_policy_by_id(policy_id: str) -> Optional[Dict[str, Any]]:
    """Get policy details by ID"""
    policy_map = load_policy_map()
    
    for policy in policy_map.get("policies", []):
        if policy.get("id") == policy_id:
            return policy
    
    return None


def get_policies_by_category(category: str) -> list[Dict[str, Any]]:
    """Get all policies for a category"""
    policy_map = load_policy_map()
    
    return [p for p in policy_map.get("policies", []) if p.get("category") == category]

