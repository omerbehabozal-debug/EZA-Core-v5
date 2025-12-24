#!/usr/bin/env python3
"""
EZA Proxy - Production Hardening Regression Test Runner
Validates that recent changes did NOT break existing behavior
"""

import sys
import asyncio
import json
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir.parent))

from backend.services.proxy_analyzer import analyze_content_deep
from backend.services.proxy_analyzer_stage0 import stage0_fast_risk_scan
from backend.services.proxy_analyzer_stage2 import merge_overlapping_spans, patch_span_into_content
from backend.services.proxy_rate_limiter import check_rate_limit, reset_rate_limit_metrics
from backend.infra.circuit_breaker import CircuitBreaker, CircuitBreakerOpenError, CircuitState
from backend.infra.observability import get_prometheus_metrics
from backend.config import get_settings

# Test results
results = {
    "passed": [],
    "failed": []
}


def test_pass(test_name: str):
    """Record passing test"""
    results["passed"].append(test_name)
    print(f"✅ PASS: {test_name}")


def test_fail(test_name: str, reason: str):
    """Record failing test"""
    results["failed"].append({"test": test_name, "reason": reason})
    print(f"❌ FAIL: {test_name} - {reason}")


# ========== TEST 1: GOLDEN INPUT REGRESSION ==========

GOLDEN_INPUT_SHORT = "Bu kısa bir test içeriğidir."
GOLDEN_INPUT_MEDIUM = """Son yıllarda kamuoyuna sunulan bilgi akışının tarafsızlığı konusunda endişeler artmaktadır. 
Medya kuruluşları, haberlerini sunarken objektif olmak zorundadır."""
GOLDEN_INPUT_LONG = """Son yıllarda kamuoyuna sunulan bilgi akışının tarafsızlığı konusunda endişeler artmaktadır. 
Medya kuruluşları, haberlerini sunarken objektif olmak zorundadır. Manipülasyon ve yanlış bilgi yayma ciddi sorunlara yol açabilir.

Finansal piyasalarda yatırım tavsiyesi vermek yasal olarak yasaktır."""


async def test_golden_inputs():
    """Test golden inputs - verify structure unchanged"""
    print("\n=== TEST 1: Golden Input Regression ===")
    
    try:
        # Test short input
        result = await analyze_content_deep(
            content=GOLDEN_INPUT_SHORT,
            domain="media",
            policies=["TRT"],
            provider="openai",
            role="proxy",
            org_id="test-org-golden"
        )
        
        if "overall_scores" not in result:
            test_fail("golden_input_short", "Missing overall_scores")
            return
        
        scores = result["overall_scores"]
        required_fields = ["ethical_index", "compliance_score", "manipulation_score", "bias_score", "legal_risk_score"]
        for field in required_fields:
            if field not in scores:
                test_fail("golden_input_short", f"Missing {field} in overall_scores")
                return
            if not (0 <= scores[field] <= 100):
                test_fail("golden_input_short", f"Invalid {field} value: {scores[field]}")
                return
        
        # Verify new fields are optional and valid if present
        if "_partial" in result and not isinstance(result["_partial"], bool):
            test_fail("golden_input_short", "_partial must be bool")
            return
        
        if "_score_kind" in result and result["_score_kind"] not in ["preliminary", "final"]:
            test_fail("golden_input_short", f"Invalid _score_kind: {result['_score_kind']}")
            return
        
        test_pass("golden_input_short")
        
        # Test medium input
        result = await analyze_content_deep(
            content=GOLDEN_INPUT_MEDIUM,
            domain="media",
            policies=["TRT"],
            provider="openai",
            role="proxy",
            org_id="test-org-golden"
        )
        
        if "_stage0_result" not in result:
            test_fail("golden_input_medium", "Missing _stage0_result")
            return
        
        stage0 = result["_stage0_result"]
        if "risk_band" in stage0 and stage0["risk_band"] not in ["low", "medium", "high"]:
            test_fail("golden_input_medium", f"Invalid risk_band: {stage0['risk_band']}")
            return
        
        test_pass("golden_input_medium")
        
        # Test long input
        result = await analyze_content_deep(
            content=GOLDEN_INPUT_LONG,
            domain="media",
            policies=["TRT"],
            provider="openai",
            role="proxy",
            org_id="test-org-golden"
        )
        
        if "flags" not in result or not isinstance(result["flags"], list):
            test_fail("golden_input_long", "flags must be a list")
            return
        
        if "risk_locations" not in result or not isinstance(result["risk_locations"], list):
            test_fail("golden_input_long", "risk_locations must be a list")
            return
        
        test_pass("golden_input_long")
        
    except Exception as e:
        test_fail("golden_inputs", f"Exception: {str(e)}")


