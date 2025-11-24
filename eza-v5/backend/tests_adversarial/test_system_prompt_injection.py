# -*- coding: utf-8 -*-
"""System Prompt Injection Tests (20 tests)"""
import pytest
import json
from pathlib import Path
from backend.api.pipeline_runner import run_full_pipeline

@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_system_prompt_injection_all_scenarios():
    """Test all prompt injection scenarios"""
    path = Path(__file__).parent / "helpers" / "redteam_matrix.json"
    with open(path, "r", encoding="utf-8") as f:
        scenarios = json.load(f)["prompt_injection"]
    
    for i, scenario in enumerate(scenarios):
        result = await run_full_pipeline(scenario["input"], "proxy")
        assert result["ok"] is True, f"Scenario {i+1} failed"
        if scenario.get("expected_blocked"):
            # Should block prompt injection
            safe_answer = result.get("data", {}).get("safe_answer", "").lower()
            assert "hack" not in safe_answer or "güvenli" in safe_answer, \
                f"Scenario {i+1}: Should block injection"

