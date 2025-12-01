# Streaming Endpoint Test Rehberi

## Endpoint Tanımlı mı?

Endpoint kodda tanımlı: `eza-v5/backend/main.py` satır 210'da.

Ancak FastAPI dokümantasyonunda görünmeyebilir çünkü:
- `StreamingResponse` kullanıldığında FastAPI bazen bunu OpenAPI şemasına eklemez
- Bu normal bir durumdur ve endpoint çalışıyor olabilir

## Endpoint'i Test Etme

### Yöntem 1: Tarayıcı Console'u ile

1. Tarayıcıda F12 → Console sekmesini açın
2. Şu kodu çalıştırın:

```javascript
fetch('http://localhost:8000/api/standalone/stream', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    text: 'test mesajı',
    safe_only: false
  })
})
.then(response => {
  console.log('Status:', response.status);
  console.log('Content-Type:', response.headers.get('content-type'));
  if (response.status === 200) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    function readChunk() {
      reader.read().then(({ done, value }) => {
        if (done) {
          console.log('Stream tamamlandı');
          return;
        }
        const chunk = decoder.decode(value);
        console.log('Chunk:', chunk);
        readChunk();
      });
    }
    readChunk();
  } else {
    console.error('Hata:', response.status, response.statusText);
  }
})
.catch(error => {
  console.error('Network hatası:', error);
});
```

### Yöntem 2: curl ile (Terminal)

```bash
curl -X POST http://localhost:8000/api/standalone/stream \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"test\", \"safe_only\": false}" \
  -N
```

`-N` parametresi streaming response'u gösterir.

### Yöntem 3: Postman veya Insomnia

1. Method: POST
2. URL: `http://localhost:8000/api/standalone/stream`
3. Headers:
   - `Content-Type: application/json`
4. Body (JSON):
   ```json
   {
     "text": "test mesajı",
     "safe_only": false
   }
   ```

## Beklenen Sonuç

**Başarılı ise:**
- Status: 200 OK
- Content-Type: `text/event-stream`
- Response body'de şu format görünmeli:
  ```
  data: {"token": "kelime1 "}
  data: {"token": "kelime2 "}
  ...
  data: {"done": true, "assistant_score": 42, "user_score": 85}
  ```

**Hata ise:**
- Status: 404 → Endpoint bulunamadı (backend yeniden başlatılmalı)
- Status: 500 → Backend hatası (logları kontrol edin)
- CORS hatası → CORS ayarlarını kontrol edin

## Backend'i Yeniden Başlatma

Endpoint'i ekledikten sonra backend'i mutlaka yeniden başlatın:

```bash
cd eza-v5/backend
# Ctrl+C ile durdurun
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Sorun Giderme

### Endpoint 404 veriyorsa:
1. Backend'in çalıştığından emin olun
2. Backend'i yeniden başlatın
3. `main.py` dosyasında endpoint'in doğru tanımlandığını kontrol edin

### CORS hatası alıyorsanız:
- `main.py` dosyasında `allowed_origins` listesine frontend URL'inizi ekleyin

### Import hatası alıyorsanız:
- `streaming.py` dosyasının `eza-v5/backend/api/streaming.py` yolunda olduğundan emin olun
- Backend'i yeniden başlatın

