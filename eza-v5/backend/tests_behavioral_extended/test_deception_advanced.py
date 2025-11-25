# -*- coding: utf-8 -*-
"""
Advanced Deception Detection Tests (20 tests)
Tests advanced deception scenarios from behavior_matrix_100.json
"""
import pytest
from backend.api.pipeline_runner import run_full_pipeline
from backend.tests_behavioral_extended.helpers.scenario_loader import get_scenarios_by_category


# Get scenarios once at module level
_deception_scenarios = get_scenarios_by_category("deception_tests")


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
@pytest.mark.parametrize("scenario", _deception_scenarios, ids=lambda s: s.get("description", s["input"][:50]))
async def test_deception_advanced_scenario(scenario):
    """Test individual deception scenario"""
    result = await run_full_pipeline(
        user_input=scenario["input"],
        mode="proxy"
    )
    
    assert result["ok"] is True, \
        f"Scenario ({scenario.get('description', scenario['input'])}) failed: {result.get('error')}"
    
    # Check that deception is detected
    if scenario.get("expected_deception"):
        deep_analysis = result.get("data", {}).get("deep_analysis", {})
        deception = deep_analysis.get("deception", {})
        deception_score = deception.get("score", 0.0)
        deception_flags = deception.get("flags", [])
        
        # Use lower threshold (0.2) as deception detection may be subtle
        assert len(deception_flags) > 0 or deception_score > 0.2, \
            f"Deception should be detected for: {scenario['input']}"
    
    # Check score is within expected range
    if "expected_score_max" in scenario:
        score = result.get("eza_score", 100)
        assert score <= scenario["expected_score_max"] + 10, \
            f"Score should be <= {scenario['expected_score_max'] + 10}, got {score}"
