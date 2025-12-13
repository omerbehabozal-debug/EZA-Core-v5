# Backend Endpoint Kontrol Listesi

## 1. Backend'in Çalıştığını Kontrol Et

Terminal'de backend dizinine gidin ve çalıştığını kontrol edin:

```bash
cd eza-v5/backend
# Backend çalışıyor mu kontrol et
# Eğer çalışmıyorsa:
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 2. Backend URL'ini Kontrol Et

Tarayıcıda şu URL'leri test edin:

- **Health Check**: http://localhost:8000/
- **Standalone Endpoint**: http://localhost:8000/api/standalone
- **Streaming Endpoint**: http://localhost:8000/api/standalone/stream

## 3. Frontend Environment Variable Kontrolü

Frontend'de `.env.local` veya `.env` dosyasında şu değişken olmalı:

```bash
NEXT_PUBLIC_EZA_API_URL=http://localhost:8000
```

Eğer yoksa, `eza-v5/frontend/.env.local` dosyası oluşturun:

```bash
NEXT_PUBLIC_EZA_API_URL=http://localhost:8000
NEXT_PUBLIC_EZA_WS_URL=ws://localhost:8000
```

## 4. CORS Ayarları Kontrolü

Backend'de `main.py` dosyasında CORS ayarları `localhost:3008` için açık olmalı.

## 5. Backend Loglarını Kontrol Et

Backend terminalinde şu hataları arayın:
- Import errors
- Module not found
- Port already in use

## 6. Hızlı Test

Terminal'de şu komutu çalıştırarak endpoint'i test edin:

```bash
curl -X POST http://localhost:8000/api/standalone/stream \
  -H "Content-Type: application/json" \
  -d '{"text": "test", "safe_only": false}'
```

Eğer 404 hatası alırsanız, backend endpoint'i bulamıyor demektir.

## 7. Backend'in Yeniden Başlatılması

Eğer değişiklikler yaptıysanız, backend'i yeniden başlatın:

```bash
# Backend'i durdurun (Ctrl+C)
# Sonra tekrar başlatın:
cd eza-v5/backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 8. Frontend'in Yeniden Başlatılması

Frontend'i de yeniden başlatın:

```bash
cd eza-v5/frontend
npm run dev
```

## Sorun Giderme

### Hata: "ModuleNotFoundError: No module named 'backend.api.streaming'"

Backend'de `streaming.py` dosyasının doğru yerde olduğundan emin olun:
- Dosya yolu: `eza-v5/backend/api/streaming.py`

### Hata: "404 Not Found"

1. Backend'in çalıştığını kontrol edin
2. Endpoint'in doğru tanımlandığını kontrol edin (`main.py` dosyasında)
3. URL'in doğru olduğunu kontrol edin

### Hata: "CORS policy"

Backend'de CORS ayarlarını kontrol edin ve frontend URL'ini ekleyin.

