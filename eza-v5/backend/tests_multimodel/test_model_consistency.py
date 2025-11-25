# -*- coding: utf-8 -*-
"""
Model Consistency Tests (10 tests)
Tests model consistency across different inputs from model_consistency_30.json
"""
import pytest
from backend.api.pipeline_runner import run_full_pipeline
from backend.tests_multimodel.helpers.scenario_loader import get_test_inputs


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_model_consistency_all_inputs():
    """Test consistency across models for all inputs"""
    inputs = get_test_inputs()
    
    assert len(inputs) >= 10, f"Expected at least 10 test inputs, got {len(inputs)}"
    
    for i, test_case in enumerate(inputs[:10]):  # Test first 10
        input_text = test_case["input"]
        result = await run_full_pipeline(input_text, "proxy")
        
        assert result["ok"] is True, \
            f"Input {i+1} ({test_case.get('description', input_text)}) failed: {result.get('error')}"
        
        assert result["eza_score"] is not None, \
            f"Input {i+1} should have a score"
        
        assert 0 <= result["eza_score"] <= 100, \
            f"Input {i+1} score should be between 0-100, got {result['eza_score']}"
        
        # Check score is in expected range if specified
        if "expected_score_range" in test_case:
            min_score, max_score = test_case["expected_score_range"]
            assert min_score <= result["eza_score"] <= max_score, \
                f"Input {i+1} score should be in range [{min_score}, {max_score}], got {result['eza_score']}"


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_model_consistency_safe_inputs():
    """Test that safe inputs consistently get high scores"""
    inputs = get_test_inputs()
    safe_inputs = [tc for tc in inputs if tc.get("expected_score_range", [0, 100])[0] >= 60]
    
    for test_case in safe_inputs[:5]:  # Test first 5 safe inputs
        result = await run_full_pipeline(test_case["input"], "proxy")
        
        assert result["ok"] is True
        assert result.get("eza_score", 0) >= 50, \
            f"Safe input should have score >= 50, got {result.get('eza_score')}"


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_model_consistency_risky_inputs():
    """Test that risky inputs consistently get low scores"""
    inputs = get_test_inputs()
    risky_inputs = [tc for tc in inputs if tc.get("expected_score_range", [0, 100])[1] < 50]
    
    for test_case in risky_inputs[:5]:  # Test first 5 risky inputs
        result = await run_full_pipeline(test_case["input"], "proxy")
        
        assert result["ok"] is True
        assert result.get("eza_score", 100) < 50, \
            f"Risky input should have score < 50, got {result.get('eza_score')}"
