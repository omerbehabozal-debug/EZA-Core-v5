# -*- coding: utf-8 -*-
"""
EZA Proxy - Performance Metrics Collection & Analysis
P50/P90/P99 latency tracking for Stage-0, Stage-1, Stage-2, and total

Data-driven optimization decisions, not intuition-driven.
"""

import logging
import time
import statistics
from typing import Dict, Any, List, Optional
from collections import deque
from datetime import datetime, timedelta
from threading import Lock

logger = logging.getLogger(__name__)

# In-memory metrics storage (can be replaced with Redis/DB in production)
_metrics_store: Dict[str, deque] = {
    "stage0_latency": deque(maxlen=1000),  # Last 1000 measurements
    "stage1_latency": deque(maxlen=1000),
    "stage2_latency": deque(maxlen=1000),
    "total_latency": deque(maxlen=1000),
    "rewrite_latency": deque(maxlen=1000),
}

# Thread-safe lock for metrics updates
_metrics_lock = Lock()


def record_latency(
    metric_name: str,
    latency_ms: float,
    metadata: Optional[Dict[str, Any]] = None
):
    """
    Record latency metric
    
    Args:
        metric_name: "stage0_latency", "stage1_latency", "stage2_latency", "total_latency", "rewrite_latency"
        latency_ms: Latency in milliseconds
        metadata: Optional metadata (role, domain, content_length, etc.)
    """
    if metric_name not in _metrics_store:
        logger.warning(f"[Metrics] Unknown metric name: {metric_name}")
        return
    
    with _metrics_lock:
        _metrics_store[metric_name].append({
            "latency_ms": latency_ms,
            "timestamp": time.time(),
            "metadata": metadata or {}
        })
    
    logger.debug(f"[Metrics] Recorded {metric_name}: {latency_ms:.2f}ms")


def calculate_percentiles(values: List[float], percentiles: List[float] = [50, 90, 99]) -> Dict[str, float]:
    """
    Calculate percentiles (P50, P90, P99) from a list of values
    
    Args:
        values: List of numeric values
        percentiles: List of percentile values to calculate
    
    Returns:
        Dict with percentile values: {"p50": float, "p90": float, "p99": float}
    """
    if not values:
        return {f"p{p}": 0.0 for p in percentiles}
    
    sorted_values = sorted(values)
    result = {}
    
    for p in percentiles:
        index = (p / 100.0) * (len(sorted_values) - 1)
        if index.is_integer():
            result[f"p{p}"] = sorted_values[int(index)]
        else:
            # Interpolate between two values
            lower = sorted_values[int(index)]
            upper = sorted_values[min(int(index) + 1, len(sorted_values) - 1)]
            result[f"p{p}"] = lower + (upper - lower) * (index - int(index))
    
    return result


def get_metrics_summary(
    metric_name: str,
    time_window_minutes: Optional[int] = None
) -> Dict[str, Any]:
    """
    Get metrics summary for a specific metric
    
    Args:
        metric_name: "stage0_latency", "stage1_latency", etc.
        time_window_minutes: Optional time window filter (last N minutes)
    
    Returns:
        {
            "count": int,
            "mean": float,
            "min": float,
            "max": float,
            "p50": float,
            "p90": float,
            "p99": float,
            "recent_values": List[float]  # Last 10 values
        }
    """
    if metric_name not in _metrics_store:
        return {
            "count": 0,
            "mean": 0.0,
            "min": 0.0,
            "max": 0.0,
            "p50": 0.0,
            "p90": 0.0,
            "p99": 0.0,
            "recent_values": []
        }
    
    with _metrics_lock:
        metrics = list(_metrics_store[metric_name])
    
    # Filter by time window if specified
    if time_window_minutes:
        cutoff_time = time.time() - (time_window_minutes * 60)
        metrics = [m for m in metrics if m["timestamp"] >= cutoff_time]
    
    if not metrics:
        return {
            "count": 0,
            "mean": 0.0,
            "min": 0.0,
            "max": 0.0,
            "p50": 0.0,
            "p90": 0.0,
            "p99": 0.0,
            "recent_values": []
        }
    
    # Extract latency values
    latencies = [m["latency_ms"] for m in metrics]
    
    # Calculate statistics
    percentiles = calculate_percentiles(latencies, [50, 90, 99])
    
    return {
        "count": len(latencies),
        "mean": statistics.mean(latencies) if latencies else 0.0,
        "min": min(latencies) if latencies else 0.0,
        "max": max(latencies) if latencies else 0.0,
        "p50": percentiles.get("p50", 0.0),
        "p90": percentiles.get("p90", 0.0),
        "p99": percentiles.get("p99", 0.0),
        "recent_values": latencies[-10:]  # Last 10 values
    }


