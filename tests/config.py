from typing import Literal
from fastapi.testclient import TestClient

# NOT:
# backend/main.py içinde mutlaka `app = FastAPI()` tanımlı olmalı.
# Gerekirse import yolunu kendi projenin yapısına göre güncelle.
from backend.main import app

# FastAPI TestClient — tüm testler backend'e buradan ulaşacak.
client = TestClient(app)

# EZA engine modları
EngineMode = Literal["standalone", "proxy", "proxy_fast", "proxy_deep"]

# Varsayılan endpoint path'leri
# TODO: Eğer backend'de farklı path kullanıyorsan burayı güncelle.
DEFAULT_STANDALONE_ENDPOINT = "/standalone_chat"
DEFAULT_PROXY_ENDPOINT = "/proxy_chat"
DEFAULT_PROXY_FAST_ENDPOINT = "/proxy_fast"
DEFAULT_PROXY_DEEP_ENDPOINT = "/proxy_deep"
DEFAULT_ANALYZE_ENDPOINT = "/analyze"

