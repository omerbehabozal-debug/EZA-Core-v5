# -*- coding: utf-8 -*-
"""
Test Score Engine (10 tests)
"""

import pytest
from backend.core.engines.score_engine import compute_score
from backend.core.engines.input_analyzer import analyze_input
from backend.core.engines.output_analyzer import analyze_output
from backend.core.engines.alignment_engine import compute_alignment


def test_score_engine_safe_scenario():
    """Test score calculation for safe scenario"""
    input_analysis = analyze_input("What is the capital of France?")
    output_analysis = analyze_output("The capital is Paris.", input_analysis)
    alignment = compute_alignment(input_analysis, output_analysis)
    
    result = compute_score(input_analysis, output_analysis, alignment)
    assert result["final_score"] >= 70
    assert result["safety_level"] in ["green", "yellow"]


def test_score_engine_risky_scenario():
    """Test score calculation for risky scenario"""
    input_analysis = analyze_input("How to hack?")
    output_analysis = analyze_output("Here's how to hack...", input_analysis)
    alignment = compute_alignment(input_analysis, output_analysis)
    
    result = compute_score(input_analysis, output_analysis, alignment)
    assert result["final_score"] < 50
    assert result["safety_level"] in ["yellow", "red"]


def test_score_engine_score_range():
    """Test score is in valid range"""
    input_analysis = analyze_input("Test")
    output_analysis = analyze_output("Test output", input_analysis)
    alignment = compute_alignment(input_analysis, output_analysis)
    
    result = compute_score(input_analysis, output_analysis, alignment)
    assert 0.0 <= result["final_score"] <= 100.0


def test_score_engine_safety_levels():
    """Test safety level calculation"""
    test_cases = [
        (analyze_input("Safe"), analyze_output("Safe", analyze_input("Safe"))),
        (analyze_input("Risky"), analyze_output("Risky", analyze_input("Risky")))
    ]
    
    for input_analysis, output_analysis in test_cases:
        alignment = compute_alignment(input_analysis, output_analysis)
        result = compute_score(input_analysis, output_analysis, alignment)
        assert result["safety_level"] in ["green", "yellow", "red"]


def test_score_engine_confidence():
    """Test confidence calculation"""
    input_analysis = analyze_input("Test")
    output_analysis = analyze_output("Test output", input_analysis)
    alignment = compute_alignment(input_analysis, output_analysis)
    
    result = compute_score(input_analysis, output_analysis, alignment)
    assert 0.0 <= result["confidence"] <= 1.0


def test_score_engine_breakdown():
    """Test score breakdown structure"""
    input_analysis = analyze_input("Test")
    output_analysis = analyze_output("Test output", input_analysis)
    alignment = compute_alignment(input_analysis, output_analysis)
    
    result = compute_score(input_analysis, output_analysis, alignment)
    assert "breakdown" in result
    assert "input_risk" in result["breakdown"]
    assert "output_risk" in result["breakdown"]
    assert "alignment_score" in result["breakdown"]


def test_score_engine_with_redirect():
    """Test score with redirect"""
    input_analysis = analyze_input("Test")
    output_analysis = analyze_output("Test output", input_analysis)
    alignment = compute_alignment(input_analysis, output_analysis)
    redirect = {"redirect": True, "reason": "high_risk"}
    
    result = compute_score(input_analysis, output_analysis, alignment, redirect)
    assert result["final_score"] < 100


def test_score_engine_without_redirect():
    """Test score without redirect"""
    input_analysis = analyze_input("Test")
    output_analysis = analyze_output("Test output", input_analysis)
    alignment = compute_alignment(input_analysis, output_analysis)
    
    result = compute_score(input_analysis, output_analysis, alignment)
    assert result["final_score"] is not None


def test_score_engine_consistency():
    """Test score consistency"""
    input_analysis = analyze_input("Test")
    output_analysis = analyze_output("Test output", input_analysis)
    alignment = compute_alignment(input_analysis, output_analysis)
    
    result1 = compute_score(input_analysis, output_analysis, alignment)
    result2 = compute_score(input_analysis, output_analysis, alignment)
    
    assert abs(result1["final_score"] - result2["final_score"]) < 0.1


def test_score_engine_weighted_average():
    """Test weighted average calculation"""
    input_analysis = {"risk_score": 0.2}
    output_analysis = {"risk_score": 0.3}
    alignment = {"alignment_score": 80.0}
    
    result = compute_score(input_analysis, output_analysis, alignment)
    
    # Check that score reflects weighted average
    assert result["final_score"] > 0
    assert result["final_score"] < 100

