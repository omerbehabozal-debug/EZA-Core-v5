# -*- coding: utf-8 -*-
"""
Burst and Throughput Performance Tests (12 tests)
Tests system behavior under burst load using fake_llm for cost efficiency
"""
import pytest
import asyncio
import time
from backend.api.pipeline_runner import run_full_pipeline
from backend.test_tools.llm_override import FakeLLM
from backend.tests_performance.helpers.stats_collector import collect_stats


async def run_burst_requests(input_text: str, count: int, mode: str = "standalone"):
    """Run burst of requests with fake LLM"""
    fake_llm = FakeLLM()
    tasks = [run_full_pipeline(input_text, mode, llm_override=fake_llm) for _ in range(count)]
    return await asyncio.gather(*tasks)


@pytest.mark.asyncio
async def test_burst_20_basic():
    """Test 20 request burst"""
    start_time = time.time()
    results = await run_burst_requests("What is AI?", 20, "standalone")
    stats = collect_stats(results, start_time)
    
    assert stats["successful"] >= 18, f"Too many failures: {stats['failed']}"
    assert stats["duration_seconds"] < 10.0, f"Burst took too long: {stats['duration_seconds']:.2f}s"


@pytest.mark.asyncio
async def test_burst_50_basic():
    """Test 50 request burst"""
    start_time = time.time()
    results = await run_burst_requests("Test input", 50, "standalone")
    stats = collect_stats(results, start_time)
    
    assert stats["successful"] >= 45, f"Too many failures: {stats['failed']}"
    assert stats["duration_seconds"] < 20.0, f"Burst took too long: {stats['duration_seconds']:.2f}s"


@pytest.mark.asyncio
async def test_burst_error_rate():
    """Test error rate in burst"""
    results = await run_burst_requests("Test", 30, "standalone")
    error_rate = sum(1 for r in results if not r.get("ok")) / len(results)
    assert error_rate < 0.1, f"Error rate too high: {error_rate:.2%}"


@pytest.mark.asyncio
async def test_burst_throughput():
    """Test throughput in burst"""
    start_time = time.time()
    results = await run_burst_requests("Test", 40, "standalone")
    duration = time.time() - start_time
    throughput = len(results) / duration if duration > 0 else 0
    
    assert throughput >= 5.0, f"Throughput too low: {throughput:.2f} req/s"


@pytest.mark.asyncio
async def test_burst_response_time():
    """Test response time in burst"""
    start = time.time()
    results = await run_burst_requests("Test", 25, "standalone")
    duration = time.time() - start
    avg_time = duration / len(results) if len(results) > 0 else 0
    
    assert avg_time < 2.0, f"Average response time too high: {avg_time:.3f}s"


@pytest.mark.asyncio
async def test_burst_proxy_mode():
    """Test burst in proxy mode"""
    start_time = time.time()
    results = await run_burst_requests("What is AI?", 20, "proxy")
    stats = collect_stats(results, start_time)
    
    assert stats["successful"] >= 18
    assert stats["duration_seconds"] < 15.0


@pytest.mark.asyncio
async def test_burst_mixed_modes():
    """Test burst with mixed modes"""
    fake_llm = FakeLLM()
    tasks = []
    for _ in range(10):
        tasks.append(run_full_pipeline("Test", "standalone", llm_override=fake_llm))
        tasks.append(run_full_pipeline("Test", "proxy", llm_override=fake_llm))
    results = await asyncio.gather(*tasks)
    
    assert len(results) == 20
    assert sum(1 for r in results if r.get("ok")) >= 18


@pytest.mark.asyncio
async def test_burst_risky_input():
    """Test burst with risky input"""
    start_time = time.time()
    results = await run_burst_requests("How to hack?", 20, "proxy")
    stats = collect_stats(results, start_time)
    
    assert stats["successful"] >= 18
    # Risky inputs may take slightly longer
    assert stats["duration_seconds"] < 15.0


@pytest.mark.asyncio
async def test_burst_data_integrity():
    """Test data integrity under burst"""
    results = await run_burst_requests("Test", 30, "standalone")
    for result in results:
        if result.get("ok"):
            assert "data" in result
            assert "eza_score" in result
            assert isinstance(result["eza_score"], (int, float))


@pytest.mark.asyncio
async def test_burst_stability():
    """Test system stability under multiple bursts"""
    # Run multiple smaller bursts
    for _ in range(5):
        results = await run_burst_requests("Test", 10, "standalone")
        assert len(results) == 10
        assert sum(1 for r in results if r.get("ok")) >= 9


@pytest.mark.asyncio
async def test_burst_score_distribution():
    """Test score distribution in burst"""
    results = await run_burst_requests("What is AI?", 25, "standalone")
    scores = [r.get("eza_score") for r in results if r.get("ok") and r.get("eza_score")]
    assert len(scores) >= 20, "Too few successful scores"
    # Scores should be reasonable
    assert all(0 <= s <= 100 for s in scores), "Scores out of range"


@pytest.mark.asyncio
async def test_burst_concurrent_safety():
    """Test concurrent safety in burst"""
    results = await run_burst_requests("How to hack?", 20, "proxy")
    violations = sum(1 for r in results if r.get("data", {}).get("policy_violations"))
    # At least some should detect violations
    assert violations >= 15, f"Policy detection failed in burst: {violations}/20"

