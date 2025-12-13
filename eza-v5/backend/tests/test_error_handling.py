# -*- coding: utf-8 -*-
"""
Test Error Handling
Tests for error handling in pipeline
"""

import pytest
from backend.api.pipeline_runner import run_full_pipeline
from backend.tests.helpers.fake_llm import BrokenLLM


@pytest.mark.asyncio
async def test_pipeline_error_handling(sample_text):
    """Test pipeline handles LLM errors gracefully"""
    broken_llm = BrokenLLM(error_message="Model failure")
    
    result = await run_full_pipeline(
        user_input=sample_text,
        mode="standalone",
        llm_override=broken_llm
    )
    
    # Should return error response, not crash
    assert result["ok"] is False
    assert result["error"] is not None
    assert "error_code" in result["error"]
    assert "error_message" in result["error"]
    assert "Model failure" in result["error"]["error_message"]


@pytest.mark.asyncio
async def test_pipeline_error_response_structure(sample_text):
    """Test error response has correct structure"""
    broken_llm = BrokenLLM(error_message="Test error")
    
    result = await run_full_pipeline(
        user_input=sample_text,
        mode="standalone",
        llm_override=broken_llm
    )
    
    # Check error structure
    assert result["ok"] is False
    assert result["mode"] == "standalone"  # Mode should still be set
    assert result["error"] is not None
    assert isinstance(result["error"], dict)
    assert "error_code" in result["error"]
    assert "error_message" in result["error"]
    
    # Error code should be a string
    assert isinstance(result["error"]["error_code"], str)
    assert len(result["error"]["error_code"]) > 0
    
    # Error message should be a string
    assert isinstance(result["error"]["error_message"], str)
    assert len(result["error"]["error_message"]) > 0


@pytest.mark.asyncio
async def test_pipeline_does_not_crash_on_error(sample_text):
    """Test pipeline never crashes, always returns response"""
    broken_llm = BrokenLLM(error_message="Critical failure")
    
    # Should not raise exception
    result = await run_full_pipeline(
        user_input=sample_text,
        mode="proxy",
        llm_override=broken_llm
    )
    
    # Should return a response dictionary
    assert isinstance(result, dict)
    assert "ok" in result
    assert "mode" in result
    assert result["ok"] is False


@pytest.mark.asyncio
async def test_pipeline_error_with_different_modes(sample_text):
    """Test error handling works for all modes"""
    broken_llm = BrokenLLM(error_message="Mode test error")
    
    modes = ["standalone", "proxy", "proxy-lite"]
    
    for mode in modes:
        result = await run_full_pipeline(
            user_input=sample_text,
            mode=mode,
            llm_override=broken_llm
        )
        
        assert result["ok"] is False
        assert result["mode"] == mode
        assert result["error"] is not None

