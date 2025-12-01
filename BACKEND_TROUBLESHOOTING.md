# Backend Endpoint Sorun Giderme Rehberi

## Hızlı Kontrol Listesi

### 1. Backend Çalışıyor mu?

**Terminal'de kontrol edin:**
```bash
# Backend dizinine gidin
cd eza-v5/backend

# Backend çalışıyor mu? (Başka bir terminal penceresinde)
# Eğer çalışmıyorsa başlatın:
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Tarayıcıda test edin:**
- http://localhost:8000/ → Backend ana sayfa görünmeli
- http://localhost:8000/docs → FastAPI dokümantasyonu görünmeli

### 2. Frontend Environment Variable

**`.env.local` dosyası oluşturuldu mu?**
- Dosya yolu: `eza-v5/frontend/.env.local`
- İçeriği:
  ```
  NEXT_PUBLIC_EZA_API_URL=http://localhost:8000
  NEXT_PUBLIC_EZA_WS_URL=ws://localhost:8000
  ```

**Frontend'i yeniden başlatın:**
```bash
cd eza-v5/frontend
# Ctrl+C ile durdurun
npm run dev
```

### 3. Endpoint Kontrolü

**Backend'de endpoint tanımlı mı?**
- Dosya: `eza-v5/backend/main.py`
- Satır 210'da şu satır olmalı:
  ```python
  @app.post("/api/standalone/stream", tags=["Standalone"])
  ```

**Streaming modülü mevcut mu?**
- Dosya: `eza-v5/backend/api/streaming.py`
- Bu dosya mevcut olmalı

### 4. CORS Ayarları

**Backend'de CORS ayarları doğru mu?**
- Dosya: `eza-v5/backend/main.py`
- Satır 109'da `http://localhost:3008` listede olmalı

### 5. Backend Loglarını Kontrol Edin

Backend terminalinde şu hataları arayın:
- `ModuleNotFoundError` → Modül bulunamadı
- `ImportError` → Import hatası
- `404` → Endpoint bulunamadı

## Adım Adım Çözüm

### Adım 1: Backend'i Başlatın

```bash
cd eza-v5/backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Beklenen çıktı:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### Adım 2: Endpoint'i Test Edin

**Tarayıcıda veya Postman'de:**
```
POST http://localhost:8000/api/standalone/stream
Content-Type: application/json

{
  "text": "test",
  "safe_only": false
}
```

**Beklenen:**
- Streaming response (text/event-stream)
- Token'lar gelmeye başlamalı

### Adım 3: Frontend'i Yeniden Başlatın

```bash
cd eza-v5/frontend
# .env.local dosyasının olduğundan emin olun
npm run dev
```

### Adım 4: Browser Console'u Kontrol Edin

Tarayıcıda F12 → Console sekmesinde:
- Network sekmesinde `/api/standalone/stream` isteğini kontrol edin
- Status code: 200 olmalı
- Response type: `text/event-stream` olmalı

## Yaygın Hatalar ve Çözümleri

### Hata: "404 Not Found"

**Neden:**
- Backend çalışmıyor
- Endpoint yanlış tanımlanmış
- URL yanlış

**Çözüm:**
1. Backend'in çalıştığını kontrol edin
2. `main.py` dosyasında endpoint'in doğru tanımlandığını kontrol edin
3. Frontend'deki URL'in doğru olduğunu kontrol edin

### Hata: "CORS policy"

**Neden:**
- Backend CORS ayarlarında frontend URL'i yok

**Çözüm:**
- `main.py` dosyasında `allowed_origins` listesine frontend URL'ini ekleyin

### Hata: "ModuleNotFoundError: No module named 'backend.api.streaming'"

**Neden:**
- `streaming.py` dosyası yanlış yerde
- Python path yanlış

**Çözüm:**
- Dosyanın `eza-v5/backend/api/streaming.py` yolunda olduğundan emin olun
- Backend'i yeniden başlatın

## Test Komutları

### Backend Health Check
```bash
curl http://localhost:8000/
```

### Endpoint Test
```bash
curl -X POST http://localhost:8000/api/standalone/stream \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"test\", \"safe_only\": false}"
```

## Hala Çalışmıyorsa

1. Backend loglarını kontrol edin
2. Frontend console'u kontrol edin
3. Network sekmesinde istek detaylarını kontrol edin
4. Backend ve frontend'i tamamen yeniden başlatın

