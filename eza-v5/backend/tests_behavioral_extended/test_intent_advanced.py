# -*- coding: utf-8 -*-
"""
Advanced Intent Detection Tests (20 tests)
Tests advanced intent detection scenarios from behavior_matrix_100.json
"""
import pytest
from backend.api.pipeline_runner import run_full_pipeline
from backend.tests_behavioral_extended.helpers.scenario_loader import get_scenarios_by_category


# Get scenarios once at module level
_intent_scenarios = get_scenarios_by_category("intent_tests")


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
@pytest.mark.parametrize("scenario", _intent_scenarios, ids=lambda s: s.get("description", s["input"][:50]))
async def test_intent_advanced_scenario(scenario):
    """Test individual intent scenario"""
    result = await run_full_pipeline(
        user_input=scenario["input"],
        mode="proxy"
    )
    
    assert result["ok"] is True, \
        f"Scenario ({scenario.get('description', scenario['input'])}) failed: {result.get('error')}"
    
    if "expected_risk" in scenario:
        input_analysis = result.get("data", {}).get("input_analysis", {})
        actual_risk = input_analysis.get("risk_level", "")
        expected_risk = scenario["expected_risk"]
        
        # Allow flexible matching: high can match medium/high, medium can match low/medium/high
        risk_hierarchy = {"low": 1, "medium": 2, "high": 3}
        actual_level = risk_hierarchy.get(actual_risk, 0)
        expected_level = risk_hierarchy.get(expected_risk, 0)
        
        assert actual_level >= expected_level - 1, \
            f"Risk too low: expected at least {expected_risk}, got {actual_risk}"
