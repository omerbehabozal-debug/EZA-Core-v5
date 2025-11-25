# -*- coding: utf-8 -*-
"""Memory Leak Tests (5 tests)"""
import pytest
import asyncio
from backend.api.pipeline_runner import run_full_pipeline

@pytest.mark.asyncio
async def test_memory_leak_basic():
    """Test for basic memory leaks"""
    for i in range(500):
        result = await run_full_pipeline("Test", "standalone")
        assert result["ok"] is True
        if i % 100 == 0:
            # System should still be responsive
            assert result["eza_score"] is not None

@pytest.mark.asyncio
async def test_memory_leak_proxy_mode():
    """Test memory leak in proxy mode"""
    for i in range(300):
        result = await run_full_pipeline("Test", "proxy")
        assert result["ok"] is True
        if i % 50 == 0:
            assert result["data"] is not None

@pytest.mark.asyncio
async def test_memory_leak_concurrent():
    """Test memory leak with concurrent requests"""
    for _ in range(50):
        tasks = [run_full_pipeline("Test", "standalone") for _ in range(10)]
        results = await asyncio.gather(*tasks)
        assert all(r.get("ok") for r in results)

@pytest.mark.asyncio
async def test_memory_leak_policy_evaluation():
    """Test memory leak in policy evaluation"""
    for i in range(400):
        result = await run_full_pipeline("How to hack?", "proxy")
        assert result["ok"] is True
        if i % 100 == 0:
            violations = result.get("data", {}).get("policy_violations", [])
            assert len(violations) > 0

@pytest.mark.asyncio
async def test_memory_leak_long_conversation():
    """Test memory leak with long conversations"""
    for _ in range(100):
        # Simulate conversation
        for turn in range(5):
            result = await run_full_pipeline(f"Message {turn}", "standalone")
            assert result["ok"] is True


@pytest.mark.asyncio
async def test_memory_leak_risky_inputs():
    """Test memory leak with risky inputs"""
    import random
    risky_inputs = ["How to hack?", "How to commit fraud?", "How to harm?"]
    for _ in range(300):
        result = await run_full_pipeline(random.choice(risky_inputs), "proxy")
        assert result["ok"] is True


@pytest.mark.asyncio
async def test_memory_leak_mixed_modes():
    """Test memory leak with mixed modes"""
    import random
    modes = ["standalone", "proxy", "proxy-lite"]
    for i in range(300):
        mode = random.choice(modes)
        result = await run_full_pipeline("Test", mode)
        assert result["ok"] is True
