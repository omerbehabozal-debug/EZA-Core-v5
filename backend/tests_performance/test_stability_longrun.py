# -*- coding: utf-8 -*-
"""
Stability and Long-Run Performance Tests (8 tests)
Tests system stability over extended periods using fake_llm for cost efficiency
"""
import pytest
import asyncio
import time
from backend.api.pipeline_runner import run_full_pipeline
from backend.test_tools.llm_override import FakeLLM


@pytest.mark.asyncio
async def test_stability_100_requests():
    """Test stability over 100 requests"""
    fake_llm = FakeLLM()
    request_count = 0
    errors = 0
    
    for _ in range(100):
        result = await run_full_pipeline("Test input", "standalone", llm_override=fake_llm)
        if result.get("ok"):
            request_count += 1
        else:
            errors += 1
    
    assert request_count >= 95, f"Too many failures: {errors}"
    assert errors < 10, f"Error rate too high: {errors}/100"


@pytest.mark.asyncio
async def test_stability_200_requests():
    """Test stability over 200 requests"""
    fake_llm = FakeLLM()
    request_count = 0
    
    for i in range(200):
        result = await run_full_pipeline("Test", "standalone", llm_override=fake_llm)
        assert result.get("ok") is True, f"Request {i} failed"
        request_count += 1
        if i % 50 == 0:
            # Check that system is still responsive
            assert result["eza_score"] is not None
    
    assert request_count == 200, f"Only {request_count}/200 requests completed"


@pytest.mark.asyncio
async def test_stability_error_recovery():
    """Test error recovery over time"""
    fake_llm = FakeLLM()
    
    for i in range(150):
        result = await run_full_pipeline("Test", "standalone", llm_override=fake_llm)
        # Should handle errors gracefully
        assert "ok" in result, f"Request {i} missing 'ok' field"
        # With fake_llm, should always succeed
        assert result.get("ok") is True, f"Request {i} failed unexpectedly"


@pytest.mark.asyncio
async def test_stability_score_consistency():
    """Test score consistency over time"""
    fake_llm = FakeLLM()
    scores = []
    
    for _ in range(100):
        result = await run_full_pipeline("What is AI?", "standalone", llm_override=fake_llm)
        if result.get("ok") and result.get("eza_score"):
            scores.append(result["eza_score"])
    
    assert len(scores) >= 90, "Too few successful scores"
    if len(scores) > 1:
        score_range = max(scores) - min(scores)
        # Scores should be relatively consistent
        assert score_range <= 40, f"Score range too high over time: {score_range}"


@pytest.mark.asyncio
async def test_stability_policy_consistency():
    """Test policy detection consistency over time"""
    fake_llm = FakeLLM()
    violations_count = 0
    
    for _ in range(80):
        result = await run_full_pipeline("How to hack?", "proxy", llm_override=fake_llm)
        if result.get("ok"):
            violations = result.get("data", {}).get("policy_violations", [])
            if violations:
                violations_count += 1
    
    # Policy detection should be consistent
    assert violations_count >= 70, f"Policy detection inconsistent: {violations_count}/80"


@pytest.mark.asyncio
async def test_stability_response_schema():
    """Test response schema consistency over time"""
    fake_llm = FakeLLM()
    
    for i in range(100):
        result = await run_full_pipeline("Test", "standalone", llm_override=fake_llm)
        assert "ok" in result, f"Request {i} missing 'ok'"
        assert "mode" in result, f"Request {i} missing 'mode'"
        assert "eza_score" in result, f"Request {i} missing 'eza_score'"
        assert result["mode"] == "standalone", f"Request {i} wrong mode"


@pytest.mark.asyncio
async def test_stability_throughput_consistency():
    """Test throughput consistency over time"""
    fake_llm = FakeLLM()
    throughputs = []
    
    for _ in range(5):
        start = time.perf_counter()
        tasks = [run_full_pipeline("Test", "standalone", llm_override=fake_llm) for _ in range(10)]
        await asyncio.gather(*tasks)
        duration = time.perf_counter() - start
        throughputs.append(10 / duration)
    
    # Throughput should be relatively consistent
    if len(throughputs) > 1:
        throughput_range = max(throughputs) - min(throughputs)
        avg_throughput = sum(throughputs) / len(throughputs)
        # Range should not be too large relative to average
        assert throughput_range < avg_throughput * 0.5, f"Throughput too inconsistent: {throughput_range:.2f}"


@pytest.mark.asyncio
async def test_stability_all_modes():
    """Test stability across all modes"""
    fake_llm = FakeLLM()
    modes = ["standalone", "proxy", "proxy-lite"]
    
    for mode in modes:
        for _ in range(30):
            if mode == "proxy-lite":
                result = await run_full_pipeline("Test", mode, output_text="Output", llm_override=fake_llm)
            else:
                result = await run_full_pipeline("Test", mode, llm_override=fake_llm)
            assert result.get("ok") is True, f"Mode {mode} failed"

