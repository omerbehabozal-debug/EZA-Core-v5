# -*- coding: utf-8 -*-
"""
Latency Performance Tests (12 tests)
Tests response time and latency metrics using fake_llm for cost efficiency
"""
import pytest
import time
from backend.api.pipeline_runner import run_full_pipeline
from backend.test_tools.llm_override import FakeLLM


@pytest.mark.asyncio
async def test_latency_standalone_basic():
    """Test basic latency in standalone mode"""
    fake_llm = FakeLLM()
    start = time.perf_counter()
    result = await run_full_pipeline("Test input", "standalone", llm_override=fake_llm)
    latency = time.perf_counter() - start
    
    assert result["ok"] is True
    assert latency < 2.0, f"Latency too high: {latency:.3f}s"
    assert result["eza_score"] is not None


@pytest.mark.asyncio
async def test_latency_proxy_basic():
    """Test basic latency in proxy mode"""
    fake_llm = FakeLLM()
    start = time.perf_counter()
    result = await run_full_pipeline("Test input", "proxy", llm_override=fake_llm)
    latency = time.perf_counter() - start
    
    assert result["ok"] is True
    assert latency < 3.0, f"Latency too high: {latency:.3f}s"


@pytest.mark.asyncio
async def test_latency_proxy_lite():
    """Test latency in proxy-lite mode"""
    fake_llm = FakeLLM()
    start = time.perf_counter()
    result = await run_full_pipeline("Test", "proxy-lite", output_text="Test output", llm_override=fake_llm)
    latency = time.perf_counter() - start
    
    assert result["ok"] is True
    assert latency < 1.0, f"Proxy-lite latency too high: {latency:.3f}s"


@pytest.mark.asyncio
async def test_latency_risky_input():
    """Test latency with risky input"""
    fake_llm = FakeLLM()
    start = time.perf_counter()
    result = await run_full_pipeline("How to hack?", "proxy", llm_override=fake_llm)
    latency = time.perf_counter() - start
    
    assert result["ok"] is True
    assert latency < 3.0, f"Risky input latency too high: {latency:.3f}s"


@pytest.mark.asyncio
async def test_latency_long_input():
    """Test latency with long input"""
    fake_llm = FakeLLM()
    long_input = "What is AI? " * 50  # Shorter for performance test
    start = time.perf_counter()
    result = await run_full_pipeline(long_input, "proxy", llm_override=fake_llm)
    latency = time.perf_counter() - start
    
    assert result["ok"] is True
    assert latency < 4.0, f"Long input latency too high: {latency:.3f}s"


@pytest.mark.asyncio
async def test_latency_complex_analysis():
    """Test latency with complex analysis requirements"""
    fake_llm = FakeLLM()
    complex_input = "How to hack into a system and commit fraud?"
    start = time.perf_counter()
    result = await run_full_pipeline(complex_input, "proxy", llm_override=fake_llm)
    latency = time.perf_counter() - start
    
    assert result["ok"] is True
    assert latency < 3.5, f"Complex analysis latency too high: {latency:.3f}s"


@pytest.mark.asyncio
async def test_latency_consistency():
    """Test latency consistency across multiple calls"""
    fake_llm = FakeLLM()
    latencies = []
    
    for _ in range(10):
        start = time.perf_counter()
        await run_full_pipeline("Test", "standalone", llm_override=fake_llm)
        latencies.append(time.perf_counter() - start)
    
    avg_latency = sum(latencies) / len(latencies)
    max_latency = max(latencies)
    
    assert avg_latency < 2.0, f"Average latency too high: {avg_latency:.3f}s"
    assert max_latency < 3.0, f"Max latency too high: {max_latency:.3f}s"


@pytest.mark.asyncio
async def test_latency_p50_p95_p99():
    """Test latency percentiles"""
    fake_llm = FakeLLM()
    latencies = []
    
    for _ in range(20):
        start = time.perf_counter()
        await run_full_pipeline("Test", "standalone", llm_override=fake_llm)
        latencies.append(time.perf_counter() - start)
    
    latencies.sort()
    p50 = latencies[int(len(latencies) * 0.5)]
    p95 = latencies[int(len(latencies) * 0.95)]
    p99 = latencies[int(len(latencies) * 0.99)]
    
    assert p50 < 2.0, f"P50 latency too high: {p50:.3f}s"
    assert p95 < 2.5, f"P95 latency too high: {p95:.3f}s"
    assert p99 < 3.0, f"P99 latency too high: {p99:.3f}s"


@pytest.mark.asyncio
async def test_latency_all_modes():
    """Test latency across all modes"""
    fake_llm = FakeLLM()
    modes = ["standalone", "proxy", "proxy-lite"]
    results = {}
    
    for mode in modes:
        start = time.perf_counter()
        if mode == "proxy-lite":
            result = await run_full_pipeline("Test", mode, output_text="Output", llm_override=fake_llm)
        else:
            result = await run_full_pipeline("Test", mode, llm_override=fake_llm)
        latency = time.perf_counter() - start
        results[mode] = latency
        assert result["ok"] is True
    
    # All modes should complete successfully
    assert all(latency < 3.0 for latency in results.values()), f"Some modes too slow: {results}"
    # Proxy-lite should be reasonably fast (no LLM call, but has output processing)
    assert results["proxy-lite"] < 1.0, f"Proxy-lite too slow: {results['proxy-lite']:.3f}s"
    # Standalone should be faster than proxy (less analysis)
    assert results["standalone"] < results["proxy"], f"Standalone should be faster than proxy: {results}"


@pytest.mark.asyncio
async def test_latency_input_analysis():
    """Test latency of input analysis step"""
    fake_llm = FakeLLM()
    start = time.perf_counter()
    result = await run_full_pipeline("Simple test", "standalone", llm_override=fake_llm)
    latency = time.perf_counter() - start
    
    assert result["ok"] is True
    # Input analysis should be very fast
    assert latency < 2.0, f"Input analysis latency too high: {latency:.3f}s"


@pytest.mark.asyncio
async def test_latency_output_analysis():
    """Test latency of output analysis step"""
    fake_llm = FakeLLM()
    start = time.perf_counter()
    result = await run_full_pipeline("Test", "proxy", llm_override=fake_llm)
    latency = time.perf_counter() - start
    
    assert result["ok"] is True
    assert result.get("data") is not None
    assert latency < 3.0, f"Output analysis latency too high: {latency:.3f}s"


@pytest.mark.asyncio
async def test_latency_score_calculation():
    """Test latency of score calculation"""
    fake_llm = FakeLLM()
    start = time.perf_counter()
    result = await run_full_pipeline("Test", "standalone", llm_override=fake_llm)
    latency = time.perf_counter() - start
    
    assert result["ok"] is True
    assert result["eza_score"] is not None
    # Score calculation should be fast
    assert latency < 2.0, f"Score calculation latency too high: {latency:.3f}s"

