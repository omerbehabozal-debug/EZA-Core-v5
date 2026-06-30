# -*- coding: utf-8 -*-
"""
EZA Observation Architecture — layer type skeletons.

EZA observes. Products decide UX.
No algorithms, scoring, or recommendations in this module — structure only.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Optional


@dataclass
class ObservationRecord:
    """Cleaned observation derived from experience events (future aggregation)."""

    id: str
    product_id: str
    observation_type: str
    user_id: Optional[str] = None
    guest_token_hash: Optional[str] = None
    conversation_id: Optional[str] = None
    mirror_id: Optional[str] = None
    value_json: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


@dataclass
class SignalRecord:
    """Numeric derivation from observations (future aggregation).

    EZA never returns actions — only signals for product insight layers.
    Example response shape: {"signals": {}} — never {"action": "..."}.
    """

    id: str
    product_id: str
    signal_type: str
    signal_value_json: Dict[str, Any] = field(default_factory=dict)
    user_id: Optional[str] = None
    conversation_id: Optional[str] = None
    mirror_id: Optional[str] = None
    created_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


@dataclass
class PatternRecord:
    """Long-horizon user/product tendency summary (future aggregation)."""

    id: str
    product_id: str
    user_id: str
    period_start: datetime
    period_end: datetime
    pattern_json: Dict[str, Any] = field(default_factory=dict)
    updated_at: Optional[datetime] = None


@dataclass
class InsightRecord:
    """Meaning layer products may display — EZA does not render UX."""

    id: str
    product_id: str
    user_id: str
    insight_type: str
    insight_json: Dict[str, Any] = field(default_factory=dict)
    updated_at: Optional[datetime] = None
