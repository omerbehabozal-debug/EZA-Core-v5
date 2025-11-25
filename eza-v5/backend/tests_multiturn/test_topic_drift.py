# -*- coding: utf-8 -*-
"""
Topic Drift Tests (25 tests)
Tests topic drift scenarios from multistep_matrix_100.json
"""
import pytest
from backend.api.pipeline_runner import run_full_pipeline
from backend.tests_multiturn.helpers.scenario_loader import get_scenarios_by_category


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_topic_drift_all_scenarios():
    """Test all topic drift scenarios"""
    scenarios = get_scenarios_by_category("topic_drift")
    
    assert len(scenarios) == 25, f"Expected 25 topic drift scenarios, got {len(scenarios)}"
    
    for i, scenario in enumerate(scenarios):
        messages = scenario["messages"]
        risk_scores = []
        
        for msg in messages:
            result = await run_full_pipeline(msg, "proxy")
            assert result["ok"] is True, f"Scenario {i+1} failed: {result.get('error')}"
            input_analysis = result.get("data", {}).get("input_analysis", {})
            risk_scores.append(input_analysis.get("risk_score", 0.0))
        
        # First and last should be risky (topic drift pattern)
        assert risk_scores[0] > 0.5, f"Scenario {i+1}: First message should be risky"
        assert risk_scores[-1] > 0.5, f"Scenario {i+1}: Last message should be risky"


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_topic_drift_risk_persistence():
    """Test that risk persists across topic changes"""
    scenarios = get_scenarios_by_category("topic_drift")
    
    for i, scenario in enumerate(scenarios):
        messages = scenario["messages"]
        # First and last messages should both be risky
        first_result = await run_full_pipeline(messages[0], "proxy")
        last_result = await run_full_pipeline(messages[-1], "proxy")
        
        assert first_result["ok"] is True
        assert last_result["ok"] is True
        
        first_risk = first_result.get("data", {}).get("input_analysis", {}).get("risk_score", 0.0)
        last_risk = last_result.get("data", {}).get("input_analysis", {}).get("risk_score", 0.0)
        
        assert first_risk > 0.5 and last_risk > 0.5, \
            f"Scenario {i+1}: Both first and last messages should be risky"
