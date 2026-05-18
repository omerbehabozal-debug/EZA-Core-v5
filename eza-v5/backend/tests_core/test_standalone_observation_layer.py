# -*- coding: utf-8 -*-
"""Tests for standalone observation layer (rule-based, flag-gated)."""

from __future__ import annotations

import pytest

from backend.config import get_settings
from backend.core.engines.standalone_observation.service import (
    maybe_build_standalone_observation,
    safe_event_metadata,
    attach_standalone_observation_to_response,
)
from backend.core.engines.standalone_observation.tagger import build_observation


@pytest.fixture(autouse=True)
def _reset_observation_flag(monkeypatch):
    monkeypatch.setenv("STANDALONE_OBSERVATION_ENABLED", "false")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _scores(input_risk: float, output_risk: float, alignment: float = 85.0):
    return (
        {"risk_score": input_risk, "risk_level": "high" if input_risk > 0.6 else "low"},
        {"risk_score": output_risk, "risk_level": "low"},
        {"alignment_score": alignment, "verdict": "aligned"},
    )


def test_decision_prompt_maps_decision_direction(monkeypatch):
    monkeypatch.setenv("STANDALONE_OBSERVATION_ENABLED", "true")
    get_settings.cache_clear()
    inp, out, align = _scores(0.1, 0.1)
    obs = maybe_build_standalone_observation(
        user_text="Sence hangisi daha mantıklı, ne yapmalıyım?",
        output_text="İki seçenek var. Önce hedefini netleştir.",
        input_analysis=inp,
        output_analysis=out,
        alignment=align,
    )
    assert obs is not None
    assert obs["user_pattern"]["category"] == "decision_direction"


def test_clarity_prompt_maps_clarity_simplification(monkeypatch):
    monkeypatch.setenv("STANDALONE_OBSERVATION_ENABLED", "true")
    get_settings.cache_clear()
    inp, out, align = _scores(0.1, 0.1)
    obs = maybe_build_standalone_observation(
        user_text="Kısaca ve net özetler misin?",
        output_text="Özet: üç madde.",
        input_analysis=inp,
        output_analysis=out,
        alignment=align,
    )
    assert obs["user_pattern"]["category"] == "clarity_simplification"


def test_idea_prompt_maps_ideation_creation(monkeypatch):
    monkeypatch.setenv("STANDALONE_OBSERVATION_ENABLED", "true")
    get_settings.cache_clear()
    inp, out, align = _scores(0.1, 0.1)
    obs = maybe_build_standalone_observation(
        user_text="Bana yeni bir fikir ve konsept tasarla",
        output_text="İşte bir konsept ve alternatif tasarım önerisi.",
        input_analysis=inp,
        output_analysis=out,
        alignment=align,
    )
    assert obs["user_pattern"]["category"] == "ideation_creation"


def test_risky_input_safe_output_protective_safe_balance(monkeypatch):
    monkeypatch.setenv("STANDALONE_OBSERVATION_ENABLED", "true")
    get_settings.cache_clear()
    inp, out, align = _scores(0.72, 0.08)
    obs = maybe_build_standalone_observation(
        user_text="Tehlikeli bir şey söyleyeceğim",
        output_text="Üzgünüm, bu konuda yardımcı olamam. Güvenli alternatifler önerebilirim.",
        input_analysis=inp,
        output_analysis=out,
        alignment=align,
        redirect={"redirect": True, "reason": "high_input_risk"},
    )
    assert obs["ai_behavior"]["category"] == "protective"
    assert obs["relationship_balance"]["category"] == "safe_balance"


def test_no_strong_signal_fallbacks(monkeypatch):
    monkeypatch.setenv("STANDALONE_OBSERVATION_ENABLED", "true")
    get_settings.cache_clear()
    inp, out, align = _scores(0.12, 0.1)
    obs = maybe_build_standalone_observation(
        user_text="Merhaba",
        output_text="Merhaba, nasıl yardımcı olabilirim?",
        input_analysis=inp,
        output_analysis=out,
        alignment=align,
    )
    assert obs["user_pattern"]["category"] == "balanced_calm"
    assert obs["relationship_balance"]["category"] == "calm_rhythm"


def test_service_never_raises(monkeypatch):
    monkeypatch.setenv("STANDALONE_OBSERVATION_ENABLED", "true")
    get_settings.cache_clear()
    result = maybe_build_standalone_observation(
        user_text="x",
        output_text="y",
        input_analysis=None,  # type: ignore[arg-type]
        output_analysis="bad",  # type: ignore[arg-type]
        alignment=None,
    )
    assert result is None or isinstance(result, dict)
    resp = {"ok": True}
    attach_standalone_observation_to_response(
        resp,
        user_text="test",
        output_text="out",
        input_analysis={"risk_score": "not-a-number"},
        output_analysis={},
        alignment={},
    )
    assert "standalone_observation" not in resp or isinstance(
        resp.get("standalone_observation"), dict
    )


def test_flag_off_returns_none(monkeypatch):
    monkeypatch.setenv("STANDALONE_OBSERVATION_ENABLED", "false")
    get_settings.cache_clear()
    inp, out, align = _scores(0.5, 0.1)
    obs = maybe_build_standalone_observation(
        user_text="karar ver",
        output_text="cevap",
        input_analysis=inp,
        output_analysis=out,
        alignment=align,
    )
    assert obs is None
    resp: dict = {}
    attach_standalone_observation_to_response(
        resp,
        user_text="karar",
        output_text="cevap",
        input_analysis=inp,
        output_analysis=out,
        alignment=align,
    )
    assert "standalone_observation" not in resp


def test_safe_event_metadata_excludes_raw_message():
    obs = build_observation(
        user_text="Gizli kullanıcı mesajı içeriği",
        output_text="Gizli asistan cevabı",
        input_analysis={"risk_score": 0.2},
        output_analysis={"risk_score": 0.1},
        alignment={"alignment_score": 80},
    )
    meta = safe_event_metadata(obs)
    dumped = str(meta)
    assert "Gizli kullanıcı" not in dumped
    assert "Gizli asistan" not in dumped
    assert meta["user_pattern"]["category"]
    assert "signals" in meta["user_pattern"]


def test_build_observation_direct_without_flag():
    """Tagger works regardless of flag (service gates API attachment)."""
    obs = build_observation(
        user_text="hangisi daha iyi sence",
        output_text="İki seçenek:\n- A\n- B",
        input_analysis={"risk_score": 0.15},
        output_analysis={"risk_score": 0.12},
        alignment={"alignment_score": 88},
    )
    assert obs["user_pattern"]["category"] == "decision_direction"
