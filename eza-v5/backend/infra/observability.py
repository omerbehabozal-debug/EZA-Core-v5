# -*- coding: utf-8 -*-
"""
EZA Proxy - Observability (Prometheus Metrics)
Expose metrics exactly with specified names
"""

import logging
from typing import Dict, Any
from backend.config import get_settings
from backend.services.proxy_rate_limiter import get_rate_limit_metrics
from backend.infra.circuit_breaker import get_all_circuit_breaker_metrics
from backend.infra.cache_registry import get_cache_metrics
from backend.services.proxy_performance_metrics import get_all_metrics_summary

logger = logging.getLogger(__name__)

# Prometheus metrics storage (in-memory, can be replaced with prometheus_client)
_metrics: Dict[str, Any] = {
    # Latency metrics (histograms)
    "eza_proxy_stage0_latency_ms": [],
    "eza_proxy_stage1_latency_ms": [],
    "eza_proxy_stage2_latency_ms": [],
    "eza_proxy_total_latency_ms": [],
    
    # Cache metrics (counters)
    "eza_proxy_cache_hit_total": {"semantic": 0, "policy": 0, "prompt": 0},
    "eza_proxy_cache_miss_total": {"semantic": 0, "policy": 0, "prompt": 0},
    
    # Rate limit / Circuit breaker (counters)
    "eza_proxy_rate_limit_dropped_total": 0,
    "eza_proxy_circuit_breaker_open_total": 0,
    "eza_proxy_circuit_breaker_half_open_total": 0,
    
    # Rewrite metrics (counters)
    "eza_proxy_rewrite_success_total": 0,
    "eza_proxy_rewrite_failure_total": 0,
}


def record_latency(metric_name: str, latency_ms: float):
    """Record latency metric"""
    if metric_name.startswith("eza_proxy_") and metric_name.endswith("_latency_ms"):
        if metric_name not in _metrics:
            _metrics[metric_name] = []
        _metrics[metric_name].append(latency_ms)
        # Keep last 1000 values
        if len(_metrics[metric_name]) > 1000:
            _metrics[metric_name] = _metrics[metric_name][-1000:]


def increment_counter(metric_name: str, labels: Dict[str, str] = None):
    """Increment counter metric"""
    if metric_name not in _metrics:
        _metrics[metric_name] = {}
    
    if labels:
        # Labeled counter
        label_key = ",".join(f"{k}={v}" for k, v in sorted(labels.items()))
        if label_key not in _metrics[metric_name]:
            _metrics[metric_name][label_key] = 0
        _metrics[metric_name][label_key] += 1
    else:
        # Simple counter
        if isinstance(_metrics[metric_name], dict):
            _metrics[metric_name] = 0
        _metrics[metric_name] += 1


def get_prometheus_metrics() -> str:
    """
    Generate Prometheus metrics format
    
    Returns:
        Prometheus exposition format string
    """
    lines = []
    
    # Update metrics from other modules
    cache_metrics = get_cache_metrics()
    rate_limit_metrics = get_rate_limit_metrics()
    cb_metrics = get_all_circuit_breaker_metrics()
    perf_metrics = get_all_metrics_summary()
    
    # Latency metrics (histograms as summaries)
    for metric_name in [
        "eza_proxy_stage0_latency_ms",
        "eza_proxy_stage1_latency_ms",
        "eza_proxy_stage2_latency_ms",
        "eza_proxy_total_latency_ms"
    ]:
        values = _metrics.get(metric_name, [])
        if values:
            # Calculate percentiles
            sorted_values = sorted(values)
            count = len(sorted_values)
            p50_idx = int(count * 0.5)
            p90_idx = int(count * 0.9)
            p99_idx = int(count * 0.99)
            
            p50 = sorted_values[p50_idx] if p50_idx < count else 0
            p90 = sorted_values[p90_idx] if p90_idx < count else 0
            p99 = sorted_values[p99_idx] if p99_idx < count else 0
            
            lines.append(f"# TYPE {metric_name} summary")
            lines.append(f"{metric_name}{{quantile=\"0.5\"}} {p50}")
            lines.append(f"{metric_name}{{quantile=\"0.9\"}} {p90}")
            lines.append(f"{metric_name}{{quantile=\"0.99\"}} {p99}")
            lines.append(f"{metric_name}_count {count}")
            lines.append("")
    
    # Cache metrics
    cache_hits = cache_metrics.get("cache_hit_total", {})
    cache_misses = cache_metrics.get("cache_miss_total", {})
    
    lines.append("# TYPE eza_proxy_cache_hit_total counter")
    for cache_type in ["semantic", "policy", "prompt"]:
        count = cache_hits.get(cache_type, 0)
        lines.append(f'eza_proxy_cache_hit_total{{type="{cache_type}"}} {count}')
    lines.append("")
    
    lines.append("# TYPE eza_proxy_cache_miss_total counter")
    for cache_type in ["semantic", "policy", "prompt"]:
        count = cache_misses.get(cache_type, 0)
        lines.append(f'eza_proxy_cache_miss_total{{type="{cache_type}"}} {count}')
    lines.append("")
    
    # Rate limit metrics
    lines.append("# TYPE eza_proxy_rate_limit_dropped_total counter")
    lines.append(f"eza_proxy_rate_limit_dropped_total {rate_limit_metrics.get('rate_limit_dropped_total', 0)}")
    lines.append("")
    
    # Circuit breaker metrics
    lines.append("# TYPE eza_proxy_circuit_breaker_open_total counter")
    total_open = sum(cb.get("open_count", 0) for cb in cb_metrics.values())
    lines.append(f"eza_proxy_circuit_breaker_open_total {total_open}")
    lines.append("")
    
    lines.append("# TYPE eza_proxy_circuit_breaker_half_open_total counter")
    total_half_open = sum(cb.get("half_open_count", 0) for cb in cb_metrics.values())
    lines.append(f"eza_proxy_circuit_breaker_half_open_total {total_half_open}")
    lines.append("")
    
    # Rewrite metrics
    lines.append("# TYPE eza_proxy_rewrite_success_total counter")
    lines.append(f"eza_proxy_rewrite_success_total {_metrics.get('eza_proxy_rewrite_success_total', 0)}")
    lines.append("")
    
    lines.append("# TYPE eza_proxy_rewrite_failure_total counter")
    lines.append(f"eza_proxy_rewrite_failure_total {_metrics.get('eza_proxy_rewrite_failure_total', 0)}")
    lines.append("")
    
    return "\n".join(lines)


def record_rewrite_success():
    """Record successful rewrite"""
    increment_counter("eza_proxy_rewrite_success_total")


def record_rewrite_failure():
    """Record failed rewrite"""
    increment_counter("eza_proxy_rewrite_failure_total")

