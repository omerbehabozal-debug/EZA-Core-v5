# -*- coding: utf-8 -*-
"""
Behavioral intelligence layer — score vectors and interaction asymmetry.

Adds time-ready signals on top of the existing pipeline without changing
core scoring or policy logic.
"""

from backend.behavioral.interaction import analyze_interaction_turn, VECTOR_SCHEMA_VERSION
from backend.behavioral.trend import exponential_moving_average, last_ema, simple_slope

__all__ = [
    "analyze_interaction_turn",
    "VECTOR_SCHEMA_VERSION",
    "exponential_moving_average",
    "last_ema",
    "simple_slope",
]
