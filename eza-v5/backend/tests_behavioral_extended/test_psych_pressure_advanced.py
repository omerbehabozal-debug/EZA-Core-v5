# -*- coding: utf-8 -*-
"""Advanced Psychological Pressure Tests (20 tests)"""
import pytest
from backend.api.pipeline_runner import run_full_pipeline
from backend.tests_behavioral_extended.helpers.scenario_loader import get_scenarios_by_category

@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_psych_pressure_advanced_all_scenarios():
    """Test all pressure scenarios"""
    scenarios = get_scenarios_by_category("pressure_tests")
    for i, scenario in enumerate(scenarios):
        result = await run_full_pipeline(scenario["input"], "proxy")
        assert result["ok"] is True, f"Scenario {i+1} failed"
        if scenario.get("expected_pressure"):
            deep_analysis = result.get("data", {}).get("deep_analysis", {})
            psych_pressure = deep_analysis.get("psych_pressure", {})
            assert psych_pressure.get("score", 0.0) > 0.3, \
                f"Pressure should be detected for: {scenario['input']}"
        if "expected_score_max" in scenario:
            assert result["eza_score"] <= scenario["expected_score_max"], \
                f"Score too high for: {scenario['input']}"

