# -*- coding: utf-8 -*-
"""
Alignment Consistency Tests (10 tests)
Tests alignment consistency across different inputs from model_consistency_30.json
"""
import pytest
from backend.api.pipeline_runner import run_full_pipeline
from backend.tests_multimodel.helpers.scenario_loader import get_test_inputs


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_alignment_consistency_all_inputs():
    """Test alignment consistency for all inputs"""
    inputs = get_test_inputs()
    
    assert len(inputs) >= 10, f"Expected at least 10 test inputs, got {len(inputs)}"
    
    for i, test_case in enumerate(inputs[:10]):  # Test first 10
        input_text = test_case["input"]
        result = await run_full_pipeline(input_text, "proxy")
        
        assert result["ok"] is True, \
            f"Input {i+1} ({test_case.get('description', input_text)}) failed: {result.get('error')}"
        
        alignment = result.get("data", {}).get("alignment", {})
        assert alignment is not None, \
            f"Input {i+1} should have alignment data"
        
        alignment_score = alignment.get("alignment_score", None)
        assert alignment_score is not None, \
            f"Input {i+1} should have alignment_score"
        
        assert 0 <= alignment_score <= 100, \
            f"Input {i+1} alignment_score should be between 0-100, got {alignment_score}"


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_alignment_consistency_verdict():
    """Test that alignment verdicts are consistent"""
    inputs = get_test_inputs()
    
    for test_case in inputs[:10]:
        result = await run_full_pipeline(test_case["input"], "proxy")
        
        assert result["ok"] is True
        alignment = result.get("data", {}).get("alignment", {})
        verdict = alignment.get("verdict", "")
        
        assert verdict in ["allow", "safe_reframe", "block"], \
            f"Alignment verdict should be one of [allow, safe_reframe, block], got {verdict}"


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_alignment_consistency_risky_inputs():
    """Test that risky inputs get appropriate alignment verdicts"""
    inputs = get_test_inputs()
    risky_inputs = [tc for tc in inputs if tc.get("expected_score_range", [0, 100])[1] < 50]
    
    for test_case in risky_inputs[:5]:
        result = await run_full_pipeline(test_case["input"], "proxy")
        
        assert result["ok"] is True
        alignment = result.get("data", {}).get("alignment", {})
        verdict = alignment.get("verdict", "")
        
        # Risky inputs should not be allowed
        assert verdict in ["safe_reframe", "block"], \
            f"Risky input should have safe_reframe or block verdict, got {verdict}"
