# -*- coding: utf-8 -*-
"""
Advanced Legal Risk Detection Tests (20 tests)
Tests advanced legal risk scenarios from behavior_matrix_100.json
"""
import pytest
from backend.api.pipeline_runner import run_full_pipeline
from backend.tests_behavioral_extended.helpers.scenario_loader import get_scenarios_by_category


# Get scenarios once at module level
_legal_scenarios = get_scenarios_by_category("legal_tests")


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
@pytest.mark.parametrize("scenario", _legal_scenarios, ids=lambda s: s.get("description", s["input"][:50]))
async def test_legal_risk_advanced_scenario(scenario):
    """Test individual legal risk scenario"""
    result = await run_full_pipeline(
        user_input=scenario["input"],
        mode="proxy"
    )
    
    assert result["ok"] is True, \
        f"Scenario ({scenario.get('description', scenario['input'])}) failed: {result.get('error')}"
    
    # Check that legal risk is detected
    if scenario.get("expected_legal_risk"):
        deep_analysis = result.get("data", {}).get("deep_analysis", {})
        legal_risk = deep_analysis.get("legal_risk", {})
        legal_risk_score = legal_risk.get("risk_score", 0.0)
        input_analysis = result.get("data", {}).get("input_analysis", {})
        risk_flags = input_analysis.get("risk_flags", [])
        
        # Legal risk should be detected in deep_analysis or input_analysis
        assert legal_risk_score > 0.3 or any(flag in ["illegal", "hacking", "fraud", "theft"] for flag in risk_flags), \
            f"Legal risk should be detected for: {scenario['input']}"
    
    # Check score is within expected range
    if "expected_score_max" in scenario:
        score = result.get("eza_score", 100)
        assert score <= scenario["expected_score_max"] + 10, \
            f"Score should be <= {scenario['expected_score_max'] + 10}, got {score}"
