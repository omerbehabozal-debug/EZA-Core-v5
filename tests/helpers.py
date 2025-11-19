from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple

from .config import (
    client,
    EngineMode,
    DEFAULT_STANDALONE_ENDPOINT,
    DEFAULT_PROXY_ENDPOINT,
    DEFAULT_PROXY_FAST_ENDPOINT,
    DEFAULT_PROXY_DEEP_ENDPOINT,
    DEFAULT_ANALYZE_ENDPOINT,
)

"""
ORTAK YARDIMCI FONKSİYONLAR

DİKKAT:
- Buradaki request body yapısını backend/main.py'deki gerçek endpoint şemalarına göre
  GEREKİRSE GÜNCELLE.
- Özellikle `payload = {...}` kısmında `input`, `message`, `user_input` vs. alan isimleri
  projenle birebir aynı olmalı.
"""


def get_endpoint_for_mode(mode: EngineMode) -> str:
    if mode == "standalone":
        return DEFAULT_STANDALONE_ENDPOINT
    if mode == "proxy":
        return DEFAULT_PROXY_ENDPOINT
    if mode == "proxy_fast":
        return DEFAULT_PROXY_FAST_ENDPOINT
    if mode == "proxy_deep":
        return DEFAULT_PROXY_DEEP_ENDPOINT
    raise ValueError(f"Unknown engine mode: {mode}")


def send_message(
    mode: EngineMode,
    message: str,
    history: Optional[List[Dict[str, Any]]] = None,
    meta: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Ortak istek fonksiyonu.

    ÖNEMLİ:
    - Burada `payload` içindeki alanları kendi Pydantic request modeline göre AYARLA.
    - Backend AnalyzeRequest modeli: text, query, mode alanlarını bekliyor
    """
    endpoint = get_endpoint_for_mode(mode)
    payload: Dict[str, Any] = {
        "text": message,  # Backend AnalyzeRequest.text bekliyor
        "mode": mode,
    }
    
    if history:
        payload["history"] = history
    if meta:
        payload.update(meta)

    response = client.post(endpoint, json=payload)
    assert (
        response.status_code == 200
    ), f"{endpoint} failed with {response.status_code}: {response.text}"
    return response.json()


def analyze_only(
    message: str,
    history: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Sadece analiz endpoint'ine istek atmak için yardımcı fonksiyon.
    """
    payload: Dict[str, Any] = {
        "text": message,
    }
    if history:
        payload["history"] = history
    
    response = client.post(DEFAULT_ANALYZE_ENDPOINT, json=payload)
    assert response.status_code == 200, f"/analyze failed: {response.text}"
    return response.json()


# ---------- JSON'dan ortak alanları çıkaran yardımcılar ----------


def _get_nested(d: Dict[str, Any], *keys: str) -> Any:
    cur: Any = d
    for k in keys:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(k)
        if cur is None:
            return None
    return cur


def get_report_root(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Bazı endpointler:
        { "report": {...} }
    dönerken, bazıları direkt {...} dönebilir.
    Bu fonksiyon rapor köküne ulaşmayı dener.
    """
    if "report" in data and isinstance(data["report"], dict):
        return data["report"]
    return data


def get_eza_score(data: Dict[str, Any]) -> float:
    """
    EZA Score v2.1 değerini bulmaya çalışır.
    Olası path'ler:
      - data["analysis"]["eza_score"]["eza_score"]
      - data["eza_score"]["eza_score"]
      - data["analysis"]["eza_score"]
    """
    report = get_report_root(data)
    candidates = [
        _get_nested(report, "analysis", "eza_score", "eza_score"),
        _get_nested(report, "analysis", "eza_score", "score"),
        _get_nested(report, "eza_score", "eza_score"),
        _get_nested(report, "eza_score", "score"),
        data.get("eza_score"),
    ]
    for c in candidates:
        if c is not None:
            try:
                return float(c)
            except (TypeError, ValueError):
                continue
    raise AssertionError(f"EZA Score bulunamadı. Gelen data keys: {list(data.keys())}")


def get_risk_level(data: Dict[str, Any]) -> Optional[str]:
    """
    Olası path'ler:
      - report["analysis"]["final"]["risk_level"]
      - report["risk_level"]
      - data["risk_level"]
    """
    report = get_report_root(data)
    candidates = [
        _get_nested(report, "analysis", "final", "risk_level"),
        _get_nested(report, "risk_level"),
        data.get("risk_level"),
    ]
    for c in candidates:
        if c:
            return str(c)
    return None


def get_intent(data: Dict[str, Any]) -> Optional[str]:
    """
    Olası path'ler:
      - report["intent"]
      - report["analysis"]["input"]["intent_engine"]["primary"]
      - data["intent"]
    """
    report = get_report_root(data)
    candidates = [
        report.get("intent"),
        _get_nested(report, "analysis", "input", "intent_engine", "primary"),
        data.get("intent"),
    ]
    for c in candidates:
        if c:
            return str(c)
    return None


def get_drift_score(data: Dict[str, Any]) -> Optional[float]:
    report = get_report_root(data)
    candidate = _get_nested(report, "drift", "drift_score")
    if candidate is None:
        candidate = _get_nested(report, "context_drift", "score")
    if candidate is None:
        candidate = _get_nested(report, "analysis", "drift_matrix", "overall_drift_score")
    if candidate is None:
        return None
    try:
        return float(candidate)
    except (TypeError, ValueError):
        return None


# ---------- Ortak assertion yardımcıları ----------


def assert_score_between(score: float, low: float, high: float) -> None:
    assert low <= score <= high, f"EZA Score {score} expected between {low} and {high}"


def assert_intent_equals(data: Dict[str, Any], expected_intent: str) -> None:
    intent = get_intent(data)
    assert intent == expected_intent, f"Intent {intent}, expected {expected_intent}"


def assert_risk_equals(data: Dict[str, Any], expected_level: str) -> None:
    risk = get_risk_level(data)
    assert (
        risk == expected_level
    ), f"Risk level {risk}, expected {expected_level}"


def assert_not_none(value: Any, message: str) -> None:
    assert value is not None, message

