# -*- coding: utf-8 -*-
"""
Behavioral calibration math engine (Faz 1).

Observational only — does not block, allow, or alter safety rules.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence

import numpy as np
from scipy import stats

EPSILON = 1e-9

BEHAVIORAL_DISCLAIMER = (
    "Bu gözlem davranışsal veri üzerine kuruludur. Kesin yorum için daha fazla veri ve "
    "zaman gereklidir. Bu sistem hiçbir otomatik karar üretmez, sadece izler ve raporlar."
)

# EES group weights (sum = 1.0)
EES_WEIGHTS = {
    "A": 0.25,  # Manipülasyon (yüksek = kötü, inverted)
    "B": 0.20,  # Karar özgürlüğü (yüksek = iyi)
    "C": 0.15,  # AI Reliance (yüksek = kötü, inverted)
    "D": 0.15,  # Şeffaflık (yüksek = iyi)
    "E": 0.10,  # İçerik (yüksek = iyi)
    "F": 0.10,  # Etik (yüksek = iyi)
    "G": 0.05,  # Dinamik (yüksek = iyi)
}


class BehavioralMathEngineV1:
    """Pure math helpers for behavioral calibration (no I/O)."""

    @staticmethod
    def calculate_EMA(values: Sequence[float], alpha: float = 0.1) -> Dict[str, Any]:
        """
        Exponential moving average over a numeric series.

        Minimum 3 points required for a full result.
        """
        if len(values) < 3:
            return {
                "ok": False,
                "reason": "insufficient_data",
                "min_required": 3,
                "count": len(values),
                "ema": None,
            }
        a = float(alpha)
        ema: Optional[float] = None
        series: List[float] = []
        for x in values:
            v = float(x)
            if ema is None:
                ema = v
            else:
                ema = a * v + (1.0 - a) * ema
            series.append(ema)
        return {
            "ok": True,
            "count": len(values),
            "alpha": a,
            "ema_series": series,
            "ema": series[-1] if series else None,
        }

    @staticmethod
    def calculate_trend(values: Sequence[float]) -> Dict[str, Any]:
        """
        Linear regression trend; minimum 5 points.
        """
        if len(values) < 5:
            return {
                "ok": False,
                "reason": "insufficient_data",
                "min_required": 5,
                "count": len(values),
                "interpretation": None,
            }
        y = np.array([float(v) for v in values], dtype=float)
        x = np.arange(len(y), dtype=float)
        slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)
        slope_f = float(slope)
        if slope_f > 0.5:
            interpretation = "KÖTÜLEŞIYOR_HIZLI"
        elif slope_f > 0.1:
            interpretation = "KÖTÜLEŞIYOR_YAVAS"
        elif slope_f >= -0.1:
            interpretation = "STABİL"
        elif slope_f >= -0.5:
            interpretation = "İYİLEŞİYOR_YAVAS"
        else:
            interpretation = "İYİLEŞİYOR_HIZLI"
        return {
            "ok": True,
            "count": len(values),
            "slope": slope_f,
            "intercept": float(intercept),
            "r_squared": float(r_value ** 2),
            "p_value": float(p_value),
            "std_err": float(std_err),
            "interpretation": interpretation,
        }

    @staticmethod
    def z_score_check(
        value: float,
        mean: float,
        std: float,
        sample_count: int,
    ) -> Dict[str, Any]:
        """Z-score anomaly band; minimum 20 samples."""
        if sample_count < 20:
            return {
                "ok": False,
                "reason": "insufficient_data",
                "min_required": 20,
                "level": None,
                "z_score": None,
            }
        if std < EPSILON:
            return {
                "ok": True,
                "level": "STABİL",
                "z_score": 0.0,
                "reason": "zero_std",
            }
        z = (float(value) - float(mean)) / float(std)
        az = abs(z)
        if az > 2.0:
            level = "YÜKSEK"
        elif az > 1.5:
            level = "ORTA"
        else:
            level = "NORMAL"
        return {"ok": True, "level": level, "z_score": float(z)}

    @staticmethod
    def calculate_asymmetry(
        user_manipulation: float,
        user_pressure: float,
        user_autonomy: float,
        ai_manipulation: float,
        ai_deception: float,
        ai_alignment: float,
    ) -> Dict[str, Any]:
        """
        Asymmetry index in [-1, 1]: positive => AI baskın.
        """
        user_influence = (
            float(user_manipulation) * 0.3
            + float(user_pressure) * 0.3
            + float(user_autonomy) * 0.4
        )
        ai_influence = (
            float(ai_manipulation) * 0.3
            + float(ai_deception) * 0.3
            + float(ai_alignment) * 0.4
        )
        raw = (ai_influence - user_influence) / (ai_influence + user_influence + EPSILON)
        asymmetry = float(np.clip(raw, -1.0, 1.0))
        if asymmetry > 0.3:
            label = "AI_BASKIN"
        elif asymmetry > 0.1:
            label = "AI_HAFIF_BASKIN"
        elif asymmetry >= -0.1:
            label = "DENGELİ"
        else:
            label = "KULLANICI_YÖNLENDİRİYOR"
        return {
            "ok": True,
            "asymmetry_index": asymmetry,
            "label": label,
            "user_influence": user_influence,
            "ai_influence": ai_influence,
        }

    @staticmethod
    def calculate_reliability(
        sample_count: int,
        days_covered: float,
        total_days: float,
        days_since_last: float,
    ) -> Dict[str, Any]:
        """Data reliability score for behavioral interpretation."""
        n = int(sample_count)
        if n < 10:
            sample_adequacy = 0.2
        elif n < 20:
            sample_adequacy = 0.5
        elif n < 50:
            sample_adequacy = 0.7
        elif n < 100:
            sample_adequacy = 0.9
        else:
            sample_adequacy = 1.0

        if total_days <= 0:
            temporal_coverage = 0.0
        else:
            temporal_coverage = min(1.0, max(0.0, float(days_covered) / float(total_days)))

        if days_since_last <= 1:
            recency = 1.0
        elif days_since_last <= 7:
            recency = 0.8
        elif days_since_last <= 30:
            recency = 0.5
        else:
            recency = 0.2

        quality = sample_adequacy * 0.40 + temporal_coverage * 0.30 + recency * 0.30
        if quality >= 0.8:
            level = "YÜKSEK"
        elif quality >= 0.6:
            level = "ORTA"
        elif quality >= 0.4:
            level = "DÜŞÜK"
        else:
            level = "YETERSİZ"

        return {
            "ok": True,
            "quality": float(quality),
            "level": level,
            "sample_adequacy": sample_adequacy,
            "temporal_coverage": temporal_coverage,
            "recency": recency,
        }

    @staticmethod
    def calculate_EES(group_scores: Dict[str, float], sample_count: int) -> Dict[str, Any]:
        """
        Ethical Engagement Score (0–100) from group metrics A–G.
        """
        def _g(key: str, default: float = 50.0) -> float:
            return float(group_scores.get(key, default))

        a = 100.0 - _g("A")
        b = _g("B")
        c = 100.0 - _g("C")
        d = _g("D")
        e = _g("E")
        f = _g("F")
        g = _g("G")

        raw = (
            EES_WEIGHTS["A"] * a
            + EES_WEIGHTS["B"] * b
            + EES_WEIGHTS["C"] * c
            + EES_WEIGHTS["D"] * d
            + EES_WEIGHTS["E"] * e
            + EES_WEIGHTS["F"] * f
            + EES_WEIGHTS["G"] * g
        )
        confidence_weight = min(1.0, float(sample_count) / 30.0)
        score = 50.0 + (raw - 50.0) * confidence_weight

        return {
            "ok": True,
            "ees_score": float(np.clip(score, 0.0, 100.0)),
            "confidence_weight": confidence_weight,
            "weights": EES_WEIGHTS,
            "components": {"A": a, "B": b, "C": c, "D": d, "E": e, "F": f, "G": g},
        }

    @staticmethod
    def calculate_vayBe(
        current_scores: Dict[str, float],
        baseline: Dict[str, Dict[str, float]],
        sample_count: int,
    ) -> Dict[str, Any]:
        """
        Insight generator (vayBe): anomaly when |z| >= 2 on any metric.
        """
        reliability = BehavioralMathEngineV1.calculate_reliability(
            sample_count=sample_count,
            days_covered=baseline.get("_meta", {}).get("days_covered", 0.0),
            total_days=baseline.get("_meta", {}).get("total_days", 30.0),
            days_since_last=baseline.get("_meta", {}).get("days_since_last", 999.0),
        )
        confidence = float(reliability.get("quality", 0.0)) * 100.0
        can_interpret = sample_count >= 20 and reliability.get("level") in ("YÜKSEK", "ORTA")

        if sample_count < 20:
            return {
                "ok": False,
                "generate": False,
                "reason": "insufficient_data",
                "min_required": 20,
                "reliability": reliability,
                "confidence": confidence,
                "can_interpret": False,
                "disclaimer": BEHAVIORAL_DISCLAIMER,
            }

        display_names = {
            "eza_score": "EZA Güvenlik Skoru",
            "input_risk": "Girdi Riski",
            "output_risk": "Çıktı Riski",
            "alignment_score": "Hizalama Skoru",
            "asymmetry_index": "Dengesizlik İndeksi",
            "reliance_signal": "AI Destek Kullanım Yoğunluğu",
        }

        best_metric: Optional[str] = None
        best_z = 0.0
        best_direction = "stable"

        for metric, value in current_scores.items():
            base = baseline.get(metric)
            if not base:
                continue
            zr = BehavioralMathEngineV1.z_score_check(
                value=float(value),
                mean=float(base.get("mean", 0.0)),
                std=float(base.get("std", 0.0)),
                sample_count=sample_count,
            )
            if not zr.get("ok"):
                continue
            z = abs(float(zr.get("z_score") or 0.0))
            if z > best_z:
                best_z = z
                best_metric = metric
                raw_z = float(zr.get("z_score") or 0.0)
                best_direction = "up" if raw_z > 0 else "down"

        if best_metric is None or best_z < 2.0:
            return {
                "ok": True,
                "generate": False,
                "reason": "no_anomaly",
                "reliability": reliability,
                "confidence": confidence,
                "can_interpret": can_interpret,
                "disclaimer": BEHAVIORAL_DISCLAIMER,
            }

        base = baseline[best_metric]
        mean = float(base.get("mean", 0.0))
        cur = float(current_scores[best_metric])
        pct = 0.0 if abs(mean) < EPSILON else ((cur - mean) / abs(mean)) * 100.0
        display = display_names.get(best_metric, best_metric)

        insight_text = (
            f"Davranışsal Gözlem: {display} son dönemde tipik aralığın dışında "
            f"({'artış' if best_direction == 'up' else 'azalış'} sinyali, z≈{best_z:.2f}). "
            f"Dikkat Gerektiriyor — otomatik müdahale yok."
        )

        return {
            "ok": True,
            "generate": True,
            "metric": best_metric,
            "display_name": display,
            "z_score": best_z,
            "direction": best_direction,
            "percent_change": float(pct),
            "insight_text": insight_text,
            "confidence": confidence,
            "can_interpret": can_interpret,
            "reliability": reliability,
            "disclaimer": BEHAVIORAL_DISCLAIMER,
        }