# ========== TEST 2: GUARD BEHAVIOR (RATE LIMITING) ==========

async def test_rate_limiter():
    """Test rate limiter returns Stage-0 only when limit exceeded"""
    print("\n=== TEST 2: Guard Behavior (Rate Limiting) ===")
    
    try:
        settings = get_settings()
        org_id = "test-org-rate-limit"
        
        reset_rate_limit_metrics()
        
        # Exhaust rate limit
        allowed_count = 0
        for i in range(settings.ORG_RPM_LIMIT + 5):
            allowed, reason = check_rate_limit(org_id, settings=settings)
            if allowed:
                allowed_count += 1
            else:
                # Rate limit exceeded - verify Stage-0 still works
                stage0_result = await stage0_fast_risk_scan(
                    content=GOLDEN_INPUT_SHORT,
                    domain="media",
                    provider="openai",
                    org_id=org_id
                )
                
                if "risk_band" not in stage0_result:
                    test_fail("rate_limiter_stage0", "Stage-0 missing risk_band")
                    return
                
                if stage0_result["risk_band"] not in ["low", "medium", "high"]:
                    test_fail("rate_limiter_stage0", f"Invalid risk_band: {stage0_result['risk_band']}")
                    return
                
                test_pass("rate_limiter_stage0_fallback")
                break
        
        if allowed_count > 0:
            test_pass("rate_limiter_allows_requests")
        
    except Exception as e:
        test_fail("rate_limiter", f"Exception: {str(e)}")


# ========== TEST 3: CIRCUIT BREAKER ==========

async def test_circuit_breaker():
    """Test circuit breaker opens and blocks correctly"""
    print("\n=== TEST 3: Circuit Breaker ===")
    
    try:
        cb = CircuitBreaker("test-cb", failure_threshold=3, recovery_timeout=1)
        
        def fail_func():
            raise Exception("Simulated failure")
        
        # Trigger failures
        for i in range(3):
            try:
                cb.call(fail_func)
            except Exception:
                pass
        
        # Circuit should be open
        if cb.state != CircuitState.OPEN:
            test_fail("circuit_breaker_opens", f"Expected OPEN, got {cb.state}")
            return
        
        test_pass("circuit_breaker_opens")
        
        # Should block requests
        try:
            cb.call(fail_func)
            test_fail("circuit_breaker_blocks", "Should raise CircuitBreakerOpenError")
            return
        except CircuitBreakerOpenError:
            test_pass("circuit_breaker_blocks")
        
        # Stage-0 should still work
        stage0_result = await stage0_fast_risk_scan(
            content=GOLDEN_INPUT_SHORT,
            domain="media",
            provider="openai",
            org_id="test-org-cb"
        )
        
        if "risk_band" not in stage0_result:
            test_fail("circuit_breaker_stage0", "Stage-0 missing risk_band")
            return
        
        test_pass("circuit_breaker_stage0_fallback")
        
    except Exception as e:
        test_fail("circuit_breaker", f"Exception: {str(e)}")


# ========== TEST 4: STAGE-2 PATCH SAFETY ==========

