# -*- coding: utf-8 -*-
"""
Schema Validator for Testing
Validates pipeline response schemas
"""

from typing import Dict, Any, List, Optional


def validate_pipeline_response(response: Dict[str, Any]) -> tuple:
    """
    Validate pipeline response schema
    
    Args:
        response: Pipeline response dictionary
    
    Returns:
        Tuple of (is_valid, list_of_errors)
    """
    errors: List[str] = []
    
    # Required top-level fields
    required_fields = ["ok", "mode", "eza_score", "eza_score_breakdown", "data", "error"]
    for field in required_fields:
        if field not in response:
            errors.append(f"Missing required field: {field}")
    
    # Validate 'ok' field
    if "ok" in response and not isinstance(response["ok"], bool):
        errors.append("Field 'ok' must be a boolean")
    
    # Validate 'mode' field
    if "mode" in response:
        valid_modes = ["standalone", "proxy", "proxy-lite"]
        if response["mode"] not in valid_modes:
            errors.append(f"Field 'mode' must be one of {valid_modes}, got: {response['mode']}")
    
    # Validate 'eza_score' field (should be float or None)
    if "eza_score" in response:
        if response["eza_score"] is not None and not isinstance(response["eza_score"], (int, float)):
            errors.append("Field 'eza_score' must be a number or None")
        elif response["eza_score"] is not None:
            score = float(response["eza_score"])
            if score < 0 or score > 100:
                errors.append(f"Field 'eza_score' must be between 0 and 100, got: {score}")
    
    # Validate 'eza_score_breakdown' field (should be dict or None)
    if "eza_score_breakdown" in response:
        if response["eza_score_breakdown"] is not None and not isinstance(response["eza_score_breakdown"], dict):
            errors.append("Field 'eza_score_breakdown' must be a dictionary or None")
    
    # Validate 'data' field (should be dict or None)
    if "data" in response:
        if response["data"] is not None and not isinstance(response["data"], dict):
            errors.append("Field 'data' must be a dictionary or None")
    
    # Validate 'error' field (should be dict or None)
    if "error" in response:
        if response["error"] is not None:
            if not isinstance(response["error"], dict):
                errors.append("Field 'error' must be a dictionary or None")
            else:
                # Validate error structure
                if "error_code" not in response["error"]:
                    errors.append("Error dictionary must contain 'error_code' field")
                if "error_message" not in response["error"]:
                    errors.append("Error dictionary must contain 'error_message' field")
    
    # Mode-specific data validation
    if response.get("ok") and response.get("data"):
        mode = response.get("mode")
        data = response["data"]
        
        if mode == "standalone":
            if "safe_answer" not in data:
                errors.append("Standalone mode data must contain 'safe_answer' field")
        
        elif mode == "proxy":
            required_proxy_fields = ["raw_output", "safe_answer", "input_analysis", 
                                    "output_analysis", "alignment"]
            for field in required_proxy_fields:
                if field not in data:
                    errors.append(f"Proxy mode data must contain '{field}' field")
        
        elif mode == "proxy-lite":
            required_lite_fields = ["risk_level", "safety_level", "summary", "recommendation"]
            for field in required_lite_fields:
                if field not in data:
                    errors.append(f"Proxy-lite mode data must contain '{field}' field")
    
    return len(errors) == 0, errors

