# -*- coding: utf-8 -*-
"""
Test Alignment Engine (10 tests)
"""

import pytest
from backend.core.engines.alignment_engine import compute_alignment
from backend.core.engines.input_analyzer import analyze_input
from backend.core.engines.output_analyzer import analyze_output


def test_alignment_engine_safe_alignment():
    """Test alignment with safe input and output"""
    input_analysis = analyze_input("What is the capital of France?")
    output_analysis = analyze_output("The capital of France is Paris.", input_analysis)
    
    result = compute_alignment(input_analysis, output_analysis)
    assert result["alignment_score"] >= 80
    assert result["verdict"] == "aligned"
    assert result["label"] == "Safe"


def test_alignment_engine_risky_output():
    """Test alignment with risky output"""
    input_analysis = analyze_input("What is the capital of France?")
    output_analysis = analyze_output("Here's how to hack...", input_analysis)
    
    result = compute_alignment(input_analysis, output_analysis)
    assert result["alignment_score"] < 60
    assert result["verdict"] in ["misaligned", "partially_aligned"]


def test_alignment_engine_risk_delta():
    """Test risk delta calculation"""
    input_analysis = analyze_input("Safe question")
    output_analysis = analyze_output("Risky response", input_analysis)
    
    result = compute_alignment(input_analysis, output_analysis)
    assert result["risk_delta"] > 0


def test_alignment_engine_label_types():
    """Test label types"""
    test_cases = [
        (analyze_input("Safe"), analyze_output("Safe response", analyze_input("Safe"))),
        (analyze_input("Risky"), analyze_output("Risky response", analyze_input("Risky")))
    ]
    
    for input_analysis, output_analysis in test_cases:
        result = compute_alignment(input_analysis, output_analysis)
        assert result["label"] in ["Safe", "Warning", "Blocked"]


def test_alignment_engine_alignment_score_range():
    """Test alignment score is in valid range"""
    input_analysis = analyze_input("Test input")
    output_analysis = analyze_output("Test output", input_analysis)
    
    result = compute_alignment(input_analysis, output_analysis)
    assert 0.0 <= result["alignment_score"] <= 100.0


def test_alignment_engine_verdict_types():
    """Test verdict types"""
    input_analysis = analyze_input("Test")
    output_analysis = analyze_output("Test output", input_analysis)
    
    result = compute_alignment(input_analysis, output_analysis)
    assert result["verdict"] in ["aligned", "partially_aligned", "misaligned", "uncertain"]


def test_alignment_engine_input_risk_tracking():
    """Test input risk is tracked"""
    input_analysis = analyze_input("Risky input")
    output_analysis = analyze_output("Output", input_analysis)
    
    result = compute_alignment(input_analysis, output_analysis)
    assert "input_risk" in result
    assert result["input_risk"] == input_analysis["risk_score"]


def test_alignment_engine_output_risk_tracking():
    """Test output risk is tracked"""
    input_analysis = analyze_input("Input")
    output_analysis = analyze_output("Risky output", input_analysis)
    
    result = compute_alignment(input_analysis, output_analysis)
    assert "output_risk" in result
    assert result["output_risk"] == output_analysis["risk_score"]


def test_alignment_engine_consistency():
    """Test alignment consistency"""
    input_analysis = analyze_input("Test input")
    output_analysis = analyze_output("Test output", input_analysis)
    
    result1 = compute_alignment(input_analysis, output_analysis)
    result2 = compute_alignment(input_analysis, output_analysis)
    
    assert result1["alignment_score"] == result2["alignment_score"]
    assert result1["verdict"] == result2["verdict"]


def test_alignment_engine_edge_cases():
    """Test edge cases"""
    # Empty input analysis
    input_analysis = {"risk_score": 0.0, "risk_level": "low"}
    output_analysis = analyze_output("Output", None)
    
    result = compute_alignment(input_analysis, output_analysis)
    assert result["ok"] is not False  # Should not crash

