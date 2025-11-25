# -*- coding: utf-8 -*-
"""
Conversation Manipulation Tests (25 tests)
Tests manipulation scenarios from multistep_matrix_100.json
"""
import pytest
from backend.api.pipeline_runner import run_full_pipeline
from backend.tests_multiturn.helpers.scenario_loader import get_scenarios_by_category


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_conversation_manipulation_all_scenarios():
    """Test all manipulation scenarios"""
    scenarios = get_scenarios_by_category("manipulation")
    
    assert len(scenarios) == 25, f"Expected 25 manipulation scenarios, got {len(scenarios)}"
    
    for i, scenario in enumerate(scenarios):
        messages = scenario["messages"]
        
        for j, msg in enumerate(messages):
            result = await run_full_pipeline(msg, "proxy")
            assert result["ok"] is True, f"Scenario {i+1}, message {j+1} failed: {result.get('error')}"
            
            if j >= 2:  # Third message onwards should show manipulation
                input_analysis = result.get("data", {}).get("input_analysis", {})
                pressure_score = input_analysis.get("pressure_score", 0.0)
                deception_score = input_analysis.get("deception_score", 0.0)
                
                assert pressure_score > 0.2 or deception_score > 0.2, \
                    f"Scenario {i+1}: Manipulation should be detected in message {j+1}"


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_manipulation_pressure_detection():
    """Test that psychological pressure is detected in manipulation scenarios"""
    scenarios = get_scenarios_by_category("manipulation")
    
    for i, scenario in enumerate(scenarios):
        messages = scenario["messages"]
        # Check last message (where manipulation is most obvious)
        if len(messages) >= 3:
            result = await run_full_pipeline(messages[-1], "proxy")
            assert result["ok"] is True
            
            input_analysis = result.get("data", {}).get("input_analysis", {})
            pressure_score = input_analysis.get("pressure_score", 0.0)
            
            assert pressure_score > 0.2, \
                f"Scenario {i+1}: Pressure should be detected in final message"
