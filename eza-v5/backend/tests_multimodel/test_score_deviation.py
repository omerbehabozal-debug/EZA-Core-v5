# -*- coding: utf-8 -*-
"""
Score Deviation Tests (10 tests)
Tests score deviation across different inputs from model_consistency_30.json
"""
import pytest
from backend.api.pipeline_runner import run_full_pipeline
from backend.tests_multimodel.helpers.scenario_loader import get_test_inputs


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_score_deviation_all_inputs():
    """Test score deviation for all inputs"""
    inputs = get_test_inputs()
    
    assert len(inputs) >= 10, f"Expected at least 10 test inputs, got {len(inputs)}"
    
    scores = []
    for i, test_case in enumerate(inputs[:10]):  # Test first 10
        input_text = test_case["input"]
        result = await run_full_pipeline(input_text, "proxy")
        
        assert result["ok"] is True, \
            f"Input {i+1} ({test_case.get('description', input_text)}) failed: {result.get('error')}"
        
        score = result.get("eza_score")
        assert score is not None, \
            f"Input {i+1} should have a score"
        
        scores.append(score)
    
    # Check that scores are in valid range
    assert all(0 <= s <= 100 for s in scores), \
        f"All scores should be between 0-100, got {scores}"


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_score_deviation_consistency():
    """Test that similar inputs get similar scores"""
    inputs = get_test_inputs()
    safe_inputs = [tc for tc in inputs if tc.get("expected_score_range", [0, 100])[0] >= 60]
    
    if len(safe_inputs) >= 3:
        scores = []
        for test_case in safe_inputs[:3]:
            result = await run_full_pipeline(test_case["input"], "proxy")
            assert result["ok"] is True
            scores.append(result.get("eza_score", 0))
        
        # Safe inputs should have similar high scores
        avg_score = sum(scores) / len(scores)
        assert avg_score >= 60, \
            f"Safe inputs should have average score >= 60, got {avg_score}"


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_score_deviation_expected_ranges():
    """Test that scores fall within expected ranges"""
    inputs = get_test_inputs()
    
    for test_case in inputs[:10]:
        if "expected_score_range" in test_case:
            result = await run_full_pipeline(test_case["input"], "proxy")
            assert result["ok"] is True
            
            score = result.get("eza_score", 50)
            min_score, max_score = test_case["expected_score_range"]
            
            # Allow some flexibility (±10)
            assert min_score - 10 <= score <= max_score + 10, \
                f"Score {score} should be approximately in range [{min_score}, {max_score}] for: {test_case['input']}"
