"""
EZA-Core v4.0
API Uç Nokta Testleri
---------------------
Bu test dosyası, FastAPI üzerinde tanımlı tüm endpoint'lerin
doğru çalışıp çalışmadığını doğrular.
"""

import pytest
from fastapi.testclient import TestClient

from backend.main import app


# ---------------------------------------------------------
# FastAPI test istemcisi
# ---------------------------------------------------------

client = TestClient(app)


# ---------------------------------------------------------
# /health testi
# ---------------------------------------------------------

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json().get("status") == "ok"


# ---------------------------------------------------------
# /analyze testi
# ---------------------------------------------------------

def test_analyze():
    payload = {"text": "Bugün çok moralim bozuk."}
    res = client.post("/analyze", json=payload)

    assert res.status_code == 200

    data = res.json()
    assert "language" in data
    assert "intents" in data
    assert "risk_level" in data


# ---------------------------------------------------------
# /pair testi
# ---------------------------------------------------------

def test_pair():
    payload = {
        "input_text": "Kendimi kötü hissediyorum.",
        "output_text": "Bu tür hisler zor olabilir, yalnız değilsin."
    }

    res = client.post("/pair", json=payload)
    assert res.status_code == 200

    data = res.json()

    assert "alignment_score" in data
    assert "alignment_label" in data


# ---------------------------------------------------------
# /dashboard testi
# ---------------------------------------------------------

def test_dashboard():
    res = client.get("/dashboard")
    assert res.status_code == 200
    assert "<html" in res.text.lower()  # html döndüğünü garanti eder
