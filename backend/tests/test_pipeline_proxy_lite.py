# -*- coding: utf-8 -*-
"""
Test Proxy-Lite Pipeline
Tests for proxy-lite mode pipeline execution
"""

import pytest
from backend.api.pipeline_runner import run_full_pipeline


@pytest.mark.asyncio
async def test_proxy_lite_pipeline(fake_llm, sample_text):
    """Test proxy-lite pipeline with fake LLM"""
    result = await run_full_pipeline(
        user_input=sample_text,
        mode="proxy-lite",
        llm_override=fake_llm
    )
    
    # Basic assertions
    assert result["ok"] is True, f"Pipeline failed: {result.get('error')}"
    assert result["mode"] == "proxy-lite"
    assert result["data"] is not None
    
    # Check required fields in data
    assert "risk_level" in result["data"]
    assert "safety_level" in result["data"]
    assert "summary" in result["data"]
    assert "recommendation" in result["data"]
    
    # Validate risk_level values
    assert result["data"]["risk_level"] in ["low", "medium", "high"]
    
    # Validate safety_level values
    assert result["data"]["safety_level"] in ["green", "yellow", "orange", "red", "unknown"]


@pytest.mark.asyncio
async def test_proxy_lite_pipeline_with_output_text(fake_llm, sample_text):
    """Test proxy-lite pipeline with pre-provided output text"""
    output_text = "This is a pre-analyzed output text."
    
    result = await run_full_pipeline(
        user_input=sample_text,
        mode="proxy-lite",
        output_text=output_text,
        llm_override=fake_llm
    )
    
    assert result["ok"] is True
    assert result["mode"] == "proxy-lite"
    assert result["data"] is not None
    assert "risk_level" in result["data"]
    assert "summary" in result["data"]


@pytest.mark.asyncio
async def test_proxy_lite_pipeline_concise_output(fake_llm, sample_text):
    """Test proxy-lite pipeline returns concise summary"""
    result = await run_full_pipeline(
        user_input=sample_text,
        mode="proxy-lite",
        llm_override=fake_llm
    )
    
    assert result["ok"] is True
    data = result["data"]
    
    # Should not contain raw outputs or detailed analysis
    assert "raw_output" not in data
    assert "input_analysis" not in data
    assert "output_analysis" not in data
    
    # Should contain only summary fields
    assert isinstance(data["summary"], str)
    assert isinstance(data["recommendation"], str)
    assert len(data["summary"]) > 0
    assert len(data["recommendation"]) > 0

