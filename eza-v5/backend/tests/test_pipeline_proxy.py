# -*- coding: utf-8 -*-
"""
Test Proxy Pipeline
Tests for proxy mode pipeline execution
"""

import pytest
from backend.api.pipeline_runner import run_full_pipeline


@pytest.mark.asyncio
async def test_proxy_pipeline(fake_llm, sample_text):
    """Test proxy pipeline with fake LLM"""
    result = await run_full_pipeline(
        user_input=sample_text,
        mode="proxy",
        llm_override=fake_llm
    )
    
    # Basic assertions
    assert result["ok"] is True, f"Pipeline failed: {result.get('error')}"
    assert result["mode"] == "proxy"
    assert result["data"] is not None
    
    # Check required fields in data
    assert "raw_output" in result["data"]
    assert "safe_answer" in result["data"]
    assert "input_analysis" in result["data"]
    assert "output_analysis" in result["data"]
    assert "alignment" in result["data"]
    
    # Deep analysis may or may not be present
    # assert "deep_analysis" in result["data"]
    
    # Score assertions
    assert result["eza_score"] is not None
    assert isinstance(result["eza_score"], (int, float))
    assert 0 <= result["eza_score"] <= 100
    
    # Check score breakdown
    assert result["eza_score_breakdown"] is not None
    assert isinstance(result["eza_score_breakdown"], dict)


@pytest.mark.asyncio
async def test_proxy_pipeline_detailed_analysis(fake_llm, sample_text):
    """Test proxy pipeline includes detailed analysis"""
    result = await run_full_pipeline(
        user_input=sample_text,
        mode="proxy",
        llm_override=fake_llm
    )
    
    assert result["ok"] is True
    data = result["data"]
    
    # Check input analysis structure
    assert isinstance(data["input_analysis"], dict)
    assert "risk_score" in data["input_analysis"]
    assert "risk_level" in data["input_analysis"]
    
    # Check output analysis structure
    assert isinstance(data["output_analysis"], dict)
    assert "risk_score" in data["output_analysis"]
    
    # Check alignment structure
    assert isinstance(data["alignment"], dict)
    assert "alignment_score" in data["alignment"]
    assert "verdict" in data["alignment"]
    assert "label" in data["alignment"]


@pytest.mark.asyncio
async def test_proxy_pipeline_with_risky_input(fake_llm, sample_risky_text):
    """Test proxy pipeline with risky input"""
    result = await run_full_pipeline(
        user_input=sample_risky_text,
        mode="proxy",
        llm_override=fake_llm
    )
    
    assert result["ok"] is True
    assert result["mode"] == "proxy"
    
    # Risky input should be detected
    input_analysis = result["data"]["input_analysis"]
    assert input_analysis["risk_score"] > 0
    assert input_analysis["risk_level"] in ["low", "medium", "high"]

