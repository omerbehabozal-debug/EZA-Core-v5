# -*- coding: utf-8 -*-
"""Context Graph Tests (25 tests)"""
import pytest
import json
from pathlib import Path
from backend.api.pipeline_runner import run_full_pipeline

@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_context_graph_risk_escalation():
    """Test context graph risk escalation"""
    path = Path(__file__).parent / "helpers" / "multistep_scenarios.json"
    with open(path, "r", encoding="utf-8") as f:
        scenarios = json.load(f)["risk_escalation"]
    
    for i, scenario in enumerate(scenarios):
        messages = scenario["messages"]
        risk_scores = []
        
        for msg in messages:
            result = await run_full_pipeline(msg, "proxy")
            assert result["ok"] is True, f"Scenario {i+1} failed"
            input_analysis = result.get("data", {}).get("input_analysis", {})
            risk_scores.append(input_analysis.get("risk_score", 0.0))
        
        # Risk should escalate
        for j in range(len(risk_scores) - 1):
            assert risk_scores[j + 1] >= risk_scores[j] - 0.1, \
                f"Scenario {i+1}: Risk should not decrease significantly"

