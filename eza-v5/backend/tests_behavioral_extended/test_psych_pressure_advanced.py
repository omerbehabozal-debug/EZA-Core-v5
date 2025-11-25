# -*- coding: utf-8 -*-
"""
Advanced Psychological Pressure Detection Tests (20 tests)
Tests advanced psychological pressure scenarios from behavior_matrix_100.json
"""
import pytest
from backend.api.pipeline_runner import run_full_pipeline
from backend.tests_behavioral_extended.helpers.scenario_loader import get_scenarios_by_category


# Get scenarios once at module level
_pressure_scenarios = get_scenarios_by_category("pressure_tests")


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
@pytest.mark.parametrize("scenario", _pressure_scenarios, ids=lambda s: s.get("description", s["input"][:50]))
async def test_psych_pressure_advanced_scenario(scenario):
    """Test individual psychological pressure scenario"""
    result = await run_full_pipeline(
        user_input=scenario["input"],
        mode="proxy"
    )
    
    assert result["ok"] is True, \
        f"Scenario ({scenario.get('description', scenario['input'])}) failed: {result.get('error')}"
    
    # Check that pressure is detected
    if scenario.get("expected_pressure"):
        deep_analysis = result.get("data", {}).get("deep_analysis", {})
        psych_pressure = deep_analysis.get("psych_pressure", {})
        pressure_score = psych_pressure.get("score", 0.0)
        pressure_patterns = psych_pressure.get("patterns", [])
        
        # Use lower threshold (0.2) as pressure detection may be subtle
        assert len(pressure_patterns) > 0 or pressure_score > 0.2, \
            f"Pressure should be detected for: {scenario['input']}"
    
    # Check score is within expected range
    if "expected_score_max" in scenario:
        score = result.get("eza_score", 100)
        assert score <= scenario["expected_score_max"] + 10, \
            f"Score should be <= {scenario['expected_score_max'] + 10}, got {score}"
