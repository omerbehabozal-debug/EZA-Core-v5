# -*- coding: utf-8 -*-
"""
Test Input Analyzer (10 tests)
"""

import pytest
from backend.core.engines.input_analyzer import analyze_input
from backend.tests_core.helpers.sample_inputs import SAFE_INPUTS, RISKY_INPUTS
from backend.test_tools.assert_tools import assert_pipeline_success


def test_input_analyzer_safe_input():
    """Test analyzer with safe input"""
    result = analyze_input(SAFE_INPUTS[0])
    assert result["ok"] is True
    assert result["risk_level"] == "low"
    assert result["risk_score"] < 0.3


def test_input_analyzer_risky_input():
    """Test analyzer with risky input"""
    result = analyze_input(RISKY_INPUTS[0])
    assert result["ok"] is True
    assert result["risk_level"] in ["medium", "high"]
    assert result["risk_score"] > 0.5


def test_input_analyzer_intent_detection():
    """Test intent detection"""
    result = analyze_input("What is the capital of France?")
    assert result["intent"] == "question"
    
    result2 = analyze_input("Hello, how are you?")
    assert result2["intent"] == "greeting"
    
    result3 = analyze_input("Create a story")
    assert result3["intent"] == "generation"


def test_input_analyzer_risk_flags():
    """Test risk flag detection"""
    result = analyze_input("How to harm someone?")
    assert len(result["risk_flags"]) > 0
    assert "violence" in result["risk_flags"] or "harmful" in result["risk_flags"]


def test_input_analyzer_empty_input():
    """Test empty input handling"""
    result = analyze_input("")
    assert result["ok"] is True
    assert result["text_length"] == 0


def test_input_analyzer_long_input():
    """Test long input handling"""
    long_input = "This is a very long input. " * 100
    result = analyze_input(long_input)
    assert result["ok"] is True
    assert result["text_length"] > 1000


def test_input_analyzer_special_characters():
    """Test special characters handling"""
    special_input = "Test with special chars: !@#$%^&*()"
    result = analyze_input(special_input)
    assert result["ok"] is True


def test_input_analyzer_unicode():
    """Test unicode handling"""
    unicode_input = "Test with unicode: 你好世界 🌍"
    result = analyze_input(unicode_input)
    assert result["ok"] is True


def test_input_analyzer_risk_score_range():
    """Test risk score is in valid range"""
    for input_text in SAFE_INPUTS + RISKY_INPUTS:
        result = analyze_input(input_text)
        assert 0.0 <= result["risk_score"] <= 1.0


def test_input_analyzer_consistency():
    """Test analyzer consistency"""
    result1 = analyze_input(SAFE_INPUTS[0])
    result2 = analyze_input(SAFE_INPUTS[0])
    assert result1["risk_level"] == result2["risk_level"]
    assert abs(result1["risk_score"] - result2["risk_score"]) < 0.1

