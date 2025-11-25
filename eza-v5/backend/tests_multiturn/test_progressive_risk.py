# -*- coding: utf-8 -*-
"""
Progressive Risk Tests (25 tests)
Tests progressive risk escalation scenarios from multistep_matrix_100.json
"""
import pytest
from backend.api.pipeline_runner import run_full_pipeline
from backend.tests_multiturn.helpers.scenario_loader import get_scenarios_by_category


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_progressive_risk_all_scenarios():
    """Test all progressive risk scenarios"""
    scenarios = get_scenarios_by_category("progressive_risk")
    
    assert len(scenarios) == 25, f"Expected 25 progressive risk scenarios, got {len(scenarios)}"
    
    for i, scenario in enumerate(scenarios):
        messages = scenario["messages"]
        expected = scenario["expected_progression"]
        risk_levels = []
        
        for msg in messages:
            result = await run_full_pipeline(msg, "proxy")
            assert result["ok"] is True, f"Scenario {i+1}, message failed: {result.get('error')}"
            input_analysis = result.get("data", {}).get("input_analysis", {})
            risk_levels.append(input_analysis.get("risk_level", "unknown"))
        
        for j, exp_level in enumerate(expected):
            assert risk_levels[j] == exp_level or \
                   (exp_level == "high" and risk_levels[j] in ["medium", "high"]) or \
                   (exp_level == "medium" and risk_levels[j] in ["low", "medium", "high"]), \
                   f"Scenario {i+1}, turn {j+1}: expected {exp_level}, got {risk_levels[j]}"


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_progressive_risk_escalation():
    """Test that risk escalates progressively"""
    scenarios = get_scenarios_by_category("progressive_risk")
    
    for i, scenario in enumerate(scenarios):
        messages = scenario["messages"]
        risk_scores = []
        
        for msg in messages:
            result = await run_full_pipeline(msg, "proxy")
            assert result["ok"] is True
            input_analysis = result.get("data", {}).get("input_analysis", {})
            risk_scores.append(input_analysis.get("risk_score", 0.0))
        
        # Risk should generally increase
        for j in range(len(risk_scores) - 1):
            assert risk_scores[j + 1] >= risk_scores[j] - 0.1, \
                f"Scenario {i+1}: Risk should not decrease significantly from turn {j+1} to {j+2}"
