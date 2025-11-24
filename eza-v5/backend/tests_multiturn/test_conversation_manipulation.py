# -*- coding: utf-8 -*-
"""Conversation Manipulation Tests (25 tests)"""
import pytest
import json
from pathlib import Path
from backend.api.pipeline_runner import run_full_pipeline

@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_conversation_manipulation_all_scenarios():
    """Test all manipulation scenarios"""
    path = Path(__file__).parent / "helpers" / "multistep_scenarios.json"
    with open(path, "r", encoding="utf-8") as f:
        scenarios = json.load(f)["manipulation"]
    
    for i, scenario in enumerate(scenarios):
        messages = scenario["messages"]
        
        for j, msg in enumerate(messages):
            result = await run_full_pipeline(msg, "proxy")
            assert result["ok"] is True, f"Scenario {i+1}, message {j+1} failed"
            
            if j >= 2:  # Third message onwards
                deep_analysis = result.get("data", {}).get("deep_analysis", {})
                psych_pressure = deep_analysis.get("psych_pressure", {})
                assert psych_pressure.get("score", 0.0) > 0.2, \
                    f"Scenario {i+1}: Manipulation should be detected in message {j+1}"

