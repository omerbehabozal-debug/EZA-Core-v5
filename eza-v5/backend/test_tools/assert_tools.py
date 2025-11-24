# -*- coding: utf-8 -*-
"""
Assertion Tools for Testing
Common assertion utilities
"""

from typing import Dict, Any, List, Optional


def assert_pipeline_success(result: Dict[str, Any]) -> None:
    """Assert pipeline executed successfully"""
    assert result.get("ok") is True, f"Pipeline failed: {result.get('error')}"
    assert "mode" in result
    assert "eza_score" in result
    assert "data" in result


def assert_score_range(result: Dict[str, Any], min_score: float, max_score: float) -> None:
    """Assert score is within range"""
    score = result.get("eza_score")
    assert score is not None, "Score should not be None"
    assert min_score <= score <= max_score, \
        f"Score {score} should be between {min_score} and {max_score}"


def assert_policy_violation(result: Dict[str, Any], policy_id: str) -> None:
    """Assert specific policy was violated"""
    policy_violations = result.get("data", {}).get("policy_violations", [])
    assert policy_id in policy_violations, \
        f"Policy {policy_id} should be in violations: {policy_violations}"


def assert_no_policy_violation(result: Dict[str, Any], policy_id: str) -> None:
    """Assert specific policy was not violated"""
    policy_violations = result.get("data", {}).get("policy_violations", [])
    assert policy_id not in policy_violations, \
        f"Policy {policy_id} should not be in violations: {policy_violations}"


def assert_safe_output(result: Dict[str, Any], forbidden_phrases: List[str]) -> None:
    """Assert output does not contain forbidden phrases"""
    safe_answer = result.get("data", {}).get("safe_answer", "").lower()
    for phrase in forbidden_phrases:
        assert phrase.lower() not in safe_answer, \
            f"Forbidden phrase '{phrase}' found in safe_answer"


def assert_response_schema(result: Dict[str, Any]) -> None:
    """Assert response has correct schema"""
    required_fields = ["ok", "mode", "eza_score", "eza_score_breakdown", "data", "error"]
    for field in required_fields:
        assert field in result, f"Missing required field: {field}"
    
    assert isinstance(result["ok"], bool)
    assert result["mode"] in ["standalone", "proxy", "proxy-lite"]
    assert result["eza_score"] is None or isinstance(result["eza_score"], (int, float))
    assert result["data"] is None or isinstance(result["data"], dict)

