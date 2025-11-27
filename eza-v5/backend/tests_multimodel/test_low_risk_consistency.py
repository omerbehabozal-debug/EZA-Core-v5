# -*- coding: utf-8 -*-
"""
Low Risk Consistency Tests (10 tests)
Tests model consistency for low-risk scenarios from model_consistency_30.json

Tests 3 different providers (OpenAI, Groq, Mistral) and checks:
- Score deviation < max_score_deviation
- Alignment consistency < max_alignment_diff
- Safe answer consistency
"""
import pytest
from backend.tests_multimodel.helpers.scenario_loader import get_scenarios_by_category
from backend.tests_multimodel.helpers.ensemble_helper import run_ensemble_test


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
@pytest.mark.parametrize("scenario", [
    pytest.param(s, id=s["id"]) for s in get_scenarios_by_category("low_risk")
])
async def test_low_risk_consistency_scenario(scenario):
    """Test consistency across 3 different providers for low-risk scenario"""
    input_text = scenario["input"]
    expected = scenario["expected"]
    
    # Run ensemble test with 3 providers
    ensemble_data = await run_ensemble_test(user_input=input_text)
    
    # Check we got results from at least 2 models (some may fail)
    scores = ensemble_data["scores"]
    assert len(scores) >= 2, \
        f"Scenario {scenario['id']}: Need at least 2 successful model responses, got {len(scores)}"
    
    # Check score deviation
    max_score = max(scores)
    min_score = min(scores)
    score_deviation = max_score - min_score
    
    assert score_deviation <= expected["max_score_deviation"], \
        f"Scenario {scenario['id']}: Score deviation {score_deviation} should be <= {expected['max_score_deviation']}, scores: {scores}"
    
    # Check alignment consistency
    alignment_scores = ensemble_data["alignment_scores"]
    if len(alignment_scores) > 1:
        max_align = max(alignment_scores)
        min_align = min(alignment_scores)
        alignment_diff = abs(max_align - min_align) / 100.0  # Normalize to 0-1
        
        assert alignment_diff <= expected["max_alignment_diff"], \
            f"Scenario {scenario['id']}: Alignment diff {alignment_diff:.3f} should be <= {expected['max_alignment_diff']}, alignment scores: {alignment_scores}"
    
    # Check safe answer consistency (all safe answers should be similar)
    safe_answers = [sa for sa in ensemble_data["safe_answers"] if sa]
    if len(safe_answers) >= 2:
        # Check that safe answers are not completely different
        # (they should have similar content for low-risk scenarios)
        unique_answers = set(safe_answers)
        # For low-risk, all answers should be similar (at most 2 unique answers)
        assert len(unique_answers) <= 2, \
            f"Scenario {scenario['id']}: Safe answers too inconsistent, {len(unique_answers)} unique answers: {safe_answers[:2]}"



