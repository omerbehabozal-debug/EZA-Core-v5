# -*- coding: utf-8 -*-
"""Lightweight time-series helpers for behavioral metrics (no I/O)."""

from typing import List, Optional


def exponential_moving_average(values: List[float], alpha: float = 0.3) -> List[float]:
    """
    Standard EMA over values (oldest first).
    alpha in (0, 1]: higher = more weight on recent points.
    """
    if not values:
        return []
    a = max(0.0, min(1.0, float(alpha)))
    out: List[float] = []
    ema: Optional[float] = None
    for v in values:
        x = float(v)
        if ema is None:
            ema = x
        else:
            ema = a * x + (1.0 - a) * ema
        out.append(ema)
    return out


def last_ema(values: List[float], alpha: float = 0.3) -> Optional[float]:
    """Last EMA value, or None if empty."""
    series = exponential_moving_average(values, alpha=alpha)
    return series[-1] if series else None


def simple_slope(values: List[float]) -> float:
    """
    Average change per step: (last - first) / (n - 1) for n >= 2, else 0.0.
    """
    if len(values) < 2:
        return 0.0
    first, last = float(values[0]), float(values[-1])
    return (last - first) / float(len(values) - 1)
