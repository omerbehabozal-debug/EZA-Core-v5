# -*- coding: utf-8 -*-
"""Faz 2/3 advanced behavioral analytics stubs (not implemented)."""

from typing import Any, Dict, List, Optional


def _stub(phase: int) -> Dict[str, Any]:
    return {
        "status": "not_implemented",
        "phase": phase,
        "can_interpret": False,
    }


def mahalanobis_anomaly(
    current: List[float],
    baseline: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Mahalanobis distance anomaly detection (Faz 2)."""
    return _stub(2)


def isolation_forest(
    samples: List[List[float]],
) -> Dict[str, Any]:
    """Isolation forest anomaly detection (Faz 2)."""
    return _stub(2)


def detect_seasonality(values: List[float]) -> Dict[str, Any]:
    """Seasonality detection (Faz 3)."""
    return _stub(3)


def adaptive_learning(
    feedback_batch: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Adaptive calibration from feedback (Faz 3)."""
    return _stub(3)
