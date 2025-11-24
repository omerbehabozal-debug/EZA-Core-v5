# -*- coding: utf-8 -*-
"""Topic Drift Tests (25 tests)"""
import pytest
import json
from pathlib import Path
from backend.api.pipeline_runner import run_full_pipeline

@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_topic_drift_all_scenarios():
    """Test all topic drift scenarios"""
    path = Path(__file__).parent / "helpers" / "multistep_scenarios.json"
    with open(path, "r", encoding="utf-8") as f:
        scenarios = json.load(f)["topic_drift"]
    
    for i, scenario in enumerate(scenarios):
        messages = scenario["messages"]
        risk_scores = []
        
        for msg in messages:
            result = await run_full_pipeline(msg, "proxy")
            assert result["ok"] is True, f"Scenario {i+1} failed"
            input_analysis = result.get("data", {}).get("input_analysis", {})
            risk_scores.append(input_analysis.get("risk_score", 0.0))
        
        # First and last should be risky
        assert risk_scores[0] > 0.5, f"Scenario {i+1}: First message should be risky"
        assert risk_scores[-1] > 0.5, f"Scenario {i+1}: Last message should be risky"