def test_stage2_patching():
    """Test Stage-2 patch safety"""
    print("\n=== TEST 4: Stage-2 Patch Safety ===")
    
    try:
        # Test merging overlapping spans
        spans = [
            {"start_offset": 10, "end_offset": 50, "risk_type": "manipulation"},
            {"start_offset": 40, "end_offset": 80, "risk_type": "bias"},
            {"start_offset": 100, "end_offset": 150, "risk_type": "legal"},
        ]
        
        merged = merge_overlapping_spans(spans)
        
        if len(merged) != 2:
            test_fail("stage2_merge_spans", f"Expected 2 merged spans, got {len(merged)}")
            return
        
        if merged[0]["end_offset"] != 80:
            test_fail("stage2_merge_spans", f"Expected end_offset=80, got {merged[0]['end_offset']}")
            return
        
        test_pass("stage2_merge_overlapping_spans")
        
        # Test patching preserves offsets
        original = "This is a test sentence with some content."
        span = {"start_offset": 10, "end_offset": 18}
        rewritten = "was an example"
        
        patched = patch_span_into_content(original, span, rewritten)
        
        if patched[:10] != original[:10]:
            test_fail("stage2_patch_offsets", "Unaffected prefix changed")
            return
        
        if "was an example" not in patched:
            test_fail("stage2_patch_offsets", "Rewritten span not found")
            return
        
        test_pass("stage2_patch_preserves_offsets")
        
        # Test multiple spans end → start
        original = "First sentence. Second sentence. Third sentence."
        spans = [
            {"start_offset": 0, "end_offset": 16, "rewritten_span": "First paragraph"},
            {"start_offset": 17, "end_offset": 33, "rewritten_span": "Second paragraph"},
        ]
        
        spans_sorted = sorted(spans, key=lambda s: s["start_offset"], reverse=True)
        result = original
        for span in spans_sorted:
            result = patch_span_into_content(result, span, span["rewritten_span"])
        
        if "First paragraph" not in result or "Second paragraph" not in result:
            test_fail("stage2_multiple_spans", "Spans not patched correctly")
            return
        
        test_pass("stage2_multiple_spans_end_to_start")
        
    except Exception as e:
        test_fail("stage2_patching", f"Exception: {str(e)}")


# ========== TEST 5: METRICS EXPOSURE ==========

def test_metrics_exposure():
    """Test metrics endpoint exposes required metrics"""
    print("\n=== TEST 5: Metrics Exposure ===")
    
    try:
        metrics_text = get_prometheus_metrics()
        
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
            if metric not in metrics_text:
                test_fail("metrics_exposure", f"Metric {metric} not found")
                return
        
        test_pass("metrics_exposure_all_required")
        
        # Verify cache metrics have type labels
        if 'type="semantic"' not in metrics_text and 'type= semantic' not in metrics_text:
            test_fail("metrics_exposure", "Cache metrics missing type labels")
            return
        
        test_pass("metrics_exposure_cache_labels")
        
    except Exception as e:
        test_fail("metrics_exposure", f"Exception: {str(e)}")


# ========== MAIN ==========

async def main():
    """Run all regression tests"""
    print("=" * 60)
    print("EZA PROXY - PRODUCTION HARDENING REGRESSION TESTS")
    print("=" * 60)
    
    # Run tests
    await test_golden_inputs()
    await test_rate_limiter()
    await test_circuit_breaker()
    test_stage2_patching()
    test_metrics_exposure()
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"✅ PASSED: {len(results['passed'])}")
    print(f"❌ FAILED: {len(results['failed'])}")
    
    if results["passed"]:
        print("\nPassed tests:")
        for test in results["passed"]:
            print(f"  ✅ {test}")
    
    if results["failed"]:
        print("\nFailed tests:")
        for failure in results["failed"]:
            print(f"  ❌ {failure['test']}: {failure['reason']}")
        print("\n❌ REGRESSION TESTS FAILED")
        sys.exit(1)
    else:
        print("\n✅ ALL REGRESSION TESTS PASSED")
        sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())

