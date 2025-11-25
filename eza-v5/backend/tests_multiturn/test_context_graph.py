# -*- coding: utf-8 -*-
"""
Context Graph Tests (25 tests)
Tests context graph risk escalation scenarios from multistep_matrix_100.json
"""
import pytest
from backend.api.pipeline_runner import run_full_pipeline
from backend.tests_multiturn.helpers.scenario_loader import get_scenarios_by_category


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_context_graph_risk_escalation():
    """Test context graph risk escalation"""
    scenarios = get_scenarios_by_category("risk_escalation")
    
    assert len(scenarios) == 25, f"Expected 25 risk escalation scenarios, got {len(scenarios)}"
    
    for i, scenario in enumerate(scenarios):
        messages = scenario["messages"]
        risk_scores = []
        
        for msg in messages:
            result = await run_full_pipeline(msg, "proxy")
            assert result["ok"] is True, f"Scenario {i+1} failed: {result.get('error')}"
            input_analysis = result.get("data", {}).get("input_analysis", {})
            risk_scores.append(input_analysis.get("risk_score", 0.0))
        
        # Risk should escalate
        for j in range(len(risk_scores) - 1):
            assert risk_scores[j + 1] >= risk_scores[j] - 0.1, \
                f"Scenario {i+1}: Risk should not decrease significantly from turn {j+1} to {j+2}"


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_context_graph_final_risk():
    """Test that final message in escalation has highest risk"""
    scenarios = get_scenarios_by_category("risk_escalation")
    
    for i, scenario in enumerate(scenarios):
        messages = scenario["messages"]
        if len(messages) >= 3:
            risk_scores = []
            
            for msg in messages:
                result = await run_full_pipeline(msg, "proxy")
                assert result["ok"] is True
                input_analysis = result.get("data", {}).get("input_analysis", {})
                risk_scores.append(input_analysis.get("risk_score", 0.0))
            
            # Final risk should be highest or near highest
            assert risk_scores[-1] >= max(risk_scores) - 0.2, \
                f"Scenario {i+1}: Final message should have highest or near-highest risk"