def get_all_metrics_summary(
    time_window_minutes: Optional[int] = None
) -> Dict[str, Dict[str, Any]]:
    """
    Get summary for all metrics
    
    Returns:
        {
            "stage0_latency": {...},
            "stage1_latency": {...},
            "stage2_latency": {...},
            "total_latency": {...},
            "rewrite_latency": {...}
        }
    """
    return {
        "stage0_latency": get_metrics_summary("stage0_latency", time_window_minutes),
        "stage1_latency": get_metrics_summary("stage1_latency", time_window_minutes),
        "stage2_latency": get_metrics_summary("stage2_latency", time_window_minutes),
        "total_latency": get_metrics_summary("total_latency", time_window_minutes),
        "rewrite_latency": get_metrics_summary("rewrite_latency", time_window_minutes),
    }


def log_performance_metrics(
    stage0_latency_ms: float,
    stage1_latency_ms: float,
    total_latency_ms: float,
    role: str = "proxy",
    domain: Optional[str] = None,
    content_length: Optional[int] = None
):
    """
    Log performance metrics for analysis pipeline
    
    This function should be called after each analysis completes.
    """
    metadata = {
        "role": role,
        "domain": domain,
        "content_length": content_length
    }
    
    # Record metrics
    record_latency("stage0_latency", stage0_latency_ms, metadata)
    record_latency("stage1_latency", stage1_latency_ms, metadata)
    record_latency("total_latency", total_latency_ms, metadata)
    
    # Log summary periodically (every 10th request)
    if len(_metrics_store["total_latency"]) % 10 == 0:
        summary = get_all_metrics_summary()
        logger.info(
            f"[Performance] Metrics summary (last {len(_metrics_store['total_latency'])} requests): "
            f"Stage-0 P50={summary['stage0_latency']['p50']:.0f}ms, "
            f"Stage-1 P50={summary['stage1_latency']['p50']:.0f}ms, "
            f"Total P50={summary['total_latency']['p50']:.0f}ms, "
            f"P90={summary['total_latency']['p90']:.0f}ms, "
            f"P99={summary['total_latency']['p99']:.0f}ms"
        )


def log_rewrite_metrics(
    rewrite_latency_ms: float,
    spans_rewritten: int,
    spans_failed: int,
    role: str = "proxy"
):
    """
    Log performance metrics for rewrite operation
    """
    metadata = {
        "role": role,
        "spans_rewritten": spans_rewritten,
        "spans_failed": spans_failed
    }
    
    record_latency("rewrite_latency", rewrite_latency_ms, metadata)


def check_sla_compliance(
    role: str = "proxy"
) -> Dict[str, Any]:
    """
    Check if current metrics meet SLA targets
    
    Targets:
    - Proxy Lite: P50 < 800ms, P90 < 1.5s
    - Proxy: P50 < 1.5s, P90 < 3s
    - Rewrite: < 1.2s for typical content
    
    Returns:
        {
            "stage0_compliant": bool,
            "stage1_compliant": bool,
            "total_compliant": bool,
            "rewrite_compliant": bool,
            "violations": List[str]
        }
    """
    summary = get_all_metrics_summary(time_window_minutes=60)  # Last hour
    
    # Define SLA targets based on role
    if role == "proxy_lite":
        total_p50_target = 800
        total_p90_target = 1500
    else:  # proxy
        total_p50_target = 1500
        total_p90_target = 3000
    
    stage0_p50_target = 500
    rewrite_p50_target = 1200
    
    violations = []
    
    # Check Stage-0
    stage0_compliant = summary["stage0_latency"]["p50"] <= stage0_p50_target
    if not stage0_compliant:
        violations.append(f"Stage-0 P50 ({summary['stage0_latency']['p50']:.0f}ms) exceeds target ({stage0_p50_target}ms)")
    
    # Check Total (Stage-0 + Stage-1)
    total_compliant = (
        summary["total_latency"]["p50"] <= total_p50_target and
        summary["total_latency"]["p90"] <= total_p90_target
    )
    if not total_compliant:
        if summary["total_latency"]["p50"] > total_p50_target:
            violations.append(f"Total P50 ({summary['total_latency']['p50']:.0f}ms) exceeds target ({total_p50_target}ms)")
        if summary["total_latency"]["p90"] > total_p90_target:
            violations.append(f"Total P90 ({summary['total_latency']['p90']:.0f}ms) exceeds target ({total_p90_target}ms)")
    
    # Check Rewrite
    rewrite_compliant = summary["rewrite_latency"]["p50"] <= rewrite_p50_target
    if not rewrite_compliant and summary["rewrite_latency"]["count"] > 0:
        violations.append(f"Rewrite P50 ({summary['rewrite_latency']['p50']:.0f}ms) exceeds target ({rewrite_p50_target}ms)")
    
    return {
        "stage0_compliant": stage0_compliant,
        "total_compliant": total_compliant,
        "rewrite_compliant": rewrite_compliant,
        "violations": violations,
        "summary": summary
    }


def clear_metrics(metric_name: Optional[str] = None):
    """
    Clear metrics (for testing or reset)
    
    Args:
        metric_name: Specific metric to clear, or None to clear all
    """
    with _metrics_lock:
        if metric_name:
            if metric_name in _metrics_store:
                _metrics_store[metric_name].clear()
                logger.info(f"[Metrics] Cleared {metric_name}")
        else:
            for name in _metrics_store:
                _metrics_store[name].clear()
            logger.info("[Metrics] Cleared all metrics")

