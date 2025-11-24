# -*- coding: utf-8 -*-
"""Advanced Legal Risk Tests (20 tests)"""
import pytest
from backend.api.pipeline_runner import run_full_pipeline
from backend.tests_behavioral_extended.helpers.scenario_loader import get_scenarios_by_category

@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_legal_risk_advanced_all_scenarios():
    """Test all legal risk scenarios"""
    scenarios = get_scenarios_by_category("legal_tests")
    for i, scenario in enumerate(scenarios):
        result = await run_full_pipeline(scenario["input"], "proxy")
        assert result["ok"] is True, f"Scenario {i+1} failed"
        if scenario.get("expected_legal_risk"):
            deep_analysis = result.get("data", {}).get("deep_analysis", {})
            legal_risk = deep_analysis.get("legal_risk", {})
            assert legal_risk.get("risk_score", 0.0) > 0.3, \
                f"Legal risk should be detected for: {scenario['input']}"
        if "expected_score_max" in scenario:
            assert result["eza_score"] <= scenario["expected_score_max"], \
                f"Score too high for: {scenario['input']}"

