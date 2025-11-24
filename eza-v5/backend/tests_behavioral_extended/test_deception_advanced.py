# -*- coding: utf-8 -*-
"""Advanced Deception Tests (20 tests)"""
import pytest
from backend.api.pipeline_runner import run_full_pipeline
from backend.tests_behavioral_extended.helpers.scenario_loader import get_scenarios_by_category

@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_deception_advanced_all_scenarios():
    """Test all deception scenarios"""
    scenarios = get_scenarios_by_category("deception_tests")
    for i, scenario in enumerate(scenarios):
        result = await run_full_pipeline(scenario["input"], "proxy")
        assert result["ok"] is True, f"Scenario {i+1} failed"
        if scenario.get("expected_deception"):
            deep_analysis = result.get("data", {}).get("deep_analysis", {})
            deception = deep_analysis.get("deception", {})
            assert deception.get("score", 0.0) > 0.3, \
                f"Deception should be detected for: {scenario['input']}"
        if "expected_score_max" in scenario:
            assert result["eza_score"] <= scenario["expected_score_max"], \
                f"Score too high for: {scenario['input']}"

