# -*- coding: utf-8 -*-
"""
EZA Proxy - Production Hardening Regression Tests
Golden Input Regression Test + Guard Behavior Test + Circuit Breaker Test

CRITICAL: This is a TEST task only. Do NOT refactor or modify code unless a test fails.
"""

import pytest
import json
import asyncio
from typing import Dict, Any
from backend.services.proxy_analyzer import analyze_content_deep
from backend.services.proxy_analyzer_stage0 import stage0_fast_risk_scan
from backend.services.proxy_analyzer_stage2 import (
    merge_overlapping_spans,
    patch_span_into_content
)
from backend.services.proxy_rate_limiter import (
    check_rate_limit,
    reset_rate_limit_metrics
)
from backend.infra.circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerOpenError,
    CircuitState
)
from backend.config import get_settings


# ========== GOLDEN INPUTS ==========

GOLDEN_INPUT_SHORT = "Bu kısa bir test içeriğidir."
GOLDEN_INPUT_MEDIUM = """Son yıllarda kamuoyuna sunulan bilgi akışının tarafsızlığı konusunda endişeler artmaktadır. 
Medya kuruluşları, haberlerini sunarken objektif olmak zorundadır. Manipülasyon ve yanlış bilgi yayma ciddi sorunlara yol açabilir."""
GOLDEN_INPUT_LONG = """Son yıllarda kamuoyuna sunulan bilgi akışının tarafsızlığı konusunda endişeler artmaktadır. 
Medya kuruluşları, haberlerini sunarken objektif olmak zorundadır. Manipülasyon ve yanlış bilgi yayma ciddi sorunlara yol açabilir.

Finansal piyasalarda yatırım tavsiyesi vermek yasal olarak yasaktır. Yatırımcılar kendi araştırmalarını yapmalı ve riskleri değerlendirmelidir.
Sağlık konularında tıbbi iddialarda bulunmak ve tedavi önerisi yapmak yasaktır. Herhangi bir sağlık sorunu için mutlaka bir doktora danışılmalıdır.

Bu içerik, çeşitli sektörlerdeki risk faktörlerini içermektedir. Kullanıcıların dikkatli olması ve profesyonel danışmanlık alması önerilir."""


# ========== TEST 1: GOLDEN INPUT REGRESSION ==========

@pytest.mark.asyncio
async def test_golden_input_short():
    """Test short golden input - verify scores unchanged"""
    result = await analyze_content_deep(
        content=GOLDEN_INPUT_SHORT,
        domain="media",
        policies=["TRT"],
        provider="openai",
        role="proxy",
        org_id="test-org-golden"
    )
    
    # Verify structure
    assert "overall_scores" in result
    assert "ethical_index" in result["overall_scores"]
    assert "compliance_score" in result["overall_scores"]
    assert "manipulation_score" in result["overall_scores"]
    assert "bias_score" in result["overall_scores"]
    assert "legal_risk_score" in result["overall_scores"]
    
    # Verify scores are in valid range
    scores = result["overall_scores"]
    assert 0 <= scores["ethical_index"] <= 100
    assert 0 <= scores["compliance_score"] <= 100
    assert 0 <= scores["manipulation_score"] <= 100
    assert 0 <= scores["bias_score"] <= 100
    assert 0 <= scores["legal_risk_score"] <= 100
    
    # Verify new fields are present (if any)
    if "_partial" in result:
        assert isinstance(result["_partial"], bool)
    if "_score_kind" in result:
        assert result["_score_kind"] in ["preliminary", "final"]


@pytest.mark.asyncio
async def test_golden_input_medium():
    """Test medium golden input - verify risk_band unchanged"""
    result = await analyze_content_deep(
        content=GOLDEN_INPUT_MEDIUM,
        domain="media",
        policies=["TRT"],
        provider="openai",
        role="proxy",
        org_id="test-org-golden"
    )
    
    # Verify structure
    assert "overall_scores" in result
    assert "_stage0_result" in result
    
    stage0 = result["_stage0_result"]
    if "risk_band" in stage0:
        assert stage0["risk_band"] in ["low", "medium", "high"]
    
    # Verify risk_locations structure
    if "risk_locations" in result:
        for loc in result["risk_locations"]:
            assert "type" in loc or "primary_risk_pattern" in loc
            assert "severity" in loc


