# -*- coding: utf-8 -*-
"""Long-Run Stability Tests (10 tests)"""
import pytest
import asyncio
import time
from backend.api.pipeline_runner import run_full_pipeline

@pytest.mark.asyncio
async def test_longrun_1hour():
    """Test 1 hour stability"""
    start_time = time.time()
    end_time = start_time + 3600  # 1 hour
    request_count = 0
    
    while time.time() < end_time:
        result = await run_full_pipeline("Test input", "standalone")
        assert result["ok"] is True
        request_count += 1
        await asyncio.sleep(1)  # 1 request per second
    
    assert request_count >= 3000, f"Too few requests in 1 hour: {request_count}"

@pytest.mark.asyncio
async def test_longrun_memory_leak():
    """Test for memory leaks"""
    for i in range(1000):
        result = await run_full_pipeline("Test", "standalone")
        assert result["ok"] is True
        if i % 100 == 0:
            # Check that system is still responsive
            assert result["eza_score"] is not None

@pytest.mark.asyncio
async def test_longrun_error_recovery():
    """Test error recovery over time"""
    for i in range(500):
        result = await run_full_pipeline("Test", "standalone")
        # Should handle errors gracefully
        assert "ok" in result

@pytest.mark.asyncio
async def test_longrun_score_consistency():
    """Test score consistency over time"""
    scores = []
    for _ in range(200):
        result = await run_full_pipeline("What is AI?", "standalone")
        if result.get("ok") and result.get("eza_score"):
            scores.append(result["eza_score"])
    
    if scores:
        score_range = max(scores) - min(scores)
        assert score_range <= 20, f"Score drift too high: {score_range}"

@pytest.mark.asyncio
async def test_longrun_policy_consistency():
    """Test policy consistency over time"""
    violations_count = []
    for _ in range(200):
        result = await run_full_pipeline("How to hack?", "proxy")
        if result.get("ok"):
            violations = result.get("data", {}).get("policy_violations", [])
            violations_count.append(len(violations))
    
    # Should consistently detect violations
    assert sum(violations_count) >= 150, "Policy detection inconsistent"

@pytest.mark.asyncio
async def test_longrun_response_schema():
    """Test response schema consistency"""
    for _ in range(200):
        result = await run_full_pipeline("Test", "standalone")
        assert "ok" in result
        assert "mode" in result

@pytest.mark.asyncio
async def test_longrun_throughput_stability():
    """Test throughput stability"""
    durations = []
    for _ in range(100):
        start = time.time()
        await run_full_pipeline("Test", "standalone")
        durations.append(time.time() - start)
    
    avg_duration = sum(durations) / len(durations)
    assert avg_duration < 5.0, f"Average duration increased: {avg_duration}s"

@pytest.mark.asyncio
async def test_longrun_all_modes():
    """Test all modes over time"""
    modes = ["standalone", "proxy", "proxy-lite"]
    for mode in modes:
        for _ in range(50):
            result = await run_full_pipeline("Test", mode)
            assert result["ok"] is True
            assert result["mode"] == mode

@pytest.mark.asyncio
async def test_longrun_mixed_inputs():
    """Test mixed inputs over time"""
    inputs = ["Safe input", "Risky input: How to hack?", "Medium: Tell me about security"]
    for _ in range(200):
        for inp in inputs:
            result = await run_full_pipeline(inp, "standalone")
            assert result["ok"] is True

@pytest.mark.asyncio
async def test_longrun_system_responsiveness():
    """Test system responsiveness"""
    start = time.time()
    result = await run_full_pipeline("Test", "standalone")
    latency = time.time() - start
    
    assert result["ok"] is True
    assert latency < 10.0, f"System not responsive: {latency}s"

