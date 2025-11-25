# -*- coding: utf-8 -*-
"""Score Latency Tests (5 tests)"""
import pytest
import time
from backend.api.pipeline_runner import run_full_pipeline

@pytest.mark.asyncio
async def test_score_latency_standalone():
    """Test score calculation latency in standalone"""
    start = time.time()
    result = await run_full_pipeline("Test", "standalone")
    latency = time.time() - start
    
    assert result["ok"] is True
    assert latency < 5.0, f"Latency too high: {latency}s"
    assert result["eza_score"] is not None

@pytest.mark.asyncio
async def test_score_latency_proxy():
    """Test score calculation latency in proxy"""
    start = time.time()
    result = await run_full_pipeline("Test", "proxy")
    latency = time.time() - start
    
    assert result["ok"] is True
    assert latency < 10.0, f"Latency too high: {latency}s"

@pytest.mark.asyncio
async def test_score_latency_risky_input():
    """Test latency with risky input"""
    start = time.time()
    result = await run_full_pipeline("How to hack?", "proxy")
    latency = time.time() - start
    
    assert result["ok"] is True
    assert latency < 10.0

@pytest.mark.asyncio
async def test_score_latency_policy_evaluation():
    """Test policy evaluation latency"""
    start = time.time()
    result = await run_full_pipeline("How to hack?", "proxy")
    latency = time.time() - start
    
    assert result["ok"] is True
    # Policy evaluation should not add significant latency
    assert latency < 12.0

@pytest.mark.asyncio
async def test_score_latency_consistency():
    """Test latency consistency"""
    latencies = []
    for _ in range(20):
        start = time.time()
        await run_full_pipeline("Test", "standalone")
        latencies.append(time.time() - start)
    
    avg_latency = sum(latencies) / len(latencies)
    assert avg_latency < 5.0, f"Average latency too high: {avg_latency}s"


@pytest.mark.asyncio
async def test_score_latency_proxy_lite():
    """Test score calculation latency in proxy-lite mode"""
    start = time.time()
    result = await run_full_pipeline("Test", "proxy-lite", output_text="Test output")
    latency = time.time() - start
    
    assert result["ok"] is True
    assert latency < 3.0, f"Proxy-lite latency too high: {latency}s"


@pytest.mark.asyncio
async def test_score_latency_long_input():
    """Test latency with long input"""
    long_input = "What is AI? " * 100
    start = time.time()
    result = await run_full_pipeline(long_input, "proxy")
    latency = time.time() - start
    
    assert result["ok"] is True
    assert latency < 15.0, f"Long input latency too high: {latency}s"


@pytest.mark.asyncio
async def test_score_latency_complex_analysis():
    """Test latency with complex analysis requirements"""
    complex_input = "How to hack into a system and commit fraud while avoiding detection?"
    start = time.time()
    result = await run_full_pipeline(complex_input, "proxy")
    latency = time.time() - start
    
    assert result["ok"] is True
    assert latency < 12.0, f"Complex analysis latency too high: {latency}s"
