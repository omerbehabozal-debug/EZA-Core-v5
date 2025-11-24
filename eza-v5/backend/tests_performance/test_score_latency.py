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