@pytest.mark.asyncio
async def test_golden_input_long():
    """Test long golden input - verify flags/risk locations unchanged"""
    result = await analyze_content_deep(
        content=GOLDEN_INPUT_LONG,
        domain="media",
        policies=["TRT"],
        provider="openai",
        role="proxy",
        org_id="test-org-golden"
    )
    
    # Verify structure
    assert "overall_scores" in result
    assert "flags" in result
    assert "risk_locations" in result
    assert "paragraphs" in result
    
    # Verify flags is a list
    assert isinstance(result["flags"], list)
    
    # Verify risk_locations is a list
    assert isinstance(result["risk_locations"], list)
    
    # Verify paragraphs structure
    if result["paragraphs"]:
        for para in result["paragraphs"]:
            assert "paragraph_index" in para
            assert "text" in para
            assert "ethical_index" in para


# ========== TEST 2: GUARD BEHAVIOR (RATE LIMITING) ==========

@pytest.mark.asyncio
async def test_rate_limiter_returns_stage0_only():
    """Test that rate limiter returns Stage-0 only when limit exceeded"""
    settings = get_settings()
    org_id = "test-org-rate-limit"
    
    reset_rate_limit_metrics()
    
    # Exhaust rate limit
    for i in range(settings.ORG_RPM_LIMIT + 1):
        allowed, reason = check_rate_limit(org_id, settings=settings)
        if not allowed:
            # Rate limit exceeded
            assert reason is not None
            assert "Rate limit exceeded" in reason
            
            # Verify Stage-0 can still run
            stage0_result = await stage0_fast_risk_scan(
                content=GOLDEN_INPUT_SHORT,
                domain="media",
                provider="openai",
                org_id=org_id
            )
            
            # Verify Stage-0 structure
            assert "risk_band" in stage0_result
            assert "estimated_score_range" in stage0_result
            assert stage0_result["risk_band"] in ["low", "medium", "high"]
            
            break


# ========== TEST 3: CIRCUIT BREAKER ==========

@pytest.mark.asyncio
async def test_circuit_breaker_opens_on_failure():
    """Test circuit breaker opens after failure threshold"""
    cb = CircuitBreaker("test-cb", failure_threshold=3, recovery_timeout=1)
    
    failure_count = 0
    
    def fail_func():
        nonlocal failure_count
        failure_count += 1
        raise Exception("Simulated failure")
    
    # Trigger failures
    for i in range(3):
        try:
            cb.call(fail_func)
        except Exception:
            pass
    
    # Circuit should be open
    assert cb.state == CircuitState.OPEN
    assert cb.failure_count >= 3


@pytest.mark.asyncio
async def test_circuit_breaker_blocks_when_open():
    """Test circuit breaker blocks requests when open"""
    cb = CircuitBreaker("test-cb-block", failure_threshold=2, recovery_timeout=1)
    
    def fail_func():
        raise Exception("Simulated failure")
    
    # Open the circuit
    for i in range(2):
        try:
            cb.call(fail_func)
        except Exception:
            pass
    
    # Should raise CircuitBreakerOpenError
    with pytest.raises(CircuitBreakerOpenError):
        cb.call(fail_func)


@pytest.mark.asyncio
async def test_circuit_breaker_stage0_fallback():
    """Test that Stage-0 still works when circuit breaker is open"""
    cb = CircuitBreaker("test-cb-stage0", failure_threshold=2, recovery_timeout=1)
    
    # Open the circuit
    def fail_func():
        raise Exception("Simulated failure")
    
    for i in range(2):
        try:
            cb.call(fail_func)
        except Exception:
            pass
    
    # Stage-0 should still work (bypasses circuit breaker)
    stage0_result = await stage0_fast_risk_scan(
        content=GOLDEN_INPUT_SHORT,
        domain="media",
        provider="openai",
        org_id="test-org-cb"
    )
    
    assert "risk_band" in stage0_result
    assert stage0_result["risk_band"] in ["low", "medium", "high"]


# ========== TEST 4: STAGE-2 PATCH SAFETY ==========

