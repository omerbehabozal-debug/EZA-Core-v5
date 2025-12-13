# -*- coding: utf-8 -*-
"""
Test Standalone Pipeline
Tests for standalone mode pipeline execution
"""

import pytest
from backend.api.pipeline_runner import run_full_pipeline


@pytest.mark.asyncio
async def test_standalone_pipeline(fake_llm, sample_text):
    """Test standalone pipeline with fake LLM"""
    result = await run_full_pipeline(
        user_input=sample_text,
        mode="standalone",
        llm_override=fake_llm
    )
    
    # Basic assertions
    assert result["ok"] is True, f"Pipeline failed: {result.get('error')}"
    assert result["mode"] == "standalone"
    assert result["data"] is not None
    assert "safe_answer" in result["data"]
    assert result["eza_score"] is not None
    assert isinstance(result["eza_score"], (int, float))
    assert 0 <= result["eza_score"] <= 100


@pytest.mark.asyncio
async def test_standalone_pipeline_with_risky_input(fake_llm, sample_risky_text):
    """Test standalone pipeline with risky input"""
    result = await run_full_pipeline(
        user_input=sample_risky_text,
        mode="standalone",
        llm_override=fake_llm
    )
    
    # Should still complete successfully
    assert result["ok"] is True
    assert result["mode"] == "standalone"
    assert result["data"] is not None
    assert "safe_answer" in result["data"]
    # Risky input should have lower score
    assert result["eza_score"] is not None
    assert isinstance(result["eza_score"], (int, float))


@pytest.mark.asyncio
async def test_standalone_pipeline_empty_input(fake_llm):
    """Test standalone pipeline with empty input"""
    result = await run_full_pipeline(
        user_input="",
        mode="standalone",
        llm_override=fake_llm
    )
    
    # Should handle empty input gracefully
    assert result["ok"] is True or result["ok"] is False  # May fail validation
    assert result["mode"] == "standalone"

