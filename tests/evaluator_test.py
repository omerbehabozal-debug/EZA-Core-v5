"""
EZA-Core v4.0
Evaluator Testleri
------------------
Bu test dosyası input_analyzer modülünün:
- niyet tespiti
- risk skorlaması
- kategori çıkarımı

gibi temel görevlerini doğru yapıp yapmadığını denetler.
"""

import yaml
import os
import pytest

from backend.api.input_analyzer import analyze_input

# ---------------------------------------------------------
# YAML test senaryolarını yükleme
# ---------------------------------------------------------

TEST_FILE = os.path.join(os.path.dirname(__file__), "test_cases.yaml")

with open(TEST_FILE, "r", encoding="utf-8") as f:
    CASES = yaml.safe_load(f)["cases"]


# ---------------------------------------------------------
# Yardımcı: beklenen intent'i input analyzer skorlarından çıkar
# ---------------------------------------------------------

def detect_intent_from_scores(scores: dict) -> str:
    intents = scores.get("intents", {})
    if not intents:
        return "unknown"

    # en yüksek değerli intent'i bul
    top = max(intents, key=intents.get)
    return top


# ---------------------------------------------------------
# Yardımcı: risk label çıkarımı
# ---------------------------------------------------------

def detect_risk_label(scores: dict) -> str:
    rl = scores.get("risk_level", "normal")
    return rl


# ---------------------------------------------------------
# Test Fonksiyonu
# ---------------------------------------------------------

@pytest.mark.parametrize("case", CASES)
def test_input_analyzer(case):

    input_text = case["input"]
    expected_intent = case.get("expected_intent")
    expected_risk = case.get("expected_risk")

    result = analyze_input(input_text)

    # input analyzer’ın verdiği skorları çöz
    detected_intent = detect_intent_from_scores(result)
    detected_risk = detect_risk_label(result)

    print("\n======================")
    print("INPUT   :", input_text)
    print("EXPECTED INTENT:", expected_intent)
    print("DETECTED INTENT:", detected_intent)
    print("EXPECTED RISK  :", expected_risk)
    print("DETECTED RISK  :", detected_risk)
    print("======================")

    # intent kontrolü
    if expected_intent:
        assert detected_intent == expected_intent or expected_intent in detected_intent

    # risk kontrolü
    if expected_risk:
        assert expected_risk.lower() in detected_risk.lower()
