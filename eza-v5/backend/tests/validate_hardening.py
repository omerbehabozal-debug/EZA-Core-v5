#!/usr/bin/env python3
"""
EZA Proxy - Production Hardening Validation
Quick validation script to check that hardening changes didn't break existing behavior
"""

import sys
import os
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir.parent))

print("=" * 60)
print("EZA PROXY - PRODUCTION HARDENING VALIDATION")
print("=" * 60)

# Test results
passed = []
failed = []


def check_pass(name: str):
    passed.append(name)
    print(f"✅ {name}")


def check_fail(name: str, reason: str):
    failed.append({"test": name, "reason": reason})
    print(f"❌ {name}: {reason}")


# ========== TEST 1: Import Checks ==========
print("\n[TEST 1] Import Checks...")

try:
    from backend.services.proxy_analyzer import analyze_content_deep
    check_pass("import proxy_analyzer")
except Exception as e:
    check_fail("import proxy_analyzer", str(e))

try:
    from backend.services.proxy_analyzer_stage0 import stage0_fast_risk_scan
    check_pass("import proxy_analyzer_stage0")
except Exception as e:
    check_fail("import proxy_analyzer_stage0", str(e))

try:
    from backend.services.proxy_analyzer_stage1 import stage1_targeted_deep_analysis
    check_pass("import proxy_analyzer_stage1")
except Exception as e:
    check_fail("import proxy_analyzer_stage1", str(e))

try:
    from backend.services.proxy_analyzer_stage2 import (
        merge_overlapping_spans,
        patch_span_into_content
    )
    check_pass("import proxy_analyzer_stage2")
except Exception as e:
    check_fail("import proxy_analyzer_stage2", str(e))

try:
    from backend.services.proxy_rate_limiter import check_rate_limit, reset_rate_limit_metrics
    check_pass("import proxy_rate_limiter")
except Exception as e:
    check_fail("import proxy_rate_limiter", str(e))

try:
    from backend.infra.circuit_breaker import CircuitBreaker, CircuitBreakerOpenError, CircuitState
    check_pass("import circuit_breaker")
except Exception as e:
    check_fail("import circuit_breaker", str(e))

try:
    from backend.infra.observability import get_prometheus_metrics
    check_pass("import observability")
except Exception as e:
    check_fail("import observability", str(e))

try:
    from backend.infra.cache_registry import get_cache_metrics
    check_pass("import cache_registry")
except Exception as e:
    check_fail("import cache_registry", str(e))


# ========== TEST 2: Metrics Exposure ==========
print("\n[TEST 2] Metrics Exposure...")

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
    
    missing = []
    for metric in required_metrics:
        if metric not in metrics_text:
            missing.append(metric)
    
    if missing:
        check_fail("metrics_exposure", f"Missing metrics: {', '.join(missing)}")
    else:
        check_pass("metrics_exposure_all_required")
        
except Exception as e:
    check_fail("metrics_exposure", f"Exception: {str(e)}")


# ========== TEST 3: Stage-2 Patch Safety ==========
print("\n[TEST 3] Stage-2 Patch Safety...")

try:
    # Test merging overlapping spans
    spans = [
        {"start_offset": 10, "end_offset": 50, "risk_type": "manipulation"},
        {"start_offset": 40, "end_offset": 80, "risk_type": "bias"},
        {"start_offset": 100, "end_offset": 150, "risk_type": "legal"},
    ]
    
    merged = merge_overlapping_spans(spans)
    
    if len(merged) != 2:
        check_fail("stage2_merge_spans", f"Expected 2 merged spans, got {len(merged)}")
    elif merged[0]["end_offset"] != 80:
        check_fail("stage2_merge_spans", f"Expected end_offset=80, got {merged[0]['end_offset']}")
    else:
        check_pass("stage2_merge_overlapping_spans")
        
except Exception as e:
    check_fail("stage2_merge_spans", f"Exception: {str(e)}")

try:
    # Test patching preserves offsets
    original = "This is a test sentence with some content."
    span = {"start_offset": 10, "end_offset": 18}
    rewritten = "was an example"
    
    patched = patch_span_into_content(original, span, rewritten)
    
    if patched[:10] != original[:10]:
        check_fail("stage2_patch_offsets", "Unaffected prefix changed")
    elif "was an example" not in patched:
        check_fail("stage2_patch_offsets", "Rewritten span not found")
    else:
        check_pass("stage2_patch_preserves_offsets")
        
except Exception as e:
    check_fail("stage2_patch_offsets", f"Exception: {str(e)}")


# ========== TEST 4: Circuit Breaker ==========
print("\n[TEST 4] Circuit Breaker...")

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
    
    if cb.state != CircuitState.OPEN:
        check_fail("circuit_breaker_opens", f"Expected OPEN, got {cb.state}")
    else:
        check_pass("circuit_breaker_opens")
        
    # Should block requests
    try:
        cb.call(fail_func)
        check_fail("circuit_breaker_blocks", "Should raise CircuitBreakerOpenError")
    except CircuitBreakerOpenError:
        check_pass("circuit_breaker_blocks")
        
except Exception as e:
    check_fail("circuit_breaker", f"Exception: {str(e)}")


# ========== TEST 5: Rate Limiter ==========
print("\n[TEST 5] Rate Limiter...")

try:
    from backend.config import get_settings
    settings = get_settings()
    org_id = "test-org-rate-limit"
    
    reset_rate_limit_metrics()
    
    # Should allow some requests
    allowed_count = 0
    for i in range(min(5, settings.ORG_RPM_LIMIT)):
        allowed, reason = check_rate_limit(org_id, settings=settings)
        if allowed:
            allowed_count += 1
    
    if allowed_count > 0:
        check_pass("rate_limiter_allows_requests")
    else:
        check_fail("rate_limiter_allows_requests", "No requests allowed")
        
except Exception as e:
    check_fail("rate_limiter", f"Exception: {str(e)}")


# ========== SUMMARY ==========
print("\n" + "=" * 60)
print("VALIDATION SUMMARY")
print("=" * 60)
print(f"✅ PASSED: {len(passed)}")
print(f"❌ FAILED: {len(failed)}")

if passed:
    print("\nPassed checks:")
    for test in passed:
        print(f"  ✅ {test}")

if failed:
    print("\nFailed checks:")
    for failure in failed:
        print(f"  ❌ {failure['test']}: {failure['reason']}")
    print("\n❌ VALIDATION FAILED")
    sys.exit(1)
else:
    print("\n✅ ALL VALIDATION CHECKS PASSED")
    print("\nNote: This is a quick validation. Run full pytest suite for comprehensive testing.")
    sys.exit(0)

