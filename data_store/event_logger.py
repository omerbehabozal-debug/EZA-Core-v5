"""
EZA-Core v4.0
Event Logger
----------------
Bu modül, input-output analiz döngüsünde oluşan tüm olayları kaydeder.
Şu an için JSON dosyasına loglama yapılır.
Daha sonra PostgreSQL / Supabase entegrasyonu kolayca eklenebilir.
"""

import json
import os
from datetime import datetime
from typing import Dict, Any


LOG_DIR = "logs"
LOG_FILE = os.path.join(LOG_DIR, "events.jsonl")  # JSON Lines formatı


# -------------------------------------------------------------------
# Yardımcı
# -------------------------------------------------------------------

def _ensure_log_dir():
    """logs/ klasörü yoksa oluşturur."""
    if not os.path.exists(LOG_DIR):
        os.makedirs(LOG_DIR)


# -------------------------------------------------------------------
# Ana Log Fonksiyonu
# -------------------------------------------------------------------

def log_event(event: Dict[str, Any]) -> None:
    """
    EZA analiz zincirinin her aşamasını loglar.

    event {
        "timestamp": "...",
        "query": "...",
        "models_used": [...],
        "input_scores": {...},
        "model_outputs": {...},
        "output_scores": {...},
        "alignment_score": 0.78,
        "advice": "...",
        "rewritten_text": "..."
    }
    """

    _ensure_log_dir()

    # Zaman damgası ekle
    event["timestamp"] = datetime.utcnow().isoformat()

    # JSON Lines formatında yaz
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(event, ensure_ascii=False))
        f.write("\n")


# -------------------------------------------------------------------
# Gelecekte Kullanılacak: Supabase / PostgreSQL eklentisi
# -------------------------------------------------------------------

def log_event_to_db(event: Dict[str, Any]):
    """
    İleride Supabase veya PostgreSQL eklemek istediğimizde bu fonksiyon aktif olacak.
    Şu an doldurulmadan bırakıyoruz.
    """
    pass
