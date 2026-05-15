# -*- coding: utf-8 -*-
"""Unit tests for behavioral interaction snapshot and trend helpers."""

import pytest

from backend.behavioral.interaction import analyze_interaction_turn, VECTOR_SCHEMA_VERSION
from backend.behavioral.trend import exponential_moving_average, last_ema, simple_slope


def test_analyze_interaction_turn_shape():
    inp = {"risk_score": 0.2, "intent": "question", "risk_level": "low"}
    out = {"risk_score": 0.1, "risk_level": "low"}
    align = {
        "alignment_score": 90.0,
        "verdict": "aligned",
        "label": "Safe",
    }
    redir = {"redirect": False, "reason": None}
    snap = analyze_interaction_turn(
        mode="proxy",
        input_analysis=inp,
        output_analysis=out,
        alignment=align,
        eza_score=85.0,
        redirect=redir,
        deception={"score": 0.1},
        legal_risk={"risk_score": 0.05},
        psych_pressure={"score": 0.0},
        policy_violation_count=0,
    )
    assert snap["schema_version"] == VECTOR_SCHEMA_VERSION
    assert "interaction_id" in snap
    assert snap["vector"]["input_risk"] == 0.2
    assert snap["vector"]["output_risk"] == 0.1
    assert snap["asymmetry"]["health_gap"] == pytest.approx(0.1, abs=1e-4)
    assert snap["asymmetry"]["risk_delta_output_minus_input"] == pytest.approx(-0.1, abs=1e-4)


def test_analyze_interaction_high_asymmetry():
    inp = {"risk_score": 0.05, "intent": "greeting"}
    out = {"risk_score": 0.8, "risk_level": "high"}
    align = {"alignment_score": 30.0, "verdict": "misaligned", "label": "Blocked"}
    redir = {"redirect": True, "reason": "high_output_risk"}
    snap = analyze_interaction_turn(
        mode="standalone",
        input_analysis=inp,
        output_analysis=out,
        alignment=align,
        eza_score=40.0,
        redirect=redir,
        policy_violation_count=2,
    )
    assert snap["vector"]["redirect"] is True
    assert snap["vector"]["policy_violation_count"] == 2
    assert snap["asymmetry"]["index"] > 0.5


def test_ema_and_slope():
    assert exponential_moving_average([], 0.3) == []
    assert last_ema([10.0, 20.0, 30.0], alpha=0.5) is not None
    assert simple_slope([0.0, 10.0]) == 10.0
    assert simple_slope([5.0]) == 0.0