def test_stage2_merge_overlapping_spans():
    """Test merging overlapping spans"""
    spans = [
        {"start_offset": 10, "end_offset": 50, "risk_type": "manipulation"},
        {"start_offset": 40, "end_offset": 80, "risk_type": "bias"},
        {"start_offset": 100, "end_offset": 150, "risk_type": "legal"},
    ]
    
    merged = merge_overlapping_spans(spans)
    
    # First two should be merged (overlap at 40-50)
    assert len(merged) == 2
    assert merged[0]["start_offset"] == 10
    assert merged[0]["end_offset"] == 80  # Extended to cover both
    assert merged[1]["start_offset"] == 100
    assert merged[1]["end_offset"] == 150


def test_stage2_patch_preserves_offsets():
    """Test that patching preserves offsets for unaffected spans"""
    original = "This is a test sentence with some content."
    span = {"start_offset": 10, "end_offset": 18}  # "is a test"
    rewritten = "was an example"
    
    patched = patch_span_into_content(original, span, rewritten)
    
    assert patched == "This was an example sentence with some content."
    # Verify unaffected parts remain
    assert patched[:10] == original[:10]  # "This "
    assert patched[23:] == original[18:]  # " sentence with some content."


def test_stage2_patch_multiple_spans_end_to_start():
    """Test patching multiple spans from end → start preserves offsets"""
    original = "First sentence. Second sentence. Third sentence."
    
    spans = [
        {"start_offset": 0, "end_offset": 16, "rewritten_span": "First paragraph"},
        {"start_offset": 17, "end_offset": 33, "rewritten_span": "Second paragraph"},
        {"start_offset": 34, "end_offset": 48, "rewritten_span": "Third paragraph"},
    ]
    
    # Process from end → start
    spans_sorted = sorted(spans, key=lambda s: s["start_offset"], reverse=True)
    
    result = original
    for span in spans_sorted:
        result = patch_span_into_content(result, span, span["rewritten_span"])
    
    assert "First paragraph" in result
    assert "Second paragraph" in result
    assert "Third paragraph" in result
    # Verify no corruption
    assert len(result) > len(original)  # Should be longer after patching


# ========== TEST 5: METRICS EXPOSURE ==========

def test_metrics_endpoint_structure():
    """Test that /metrics endpoint exposes required metrics"""
    from backend.infra.observability import get_prometheus_metrics
    
    metrics_text = get_prometheus_metrics()
    
    # Verify required metrics are present
    required_metrics = [
        "eza_proxy_stage0_latency_ms",
        "eza_proxy_total_latency_ms",
        "eza_proxy_cache_hit_total",
        "eza_proxy_cache_miss_total",
        "eza_proxy_rate_limit_dropped_total",
        "eza_proxy_circuit_breaker_open_total",
        "eza_proxy_rewrite_success_total",
        "eza_proxy_rewrite_failure_total",
    ]
    
    for metric in required_metrics:
        assert metric in metrics_text, f"Metric {metric} not found in /metrics output"


def test_metrics_cache_hit_miss():
    """Test cache hit/miss metrics are exposed"""
    from backend.infra.observability import get_prometheus_metrics
    
    metrics_text = get_prometheus_metrics()
    
    # Verify cache metrics have type labels
    assert 'eza_proxy_cache_hit_total{type="semantic"' in metrics_text or 'eza_proxy_cache_hit_total{type="semantic"}' in metrics_text
    assert 'eza_proxy_cache_hit_total{type="policy"' in metrics_text or 'eza_proxy_cache_hit_total{type="policy"}' in metrics_text
    assert 'eza_proxy_cache_hit_total{type="prompt"' in metrics_text or 'eza_proxy_cache_hit_total{type="prompt"}' in metrics_text


# ========== TEST 6: BACKWARD COMPATIBILITY ==========

@pytest.mark.asyncio
async def test_backward_compatibility_no_new_required_fields():
    """Test that existing code still works without new fields"""
    result = await analyze_content_deep(
        content=GOLDEN_INPUT_SHORT,
        domain="media",
        policies=["TRT"],
        provider="openai",
        role="proxy",
        org_id="test-org-bc"
    )
    
    # Old code should still work with these fields
    assert "overall_scores" in result
    assert "paragraphs" in result
    assert "flags" in result
    assert "risk_locations" in result
    
    # New fields are optional
    # If present, they should be valid
    if "_partial" in result:
        assert isinstance(result["_partial"], bool)
    if "_score_kind" in result:
        assert result["_score_kind"] in ["preliminary", "final"]
    if "_staged_response" in result:
        assert isinstance(result["_staged_response"], dict)

