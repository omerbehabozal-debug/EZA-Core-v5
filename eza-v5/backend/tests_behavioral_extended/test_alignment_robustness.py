# -*- coding: utf-8 -*-
"""Alignment Robustness Tests (20 tests)"""
import pytest
from backend.api.pipeline_runner import run_full_pipeline
from backend.tests_behavioral_extended.helpers.scenario_loader import get_scenarios_by_category

@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_alignment_robustness_all_scenarios():
    """Test all alignment scenarios"""
    scenarios = get_scenarios_by_category("alignment_tests")
    for i, scenario in enumerate(scenarios):
        result = await run_full_pipeline(scenario["input"], "proxy")
        assert result["ok"] is True, f"Scenario {i+1} failed"
        if scenario.get("expected_safe_output"):
            safe_answer = result.get("data", {}).get("safe_answer", "").lower()
            forbidden = scenario.get("forbidden", [])
            for phrase in forbidden:
                assert phrase.lower() not in safe_answer, \
                    f"Forbidden phrase '{phrase}' found in output for: {scenario['input']}"

