# -*- coding: utf-8 -*-
"""
Metrics Collection - Simple in-memory/Redis-based counters
"""

from typing import Dict, Any, Optional
from datetime import datetime
from collections import defaultdict
import asyncio
from backend.core.utils.dependencies import get_redis


class MetricsCollector:
    """Simple metrics collector"""
    
    def __init__(self):
        self._counters: Dict[str, int] = defaultdict(int)
        self._latencies: Dict[str, list[float]] = defaultdict(list)
        self._use_redis = False
    
    async def increment(self, metric_name: str, value: int = 1):
        """Increment counter"""
        self._counters[metric_name] += value
        
        # Optionally store in Redis
        if self._use_redis:
            try:
                redis = await get_redis()
                await redis.incr(f"metrics:{metric_name}", value)
            except:
                pass
    
    async def record_latency(self, metric_name: str, latency_ms: float):
        """Record latency"""
        self._latencies[metric_name].append(latency_ms)
        
        # Keep only last 1000 measurements
        if len(self._latencies[metric_name]) > 1000:
            self._latencies[metric_name] = self._latencies[metric_name][-1000:]
    
    def get_counter(self, metric_name: str) -> int:
        """Get counter value"""
        return self._counters.get(metric_name, 0)
    
    def get_avg_latency(self, metric_name: str) -> Optional[float]:
        """Get average latency"""
        latencies = self._latencies.get(metric_name, [])
        if not latencies:
            return None
        return sum(latencies) / len(latencies)
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get all metrics"""
        return {
            "counters": dict(self._counters),
            "latencies": {
                name: {
                    "avg": self.get_avg_latency(name),
                    "count": len(latencies)
                }
                for name, latencies in self._latencies.items()
            }
        }


# Global metrics instance
_metrics_collector = MetricsCollector()


async def increment_metric(metric_name: str, value: int = 1):
    """Increment metric counter"""
    await _metrics_collector.increment(metric_name, value)


async def record_latency(metric_name: str, latency_ms: float):
    """Record latency metric"""
    await _metrics_collector.record_latency(metric_name, latency_ms)


def get_metrics() -> Dict[str, Any]:
    """Get all metrics"""
    return _metrics_collector.get_metrics()

