# -*- coding: utf-8 -*-
"""Tests for Safe Mode Faz 1 behavioral math engine and service rules."""

import pytest
from unittest.mock import AsyncMock, patch

from backend.core.engines.behavioral.math_engine_v1 import (
    BehavioralMathEngineV1,
    BEHAVIORAL_DISCLAIMER,
    EES_WEIGHTS,
)
from backend.core.engines.behavioral import service as behavioral_service
from backend.core.engines.behavioral.math_engine_v2_stub import (
    mahalanobis_anomaly,
    isolation_forest,
    detect_seasonality,
    adaptive_learning,
)

_engine = BehavioralMathEngineV1()


def test_EMA_normal():
    r = _engine.calculate_EMA([10.0, 12.0, 11.0, 13.0], alpha=0.2)
    assert r["ok"] is True
    assert r["ema"] is not None
    assert len(r["ema_series"]) == 4


def test_EMA_insufficient():
    r = _engine.calculate_EMA([1.0, 2.0], alpha=0.1)
    assert r["ok"] is False
    assert r["min_required"] == 3


def test_trend_normal():
    r = _engine.calculate_trend([1.0, 2.0, 3.0, 4.0, 5.0, 6.0])
    assert r["ok"] is True
    assert r["slope"] > 0
    assert r["interpretation"] in (
        "KÖTÜLEŞIYOR_HIZLI",
        "KÖTÜLEŞIYOR_YAVAS",
        "STABİL",
        "İYİLEŞİYOR_YAVAS",
        "İYİLEŞİYOR_HIZLI",
    )


def test_trend_insufficient_under_5():
    r = _engine.calculate_trend([1.0, 2.0, 3.0])
    assert r["ok"] is False
    assert r["min_required"] == 5


def test_z_score_normal():
    r = _engine.z_score_check(110.0, 100.0, 5.0, sample_count=25)
    assert r["ok"] is True
    assert r["level"] in ("NORMAL", "ORTA", "YÜKSEK", "STABİL")


def test_z_score_insufficient_under_20():
    r = _engine.z_score_check(110.0, 100.0, 5.0, sample_count=10)
    assert r["ok"] is False


def test_z_score_zero_std():
    r = _engine.z_score_check(50.0, 50.0, 0.0, sample_count=30)
    assert r["ok"] is True
    assert r["level"] == "STABİL"


def test_asymmetry_balanced():
    r = _engine.calculate_asymmetry(0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
    assert r["label"] == "DENGELİ"


def test_asymmetry_ai_dominant():
    r = _engine.calculate_asymmetry(0.1, 0.1, 0.1, 0.9, 0.9, 0.9)
    assert r["label"] in ("AI_BASKIN", "AI_HAFIF_BASKIN")
    assert r["asymmetry_index"] > 0.1


def test_asymmetry_user_dominant():
    r = _engine.calculate_asymmetry(0.9, 0.9, 0.9, 0.1, 0.1, 0.1)
    assert r["label"] == "KULLANICI_YÖNLENDİRİYOR"
    assert r["asymmetry_index"] < -0.1


def test_reliability_high():
    r = _engine.calculate_reliability(100, 28.0, 30.0, 0.5)
    assert r["level"] == "YÜKSEK"
    assert r["quality"] >= 0.8


def test_reliability_insufficient():
    r = _engine.calculate_reliability(3, 1.0, 30.0, 60.0)
    assert r["level"] in ("DÜŞÜK", "YETERSİZ")


def test_EES_weights_sum_to_one():
    assert pytest.approx(sum(EES_WEIGHTS.values()), abs=1e-6) == 1.0


def test_EES_confidence_weight_low_sample():
    r = _engine.calculate_EES({"A": 80, "B": 80, "C": 80, "D": 80, "E": 80, "F": 80, "G": 80}, 5)
    assert r["confidence_weight"] == pytest.approx(5 / 30.0)
    assert 45.0 <= r["ees_score"] <= 55.0


def test_vayBe_insufficient_under_20():
    r = _engine.calculate_vayBe({"eza_score": 90}, {"eza_score": {"mean": 80, "std": 5}}, 10)
    assert r["generate"] is False
    assert "disclaimer" in r


def test_vayBe_no_anomaly_below_threshold():
    baseline = {
        "eza_score": {"mean": 80.0, "std": 5.0},
        "_meta": {"days_covered": 20.0, "total_days": 30.0, "days_since_last": 1.0},
    }
    current = {"eza_score": 81.0}
    r = _engine.calculate_vayBe(current, baseline, 25)
    assert r.get("generate") is False


def test_vayBe_generates_insight():
    baseline = {
        "eza_score": {"mean": 50.0, "std": 2.0},
        "_meta": {"days_covered": 20.0, "total_days": 30.0, "days_since_last": 1.0},
    }
    current = {"eza_score": 90.0}
    r = _engine.calculate_vayBe(current, baseline, 25)
    assert r.get("generate") is True


def test_vayBe_has_all_required_fields():
    baseline = {
        "eza_score": {"mean": 50.0, "std": 2.0},
        "_meta": {"days_covered": 20.0, "total_days": 30.0, "days_since_last": 1.0},
    }
    r = _engine.calculate_vayBe({"eza_score": 95.0}, baseline, 25)
    for key in (
        "generate",
        "metric",
        "display_name",
        "z_score",
        "direction",
        "percent_change",
        "insight_text",
        "confidence",
        "can_interpret",
        "reliability",
        "disclaimer",
    ):
        assert key in r


def test_vayBe_has_disclaimer():
    r = _engine.calculate_vayBe({}, {}, 25)
    assert r["disclaimer"] == BEHAVIORAL_DISCLAIMER


def test_feedback_enum_validation():
    assert "CORRECT" in behavioral_service.VALID_FEEDBACK_TYPES
    assert "INVALID" not in behavioral_service.VALID_FEEDBACK_TYPES


@pytest.mark.asyncio
async def test_org_isolation_admin_endpoint():
    db = AsyncMock()
    with patch(
        "backend.core.engines.behavioral.service.check_user_organization_membership",
        new_callable=AsyncMock,
    ) as mock_check:
        mock_check.side_effect = [True, False]
        allowed = await behavioral_service.verify_admin_can_view_user(
            db, "admin-1", "user-2", "org-a"
        )
        assert allowed is False


def test_case_snapshot_null_in_production(monkeypatch):
    from backend.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("ENV", "prod")
    monkeypatch.setenv("TEST_MODE", "false")
    get_settings.cache_clear()
    settings = get_settings()
    settings.ENV = "prod"
    settings.TEST_MODE = False
    snap = behavioral_service.resolve_case_snapshot({"vector": {"x": 1}, "message": "secret"})
    assert snap is None
    get_settings.cache_clear()


def test_case_snapshot_allowed_in_test_mode(monkeypatch):
    from backend.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("TEST_MODE", "true")
    get_settings.cache_clear()
    settings = get_settings()
    settings.TEST_MODE = True
    settings.ENV = "dev"
    snap = behavioral_service.resolve_case_snapshot(
        {"vector": {"input_risk": 0.1}, "mode": "standalone", "message": "ignored"}
    )
    assert snap is not None
    assert "message" not in snap
    get_settings.cache_clear()


def test_v2_stubs_not_implemented():
    for fn in (mahalanobis_anomaly, isolation_forest, detect_seasonality, adaptive_learning):
        out = fn([]) if fn != mahalanobis_anomaly else fn([1.0], {})
        assert out["status"] == "not_implemented"
        assert out["can_interpret"] is False
