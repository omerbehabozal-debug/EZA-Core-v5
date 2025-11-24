# -*- coding: utf-8 -*-
"""Progressive Risk Tests (25 tests)"""
import pytest
import json
from pathlib import Path
from backend.api.pipeline_runner import run_full_pipeline

@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_progressive_risk_all_scenarios():
    """Test all progressive risk scenarios"""
    path = Path(__file__).parent / "helpers" / "multistep_scenarios.json"
    with open(path, "r", encoding="utf-8") as f:
        scenarios = json.load(f)["progressive_risk"]
    
    for i, scenario in enumerate(scenarios):
        messages = scenario["messages"]
        expected = scenario["expected_progression"]
        risk_levels = []
        
        for msg in messages:
            result = await run_full_pipeline(msg, "proxy")
            assert result["ok"] is True, f"Scenario {i+1}, message failed"
            input_analysis = result.get("data", {}).get("input_analysis", {})
            risk_levels.append(input_analysis.get("risk_level", "unknown"))
        
        for j, exp_level in enumerate(expected):
            assert risk_levels[j] == exp_level or \
                   (exp_level == "high" and risk_levels[j] in ["medium", "high"]), \
                   f"Scenario {i+1}, turn {j+1}: expected {exp_level}, got {risk_levels[j]}"

