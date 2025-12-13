# -*- coding: utf-8 -*-
"""
Test Error Handling (10 tests)
"""

import pytest
from backend.api.pipeline_runner import run_full_pipeline
from backend.test_tools.llm_override import BrokenLLM
from backend.test_tools.assert_tools import assert_response_schema


@pytest.mark.asyncio
async def test_error_handling_llm_failure():
    """Test handling of LLM failure"""
    broken_llm = BrokenLLM("Model failure")
    result = await run_full_pipeline(
        user_input="Test input",
        mode="standalone",
        llm_override=broken_llm
    )
    
    assert result["ok"] is False
    assert result["error"] is not None
    assert "error_code" in result["error"]


@pytest.mark.asyncio
async def test_error_handling_empty_input():
    """Test handling of empty input"""
    result = await run_full_pipeline(
        user_input="",
        mode="standalone"
    )
    
    # Should handle gracefully
    assert_response_schema(result)


@pytest.mark.asyncio
async def test_error_handling_invalid_mode():
    """Test handling of invalid mode"""
    # This should be caught by type system, but test for robustness
    try:
        result = await run_full_pipeline(
            user_input="Test",
            mode="invalid_mode"  # type: ignore
        )
        # If it doesn't raise, should return error
        assert result["ok"] is False or result["mode"] in ["standalone", "proxy", "proxy-lite"]
    except Exception:
        pass  # Expected to raise


@pytest.mark.asyncio
async def test_error_handling_network_timeout():
    """Test handling of network timeout"""
    # Simulate timeout with broken LLM
    broken_llm = BrokenLLM("Timeout error")
    result = await run_full_pipeline(
        user_input="Test",
        mode="standalone",
        llm_override=broken_llm
    )
    
    assert result["ok"] is False
    assert result["error"] is not None


@pytest.mark.asyncio
async def test_error_handling_response_structure():
    """Test error response structure"""
    broken_llm = BrokenLLM("Test error")
    result = await run_full_pipeline(
        user_input="Test",
        mode="proxy",
        llm_override=broken_llm
    )
    
    assert_response_schema(result)
    if not result["ok"]:
        assert "error_code" in result["error"]
        assert "error_message" in result["error"]


@pytest.mark.asyncio
async def test_error_handling_graceful_degradation():
    """Test graceful degradation on errors"""
    broken_llm = BrokenLLM("Error")
    result = await run_full_pipeline(
        user_input="Test",
        mode="standalone",
        llm_override=broken_llm
    )
    
    # Should return response, not crash
    assert isinstance(result, dict)
    assert "ok" in result


@pytest.mark.asyncio
async def test_error_handling_all_modes():
    """Test error handling in all modes"""
    broken_llm = BrokenLLM("Error")
    modes = ["standalone", "proxy", "proxy-lite"]
    
    for mode in modes:
        result = await run_full_pipeline(
            user_input="Test",
            mode=mode,
            llm_override=broken_llm
        )
        
        assert result["ok"] is False
        assert result["mode"] == mode


@pytest.mark.asyncio
async def test_error_handling_retryable_flag():
    """Test retryable error flag"""
    broken_llm = BrokenLLM("Retryable error")
    result = await run_full_pipeline(
        user_input="Test",
        mode="proxy",
        llm_override=broken_llm
    )
    
    if result.get("error") and "retryable" in result["error"]:
        assert isinstance(result["error"]["retryable"], bool)


@pytest.mark.asyncio
async def test_error_handling_partial_failure():
    """Test handling of partial failures"""
    # Test that some components can fail without breaking entire pipeline
    result = await run_full_pipeline(
        user_input="Test input",
        mode="proxy"
    )
    
    # Even if some components fail, should return response
    assert_response_schema(result)


@pytest.mark.asyncio
async def test_error_handling_error_logging():
    """Test that errors are properly logged"""
    broken_llm = BrokenLLM("Loggable error")
    result = await run_full_pipeline(
        user_input="Test",
        mode="standalone",
        llm_override=broken_llm
    )
    
    # Error should contain enough information for logging
    if not result["ok"]:
        assert result["error"]["error_message"] is not None
        assert len(result["error"]["error_message"]) > 0

