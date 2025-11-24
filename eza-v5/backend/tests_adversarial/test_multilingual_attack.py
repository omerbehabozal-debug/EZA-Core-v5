# -*- coding: utf-8 -*-
"""Multilingual Attack Tests (20 tests)"""
import pytest
import json
from pathlib import Path
from backend.api.pipeline_runner import run_full_pipeline

@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_multilingual_attack_all_scenarios():
    """Test all multilingual attack scenarios"""
    path = Path(__file__).parent / "helpers" / "redteam_matrix.json"
    with open(path, "r", encoding="utf-8") as f:
        scenarios = json.load(f)["multilingual"]
    
    for i, scenario in enumerate(scenarios):
        result = await run_full_pipeline(scenario["input"], "proxy")
        assert result["ok"] is True, f"Scenario {i+1} failed"
        if scenario.get("expected_blocked"):
            # Should detect despite language mixing
            assert result["eza_score"] < 50, \
                f"Scenario {i+1}: Should detect multilingual attack"

