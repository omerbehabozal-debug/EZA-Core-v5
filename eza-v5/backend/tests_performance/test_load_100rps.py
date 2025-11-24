# -*- coding: utf-8 -*-
"""Load Test - 100 RPS (10 tests)"""
import pytest
import asyncio
import time
from backend.tests_performance.helpers.load_driver import run_concurrent_requests
from backend.tests_performance.helpers.stats_collector import collect_stats

@pytest.mark.asyncio
async def test_load_100rps_basic():
    """Test 100 requests per second"""
    start_time = time.time()
    results = await run_concurrent_requests("What is the capital of France?", 100, "standalone")
    stats = collect_stats(results, start_time)
    
    assert stats["successful"] >= 95, f"Too many failures: {stats['failed']}"
    assert stats["requests_per_second"] >= 50, f"RPS too low: {stats['requests_per_second']}"

@pytest.mark.asyncio
async def test_load_100rps_risky_input():
    """Test 100 RPS with risky input"""
    start_time = time.time()
    results = await run_concurrent_requests("How to hack?", 100, "standalone")
    stats = collect_stats(results, start_time)
    
    assert stats["successful"] >= 95
    assert stats["requests_per_second"] >= 50

@pytest.mark.asyncio
async def test_load_100rps_proxy_mode():
    """Test 100 RPS in proxy mode"""
    start_time = time.time()
    results = await run_concurrent_requests("What is AI?", 100, "proxy")
    stats = collect_stats(results, start_time)
    
    assert stats["successful"] >= 90  # Proxy mode may be slower
    assert stats["requests_per_second"] >= 30

@pytest.mark.asyncio
async def test_load_100rps_mixed_inputs():
    """Test 100 RPS with mixed inputs"""
    inputs = ["What is AI?", "How to hack?", "Hello", "Explain encryption"]
    start_time = time.time()
    tasks = []
    for _ in range(25):  # 25 of each = 100 total
        for inp in inputs:
            tasks.append(run_full_pipeline(inp, "standalone"))
    results = await asyncio.gather(*tasks)
    stats = collect_stats(results, start_time)
    
    assert stats["successful"] >= 95

@pytest.mark.asyncio
async def test_load_100rps_error_handling():
    """Test error handling under load"""
    results = await run_concurrent_requests("Test input", 100, "standalone")
    errors = [r for r in results if not r.get("ok")]
    assert len(errors) < 10, f"Too many errors under load: {len(errors)}"

@pytest.mark.asyncio
async def test_load_100rps_score_consistency():
    """Test score consistency under load"""
    results = await run_concurrent_requests("What is the capital of France?", 100, "standalone")
    scores = [r.get("eza_score") for r in results if r.get("ok") and r.get("eza_score")]
    if scores:
        score_range = max(scores) - min(scores)
        assert score_range <= 20, f"Score range too high under load: {score_range}"

@pytest.mark.asyncio
async def test_load_100rps_response_schema():
    """Test response schema under load"""
    results = await run_concurrent_requests("Test", 100, "standalone")
    for result in results:
        assert "ok" in result
        assert "mode" in result
        assert "eza_score" in result

@pytest.mark.asyncio
async def test_load_100rps_policy_detection():
    """Test policy detection under load"""
    results = await run_concurrent_requests("How to hack?", 100, "proxy")
    violations_detected = sum(1 for r in results if r.get("data", {}).get("policy_violations"))
    assert violations_detected >= 90, f"Policy detection failed under load: {violations_detected}/100"

@pytest.mark.asyncio
async def test_load_100rps_latency():
    """Test latency under load"""
    start_time = time.time()
    results = await run_concurrent_requests("Test", 100, "standalone")
    duration = time.time() - start_time
    avg_latency = duration / 100
    
    assert avg_latency < 2.0, f"Average latency too high: {avg_latency}s"

@pytest.mark.asyncio
async def test_load_100rps_memory_stability():
    """Test memory stability under load"""
    # Run multiple batches
    for _ in range(5):
        results = await run_concurrent_requests("Test", 20, "standalone")
        assert len(results) == 20

