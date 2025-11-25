# -*- coding: utf-8 -*-
"""
Test N Policies - Physical Harm Prevention (20 tests)
Tests N1-N4 policies with scenarios from policy_matrix_80.json
"""
import pytest
from backend.api.pipeline_runner import run_full_pipeline
from backend.tests_policy.helpers.scenario_loader import get_scenarios_by_policy
from backend.tests_policy.helpers.validate_actions import check_policy_violation


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_N1_physical_harm_prevention():
    """Test N1: Physical Harm Prevention (8 scenarios)"""
    scenarios = get_scenarios_by_policy("N1")
    
    assert len(scenarios) >= 4, f"Expected at least 4 N1 scenarios, got {len(scenarios)}"
    
    for i, scenario in enumerate(scenarios):
        result = await run_full_pipeline(
            user_input=scenario["input"],
            mode="proxy"
        )
        
        assert result["ok"] is True, \
            f"N1 scenario {i+1} ({scenario.get('description', scenario['input'])}) failed: {result.get('error')}"
        
        assert check_policy_violation(result, "N1"), \
            f"N1 should be violated for scenario {i+1}: {scenario['input']}"
        
        if "expected_score_max" in scenario:
            assert result["eza_score"] <= scenario["expected_score_max"], \
                f"Score should be <= {scenario['expected_score_max']}, got {result['eza_score']}"


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_N2_self_harm_prevention():
    """Test N2: Self-Harm Prevention (8 scenarios)"""
    scenarios = get_scenarios_by_policy("N2")
    
    assert len(scenarios) >= 4, f"Expected at least 4 N2 scenarios, got {len(scenarios)}"
    
    for i, scenario in enumerate(scenarios):
        result = await run_full_pipeline(
            user_input=scenario["input"],
            mode="proxy"
        )
        
        assert result["ok"] is True, \
            f"N2 scenario {i+1} ({scenario.get('description', scenario['input'])}) failed: {result.get('error')}"
        
        assert check_policy_violation(result, "N2"), \
            f"N2 should be violated for scenario {i+1}: {scenario['input']}"
        
        if "expected_score_max" in scenario:
            assert result["eza_score"] <= scenario["expected_score_max"], \
                f"Score should be <= {scenario['expected_score_max']}, got {result['eza_score']}"


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_N3_violence_against_others():
    """Test N3: Violence Against Others (8 scenarios)"""
    scenarios = get_scenarios_by_policy("N3")
    
    assert len(scenarios) >= 4, f"Expected at least 4 N3 scenarios, got {len(scenarios)}"
    
    for i, scenario in enumerate(scenarios):
        result = await run_full_pipeline(
            user_input=scenario["input"],
            mode="proxy"
        )
        
        assert result["ok"] is True, \
            f"N3 scenario {i+1} ({scenario.get('description', scenario['input'])}) failed: {result.get('error')}"
        
        assert check_policy_violation(result, "N3"), \
            f"N3 should be violated for scenario {i+1}: {scenario['input']}"
        
        if "expected_score_max" in scenario:
            assert result["eza_score"] <= scenario["expected_score_max"], \
                f"Score should be <= {scenario['expected_score_max']}, got {result['eza_score']}"


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_N4_dangerous_activities():
    """Test N4: Dangerous Activities (8 scenarios)"""
    scenarios = get_scenarios_by_policy("N4")
    
    assert len(scenarios) >= 4, f"Expected at least 4 N4 scenarios, got {len(scenarios)}"
    
    for i, scenario in enumerate(scenarios):
        result = await run_full_pipeline(
            user_input=scenario["input"],
            mode="proxy"
        )
        
        assert result["ok"] is True, \
            f"N4 scenario {i+1} ({scenario.get('description', scenario['input'])}) failed: {result.get('error')}"
        
        assert check_policy_violation(result, "N4"), \
            f"N4 should be violated for scenario {i+1}: {scenario['input']}"
        
        if "expected_score_max" in scenario:
            assert result["eza_score"] <= scenario["expected_score_max"], \
                f"Score should be <= {scenario['expected_score_max']}, got {result['eza_score']}"


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_N_policies_score_impact():
    """Test that N policies impact score correctly based on severity"""
    # Critical policies (N1, N2, N3) should have lower scores than high severity (N4)
    n1_scenarios = get_scenarios_by_policy("N1")
    n4_scenarios = get_scenarios_by_policy("N4")
    
    if n1_scenarios and n4_scenarios:
        n1_result = await run_full_pipeline(user_input=n1_scenarios[0]["input"], mode="proxy")
        n4_result = await run_full_pipeline(user_input=n4_scenarios[0]["input"], mode="proxy")
        
        assert n1_result["ok"] is True
        assert n4_result["ok"] is True
        
        n1_score = n1_result.get("eza_score", 100)
        n4_score = n4_result.get("eza_score", 100)
        
        # N1 (critical) should have lower score than N4 (high)
        assert n1_score < n4_score, \
            f"N1 critical violation ({n1_score}) should have lower score than N4 high ({n4_score})"
