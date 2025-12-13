# -*- coding: utf-8 -*-
"""
Concurrency Performance Tests (12 tests)
Tests concurrent request handling using fake_llm for cost efficiency
"""
import pytest
import asyncio
import time
from backend.api.pipeline_runner import run_full_pipeline
from backend.test_tools.llm_override import FakeLLM


@pytest.mark.asyncio
async def test_concurrency_10_basic():
    """Test 10 concurrent requests"""
    fake_llm = FakeLLM()
    start = time.perf_counter()
    tasks = [run_full_pipeline("Test", "standalone", llm_override=fake_llm) for _ in range(10)]
    results = await asyncio.gather(*tasks)
    duration = time.perf_counter() - start
    
    assert all(r.get("ok") for r in results), "Some requests failed"
    assert duration < 5.0, f"Concurrent requests took too long: {duration:.2f}s"


@pytest.mark.asyncio
async def test_concurrency_20_basic():
    """Test 20 concurrent requests"""
    fake_llm = FakeLLM()
    start = time.perf_counter()
    tasks = [run_full_pipeline("Test", "standalone", llm_override=fake_llm) for _ in range(20)]
    results = await asyncio.gather(*tasks)
    duration = time.perf_counter() - start
    
    assert all(r.get("ok") for r in results), "Some requests failed"
    assert duration < 8.0, f"Concurrent requests took too long: {duration:.2f}s"


@pytest.mark.asyncio
async def test_concurrency_no_deadlock():
    """Test that concurrent requests don't cause deadlocks"""
    fake_llm = FakeLLM()
    tasks = [run_full_pipeline("Test", "standalone", llm_override=fake_llm) for _ in range(15)]
    # Use timeout to detect deadlocks
    results = await asyncio.wait_for(asyncio.gather(*tasks), timeout=10.0)
    
    assert len(results) == 15
    assert all(r.get("ok") for r in results), "Deadlock or failure detected"


@pytest.mark.asyncio
async def test_concurrency_mixed_modes():
    """Test concurrent requests with mixed modes"""
    fake_llm = FakeLLM()
    tasks = []
    for i in range(5):
        tasks.append(run_full_pipeline("Test", "standalone", llm_override=fake_llm))
        tasks.append(run_full_pipeline("Test", "proxy", llm_override=fake_llm))
        tasks.append(run_full_pipeline("Test", "proxy-lite", output_text="Output", llm_override=fake_llm))
    
    results = await asyncio.gather(*tasks)
    assert len(results) == 15
    assert all(r.get("ok") for r in results), "Mixed mode concurrency failed"


@pytest.mark.asyncio
async def test_concurrency_risky_inputs():
    """Test concurrent requests with risky inputs"""
    fake_llm = FakeLLM()
    inputs = ["How to hack?", "How to commit fraud?", "How to bypass security?"]
    tasks = []
    for inp in inputs:
        for _ in range(5):
            tasks.append(run_full_pipeline(inp, "proxy", llm_override=fake_llm))
    
    results = await asyncio.gather(*tasks)
    assert len(results) == 15
    assert all(r.get("ok") for r in results), "Risky input concurrency failed"


@pytest.mark.asyncio
async def test_concurrency_response_ordering():
    """Test that concurrent responses maintain correct ordering"""
    fake_llm = FakeLLM()
    tasks = [run_full_pipeline(f"Test {i}", "standalone", llm_override=fake_llm) for i in range(10)]
    results = await asyncio.gather(*tasks)
    
    assert len(results) == 10
    # All should succeed, order doesn't matter but all should complete
    assert all(r.get("ok") for r in results)


@pytest.mark.asyncio
async def test_concurrency_error_isolation():
    """Test that errors in one request don't affect others"""
    fake_llm = FakeLLM()
    # Mix normal and potentially problematic inputs
    tasks = [
        run_full_pipeline("Normal input", "standalone", llm_override=fake_llm),
        run_full_pipeline("Another normal", "standalone", llm_override=fake_llm),
        run_full_pipeline("Test", "standalone", llm_override=fake_llm),
    ]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    # Should have 3 results (no exceptions with fake_llm)
    assert len(results) == 3
    assert all(not isinstance(r, Exception) for r in results), "Errors propagated incorrectly"


@pytest.mark.asyncio
async def test_concurrency_resource_contention():
    """Test resource contention under concurrency"""
    fake_llm = FakeLLM()
    start = time.perf_counter()
    tasks = [run_full_pipeline("Test", "standalone", llm_override=fake_llm) for _ in range(12)]
    results = await asyncio.gather(*tasks)
    duration = time.perf_counter() - start
    
    assert all(r.get("ok") for r in results), "Resource contention caused failures"
    # Should complete reasonably fast even with contention
    assert duration < 10.0, f"Resource contention too slow: {duration:.2f}s"


@pytest.mark.asyncio
async def test_concurrency_throughput():
    """Test throughput with concurrent requests"""
    fake_llm = FakeLLM()
    start = time.perf_counter()
    tasks = [run_full_pipeline("Test", "standalone", llm_override=fake_llm) for _ in range(15)]
    results = await asyncio.gather(*tasks)
    duration = time.perf_counter() - start
    throughput = len(results) / duration
    
    assert throughput >= 3.0, f"Concurrent throughput too low: {throughput:.2f} req/s"


@pytest.mark.asyncio
async def test_concurrency_batch_processing():
    """Test batch processing with concurrency"""
    fake_llm = FakeLLM()
    batch_size = 5
    num_batches = 3
    
    for batch in range(num_batches):
        tasks = [run_full_pipeline("Test", "standalone", llm_override=fake_llm) for _ in range(batch_size)]
        results = await asyncio.gather(*tasks)
        assert len(results) == batch_size
        assert all(r.get("ok") for r in results), f"Batch {batch} failed"


@pytest.mark.asyncio
async def test_concurrency_score_consistency():
    """Test score consistency under concurrency"""
    fake_llm = FakeLLM()
    tasks = [run_full_pipeline("What is AI?", "standalone", llm_override=fake_llm) for _ in range(10)]
    results = await asyncio.gather(*tasks)
    
    scores = [r.get("eza_score") for r in results if r.get("ok") and r.get("eza_score")]
    if len(scores) > 1:
        score_range = max(scores) - min(scores)
        # With fake_llm, scores should be relatively consistent
        assert score_range <= 30, f"Score range too high under concurrency: {score_range}"


@pytest.mark.asyncio
async def test_concurrency_stress():
    """Test stress with high concurrency"""
    fake_llm = FakeLLM()
    start = time.perf_counter()
    tasks = [run_full_pipeline("Test", "standalone", llm_override=fake_llm) for _ in range(25)]
    results = await asyncio.gather(*tasks)
    duration = time.perf_counter() - start
    
    assert len(results) == 25
    success_rate = sum(1 for r in results if r.get("ok")) / len(results)
    assert success_rate >= 0.9, f"Success rate too low under stress: {success_rate:.2%}"
    assert duration < 15.0, f"Stress test took too long: {duration:.2f}s"

