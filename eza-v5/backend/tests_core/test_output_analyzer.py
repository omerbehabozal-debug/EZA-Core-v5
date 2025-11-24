# -*- coding: utf-8 -*-
"""
Test Output Analyzer (10 tests)
"""

import pytest
from backend.core.engines.output_analyzer import analyze_output
from backend.core.engines.input_analyzer import analyze_input
from backend.tests_core.helpers.sample_inputs import SAFE_INPUTS, RISKY_INPUTS


def test_output_analyzer_safe_output():
    """Test analyzer with safe output"""
    input_analysis = analyze_input(SAFE_INPUTS[0])
    output = "The capital of France is Paris."
    result = analyze_output(output, input_analysis)
    assert result["ok"] is True
    assert result["risk_level"] == "low"
    assert result["risk_score"] < 0.3


def test_output_analyzer_risky_output():
    """Test analyzer with risky output"""
    input_analysis = analyze_input(SAFE_INPUTS[0])
    output = "Here's how to hack into a system..."
    result = analyze_output(output, input_analysis)
    assert result["ok"] is True
    assert result["risk_level"] in ["medium", "high"]
    assert result["risk_score"] > 0.5


def test_output_analyzer_quality_score():
    """Test quality score calculation"""
    input_analysis = analyze_input(SAFE_INPUTS[0])
    output = "This is a detailed response with substantial content."
    result = analyze_output(output, input_analysis)
    assert result["quality_score"] > 50


def test_output_analyzer_risk_flags():
    """Test risk flag detection in output"""
    input_analysis = analyze_input(SAFE_INPUTS[0])
    output = "You can harm someone by..."
    result = analyze_output(output, input_analysis)
    assert len(result["risk_flags"]) > 0


def test_output_analyzer_empty_output():
    """Test empty output handling"""
    input_analysis = analyze_input(SAFE_INPUTS[0])
    result = analyze_output("", input_analysis)
    assert result["ok"] is True
    assert result["output_length"] == 0


def test_output_analyzer_output_length():
    """Test output length tracking"""
    input_analysis = analyze_input(SAFE_INPUTS[0])
    output = "A" * 200
    result = analyze_output(output, input_analysis)
    assert result["output_length"] == 200


def test_output_analyzer_without_input_analysis():
    """Test output analysis without input analysis"""
    output = "This is a test output."
    result = analyze_output(output)
    assert result["ok"] is True


def test_output_analyzer_risk_escalation():
    """Test that risky output increases risk"""
    input_analysis = analyze_input(SAFE_INPUTS[0])
    safe_output = "This is a safe response."
    risky_output = "Here's how to commit fraud..."
    
    safe_result = analyze_output(safe_output, input_analysis)
    risky_result = analyze_output(risky_output, input_analysis)
    
    assert risky_result["risk_score"] > safe_result["risk_score"]


def test_output_analyzer_consistency():
    """Test analyzer consistency"""
    input_analysis = analyze_input(SAFE_INPUTS[0])
    output = "This is a test output."
    
    result1 = analyze_output(output, input_analysis)
    result2 = analyze_output(output, input_analysis)
    
    assert result1["risk_level"] == result2["risk_level"]


def test_output_analyzer_risk_score_range():
    """Test risk score is in valid range"""
    input_analysis = analyze_input(SAFE_INPUTS[0])
    test_outputs = [
        "Safe output text.",
        "Risky output with harmful content."
    ]
    
    for output in test_outputs:
        result = analyze_output(output, input_analysis)
        assert 0.0 <= result["risk_score"] <= 1.0

