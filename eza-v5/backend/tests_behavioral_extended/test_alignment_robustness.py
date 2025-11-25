# -*- coding: utf-8 -*-
"""
Advanced Alignment Robustness Tests (20 tests)
Tests advanced alignment scenarios from behavior_matrix_100.json
"""
import pytest
from backend.api.pipeline_runner import run_full_pipeline
from backend.tests_behavioral_extended.helpers.scenario_loader import get_scenarios_by_category


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_alignment_robustness_all_scenarios():
    """Test all alignment scenarios from behavior matrix"""
    scenarios = get_scenarios_by_category("alignment_tests")
    
    assert len(scenarios) == 20, f"Expected 20 alignment scenarios, got {len(scenarios)}"
    
    for i, scenario in enumerate(scenarios):
        result = await run_full_pipeline(
            user_input=scenario["input"],
            mode="proxy"
        )
        
        assert result["ok"] is True, \
            f"Scenario {i+1} ({scenario.get('description', scenario['input'])}) failed: {result.get('error')}"
        
        # Check that output is safe
        if scenario.get("expected_safe_output"):
            output_analysis = result.get("data", {}).get("output_analysis", {})
            alignment = result.get("data", {}).get("alignment", {})
            
            # Check forbidden words are not in output
            forbidden_words = scenario.get("forbidden", [])
            if forbidden_words:
                output_text = result.get("data", {}).get("output_text", "").lower()
                for word in forbidden_words:
                    assert word.lower() not in output_text, \
                        f"Forbidden word '{word}' found in output for scenario {i+1}"
            
            # Check alignment verdict
            verdict = alignment.get("verdict", "")
            if forbidden_words:
                assert verdict in ["safe_reframe", "block"], \
                    f"Risky input should result in safe_reframe or block, got {verdict}"


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_alignment_safe_outputs():
    """Test that safe inputs produce safe outputs"""
    scenarios = get_scenarios_by_category("alignment_tests")
    safe_scenarios = [s for s in scenarios if not s.get("forbidden")]
    
    for scenario in safe_scenarios:
        result = await run_full_pipeline(
            user_input=scenario["input"],
            mode="proxy"
        )
        
        assert result["ok"] is True
        alignment = result.get("data", {}).get("alignment", {})
        verdict = alignment.get("verdict", "")
        
        # Safe inputs should allow normal output
        assert verdict in ["allow", "safe_reframe"], \
            f"Safe input should allow output, got verdict: {verdict}"


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_alignment_risky_outputs():
    """Test that risky inputs produce safe reframed outputs"""
    scenarios = get_scenarios_by_category("alignment_tests")
    risky_scenarios = [s for s in scenarios if s.get("forbidden")]
    
    for scenario in risky_scenarios:
        result = await run_full_pipeline(
            user_input=scenario["input"],
            mode="proxy"
        )
        
        assert result["ok"] is True
        alignment = result.get("data", {}).get("alignment", {})
        verdict = alignment.get("verdict", "")
        
        # Risky inputs should trigger safe reframe or block
        assert verdict in ["safe_reframe", "block"], \
            f"Risky input should trigger safe_reframe or block, got verdict: {verdict}"


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_alignment_forbidden_words():
    """Test that forbidden words are not present in outputs"""
    scenarios = get_scenarios_by_category("alignment_tests")
    scenarios_with_forbidden = [s for s in scenarios if s.get("forbidden")]
    
    for scenario in scenarios_with_forbidden:
        result = await run_full_pipeline(
            user_input=scenario["input"],
            mode="proxy"
        )
        
        assert result["ok"] is True
        output_text = result.get("data", {}).get("output_text", "").lower()
        forbidden_words = scenario.get("forbidden", [])
        
        for word in forbidden_words:
            assert word.lower() not in output_text, \
                f"Forbidden word '{word}' should not appear in output: {scenario['input']}"


@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_alignment_score_impact():
    """Test that alignment issues impact EZA score"""
    scenarios = get_scenarios_by_category("alignment_tests")
    risky_scenarios = [s for s in scenarios if s.get("forbidden")]
    safe_scenarios = [s for s in scenarios if not s.get("forbidden")]
    
    # Compare risky vs safe
    if risky_scenarios and safe_scenarios:
        risky_result = await run_full_pipeline(
            user_input=risky_scenarios[0]["input"],
            mode="proxy"
        )
        safe_result = await run_full_pipeline(
            user_input=safe_scenarios[0]["input"],
            mode="proxy"
        )
        
        assert risky_result["ok"] is True
        assert safe_result["ok"] is True
        
        risky_score = risky_result.get("eza_score", 100)
        safe_score = safe_result.get("eza_score", 0)
        
        assert risky_score < safe_score, \
            f"Risky scenario should have lower score than safe: {risky_score} vs {safe_score}"
