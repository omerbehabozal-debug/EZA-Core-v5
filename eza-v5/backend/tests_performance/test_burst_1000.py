# -*- coding: utf-8 -*-
"""Burst Test - 1000 requests (10 tests)"""
import pytest
import asyncio
import time
from backend.tests_performance.helpers.load_driver import run_concurrent_requests
from backend.tests_performance.helpers.stats_collector import collect_stats

@pytest.mark.asyncio
async def test_burst_1000_basic():
    """Test 1000 request burst"""
    start_time = time.time()
    results = await run_concurrent_requests("What is AI?", 1000, "standalone")
    stats = collect_stats(results, start_time)
    
    assert stats["successful"] >= 950, f"Too many failures: {stats['failed']}"

@pytest.mark.asyncio
async def test_burst_1000_error_rate():
    """Test error rate in burst"""
    results = await run_concurrent_requests("Test", 1000, "standalone")
    error_rate = sum(1 for r in results if not r.get("ok")) / len(results)
    assert error_rate < 0.05, f"Error rate too high: {error_rate}"

@pytest.mark.asyncio
async def test_burst_1000_throughput():
    """Test throughput in burst"""
    start_time = time.time()
    results = await run_concurrent_requests("Test", 1000, "standalone")
    duration = time.time() - start_time
    throughput = 1000 / duration
    
    assert throughput >= 10, f"Throughput too low: {throughput} req/s"

@pytest.mark.asyncio
async def test_burst_1000_score_distribution():
    """Test score distribution in burst"""
    results = await run_concurrent_requests("What is AI?", 1000, "standalone")
    scores = [r.get("eza_score") for r in results if r.get("ok") and r.get("eza_score")]
    assert len(scores) >= 950, "Too few successful scores"

@pytest.mark.asyncio
async def test_burst_1000_response_time():
    """Test response time in burst"""
    start = time.time()
    results = await run_concurrent_requests("Test", 1000, "standalone")
    duration = time.time() - start
    avg_time = duration / 1000
    
    assert avg_time < 5.0, f"Average response time too high: {avg_time}s"

@pytest.mark.asyncio
async def test_burst_1000_concurrent_safety():
    """Test concurrent safety"""
    results = await run_concurrent_requests("How to hack?", 1000, "proxy")
    violations = sum(1 for r in results if r.get("data", {}).get("policy_violations"))
    assert violations >= 900, "Policy detection failed in burst"

@pytest.mark.asyncio
async def test_burst_1000_resource_usage():
    """Test resource usage"""
    results = await run_concurrent_requests("Test", 1000, "standalone")
    # Just check that all completed
    assert len(results) == 1000

@pytest.mark.asyncio
async def test_burst_1000_mixed_modes():
    """Test burst with mixed modes"""
    tasks = []
    for _ in range(333):
        tasks.append(run_full_pipeline("Test", "standalone"))
        tasks.append(run_full_pipeline("Test", "proxy"))
        tasks.append(run_full_pipeline("Test", "proxy-lite"))
    results = await asyncio.gather(*tasks)
    assert len(results) == 999

@pytest.mark.asyncio
async def test_burst_1000_stability():
    """Test system stability"""
    # Run multiple smaller bursts
    for _ in range(10):
        results = await run_concurrent_requests("Test", 100, "standalone")
        assert len(results) == 100

@pytest.mark.asyncio
async def test_burst_1000_data_integrity():
    """Test data integrity under burst"""
    results = await run_concurrent_requests("Test", 1000, "standalone")
    for result in results:
        if result.get("ok"):
            assert "data" in result
            assert "eza_score" in result

