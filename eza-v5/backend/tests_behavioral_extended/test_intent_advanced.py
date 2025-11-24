# -*- coding: utf-8 -*-
"""Advanced Intent Tests (20 tests)"""
import pytest
from backend.api.pipeline_runner import run_full_pipeline
from backend.tests_behavioral_extended.helpers.scenario_loader import get_scenarios_by_category

@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_intent_advanced_all_scenarios():
    """Test all intent scenarios"""
    scenarios = get_scenarios_by_category("intent_tests")
    for i, scenario in enumerate(scenarios):
        result = await run_full_pipeline(scenario["input"], "proxy")
        assert result["ok"] is True, f"Scenario {i+1} failed"
        if "expected_risk" in scenario:
            input_analysis = result.get("data", {}).get("input_analysis", {})
            actual_risk = input_analysis.get("risk_level", "")
            assert actual_risk == scenario["expected_risk"] or \
                   (scenario["expected_risk"] == "high" and actual_risk in ["medium", "high"]), \
                   f"Risk mismatch for: {scenario['input']}"

