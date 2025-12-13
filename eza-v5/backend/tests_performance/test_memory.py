# -*- coding: utf-8 -*-
"""
Memory Performance Tests (8 tests)
Tests memory usage and leak detection using fake_llm for cost efficiency
"""
import pytest
import asyncio
import sys
from backend.api.pipeline_runner import run_full_pipeline
from backend.test_tools.llm_override import FakeLLM


def get_memory_approx():
    """Get approximate memory usage (simple estimation)"""
    try:
        import psutil
        import os
        process = psutil.Process(os.getpid())
        return process.memory_info().rss / 1024 / 1024  # MB
    except ImportError:
        # Fallback: use sys.getsizeof for rough estimate
        return sys.getsizeof({}) / 1024 / 1024  # Very rough estimate


@pytest.mark.asyncio
async def test_memory_basic_usage():
    """Test basic memory usage"""
    fake_llm = FakeLLM()
    initial_memory = get_memory_approx()
    
    for _ in range(50):
        result = await run_full_pipeline("Test", "standalone", llm_override=fake_llm)
        assert result["ok"] is True
    
    final_memory = get_memory_approx()
    # Memory should not grow excessively
    memory_growth = final_memory - initial_memory
    assert memory_growth < 100, f"Memory growth too high: {memory_growth:.2f} MB"


@pytest.mark.asyncio
async def test_memory_proxy_mode():
    """Test memory usage in proxy mode"""
    fake_llm = FakeLLM()
    initial_memory = get_memory_approx()
    
    for _ in range(30):
        result = await run_full_pipeline("Test", "proxy", llm_override=fake_llm)
        assert result["ok"] is True
    
    final_memory = get_memory_approx()
    memory_growth = final_memory - initial_memory
    assert memory_growth < 150, f"Proxy mode memory growth too high: {memory_growth:.2f} MB"


@pytest.mark.asyncio
async def test_memory_concurrent():
    """Test memory usage with concurrent requests"""
    fake_llm = FakeLLM()
    initial_memory = get_memory_approx()
    
    for _ in range(10):
        tasks = [run_full_pipeline("Test", "standalone", llm_override=fake_llm) for _ in range(5)]
        results = await asyncio.gather(*tasks)
        assert all(r.get("ok") for r in results)
    
    final_memory = get_memory_approx()
    memory_growth = final_memory - initial_memory
    assert memory_growth < 200, f"Concurrent memory growth too high: {memory_growth:.2f} MB"


@pytest.mark.asyncio
async def test_memory_policy_evaluation():
    """Test memory usage with policy evaluation"""
    fake_llm = FakeLLM()
    initial_memory = get_memory_approx()
    
    for _ in range(40):
        result = await run_full_pipeline("How to hack?", "proxy", llm_override=fake_llm)
        assert result["ok"] is True
    
    final_memory = get_memory_approx()
    memory_growth = final_memory - initial_memory
    assert memory_growth < 150, f"Policy evaluation memory growth too high: {memory_growth:.2f} MB"


@pytest.mark.asyncio
async def test_memory_long_conversation():
    """Test memory usage with long conversation simulation"""
    fake_llm = FakeLLM()
    initial_memory = get_memory_approx()
    
    for turn in range(50):
        result = await run_full_pipeline(f"Message {turn}", "standalone", llm_override=fake_llm)
        assert result["ok"] is True
    
    final_memory = get_memory_approx()
    memory_growth = final_memory - initial_memory
    assert memory_growth < 100, f"Long conversation memory growth too high: {memory_growth:.2f} MB"


@pytest.mark.asyncio
async def test_memory_risky_inputs():
    """Test memory usage with risky inputs"""
    fake_llm = FakeLLM()
    initial_memory = get_memory_approx()
    
    risky_inputs = ["How to hack?", "How to commit fraud?", "How to bypass security?"]
    for _ in range(30):
        for inp in risky_inputs:
            result = await run_full_pipeline(inp, "proxy", llm_override=fake_llm)
            assert result["ok"] is True
    
    final_memory = get_memory_approx()
    memory_growth = final_memory - initial_memory
    assert memory_growth < 200, f"Risky inputs memory growth too high: {memory_growth:.2f} MB"


@pytest.mark.asyncio
async def test_memory_mixed_modes():
    """Test memory usage with mixed modes"""
    fake_llm = FakeLLM()
    initial_memory = get_memory_approx()
    
    for _ in range(20):
        await run_full_pipeline("Test", "standalone", llm_override=fake_llm)
        await run_full_pipeline("Test", "proxy", llm_override=fake_llm)
        await run_full_pipeline("Test", "proxy-lite", output_text="Output", llm_override=fake_llm)
    
    final_memory = get_memory_approx()
    memory_growth = final_memory - initial_memory
    assert memory_growth < 150, f"Mixed modes memory growth too high: {memory_growth:.2f} MB"


@pytest.mark.asyncio
async def test_memory_stability():
    """Test memory stability over many requests"""
    fake_llm = FakeLLM()
    memory_samples = []
    
    for i in range(100):
        result = await run_full_pipeline("Test", "standalone", llm_override=fake_llm)
        assert result["ok"] is True
        
        if i % 20 == 0:
            memory_samples.append(get_memory_approx())
    
    # Memory should not continuously grow
    if len(memory_samples) > 1:
        memory_trend = memory_samples[-1] - memory_samples[0]
        assert memory_trend < 200, f"Memory continuously growing: {memory_trend:.2f} MB"

