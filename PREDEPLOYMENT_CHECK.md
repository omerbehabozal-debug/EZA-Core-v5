# Pre-deployment Validation Checklist

## Overview

Bu dokümantasyon, EZA-Core'un backend + frontend entegrasyonunun doğru ve stabil çalıştığını doğrulamak için hazırlanmıştır. Aşama 7 (CI/CD & Deployment) öncesi tüm güvenlik, rol, WebSocket ve public endpoint işlevlerinin üretim seviyesinde çalıştığını doğrulamak için kullanılır.

---

## 1. JWT Token Üretme

### Backend'de Token Üretme

```python
# Python shell'de veya script'te
from backend.auth.jwt import create_jwt

# Admin token (8 saat geçerli)
admin_token = create_jwt(user_id=1, role="admin")
print(f"Admin Token: {admin_token}")

# Corporate token
corporate_token = create_jwt(user_id=2, role="corporate")
print(f"Corporate Token: {corporate_token}")

# Regulator token
regulator_token = create_jwt(user_id=3, role="regulator")
print(f"Regulator Token: {regulator_token}")
```

### Test Token'ları

Aşağıdaki token'ları kopyalayıp testlerde kullanın:

```
ADMIN_TOKEN=<yukarıdan_kopyala>
CORPORATE_TOKEN=<yukarıdan_kopyala>
REGULATOR_TOKEN=<yukarıdan_kopyala>
```

---

## 2. WebSocket Live Feed Testleri

### 2.1 Corporate WebSocket Test

**Test Senaryosu:**
- Corporate token ile `/ws/corporate` bağlantısı → ✅ Başarılı olmalı
- Regulator token ile `/ws/corporate` bağlantısı → ❌ 4401 Unauthorized

**Manuel Test:**

```bash
# Node.js WebSocket test script'i
node -e "
const WebSocket = require('ws');
const token = 'CORPORATE_TOKEN_BURAYA';

const ws = new WebSocket('ws://localhost:8000/ws/corporate?token=' + token);

ws.on('open', () => {
  console.log('✅ Connected to corporate feed');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'connected') {
    console.log('✅ Connection confirmed:', msg.message);
  } else if (msg.type === 'heartbeat') {
    console.log('💓 Heartbeat received');
  } else {
    console.log('📨 Event received:', msg.id);
  }
});

ws.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

ws.on('close', (code, reason) => {
  console.log('🔌 Closed:', code, reason.toString());
});
"
```

**Beklenen Sonuç:**
- ✅ Connection successful
- ✅ "Connected to corporate feed" mesajı
- ✅ Heartbeat mesajları alınmalı

### 2.2 Regulator WebSocket Test

**Test Senaryosu:**
- Regulator token ile `/ws/regulator` bağlantısı → ✅ Başarılı
- Corporate token ile `/ws/regulator` bağlantısı → ❌ 4401 Unauthorized

**Manuel Test:**

```bash
node -e "
const WebSocket = require('ws');
const token = 'REGULATOR_TOKEN_BURAYA';

const ws = new WebSocket('ws://localhost:8000/ws/regulator?token=' + token);

ws.on('open', () => {
  console.log('✅ Connected to regulator feed');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'connected') {
    console.log('✅ Connection confirmed');
  } else if (msg.type !== 'heartbeat') {
    console.log('📨 Regulator event:', msg.risk_level, msg.policy_violations);
  }
});

ws.on('close', (code, reason) => {
  console.log('🔌 Closed:', code, reason.toString());
});
"
```

### 2.3 Live WebSocket Test (Admin Only)

**Test Senaryosu:**
- Admin token ile `/ws/live` bağlantısı → ✅ Başarılı
- Corporate token ile `/ws/live` bağlantısı → ❌ 4401 Unauthorized

**Manuel Test:**

```bash
node -e "
const WebSocket = require('ws');
const token = 'ADMIN_TOKEN_BURAYA';

const ws = new WebSocket('ws://localhost:8000/ws/live?token=' + token);

ws.on('open', () => {
  console.log('✅ Connected to live feed');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'connected') {
    console.log('✅ Connection confirmed');
  }
});

ws.on('close', (code, reason) => {
  if (code === 4401) {
    console.log('❌ Unauthorized (expected for non-admin)');
  }
});
"
```

---

## 3. Regulator Feed Filtre Testi

### 3.1 Low-Risk Event Test

**Test Senaryosu:**
- Low-risk event oluştur → Regulator feed'de görünmemeli

**Manuel Test:**

```bash
# 1. Low-risk event oluştur (backend'de)
curl -X POST http://localhost:8000/api/standalone \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, how are you?"}'

# 2. Regulator feed'i kontrol et
curl -X GET "http://localhost:8000/api/monitor/regulator-feed?limit=100" \
  -H "Authorization: Bearer REGULATOR_TOKEN_BURAYA"

# Beklenen: Low-risk event feed'de görünmemeli
```

### 3.2 High-Risk Event Test

**Test Senaryosu:**
- High-risk event oluştur → Regulator feed'de görünmeli

**Manuel Test:**

```bash
# 1. High-risk event oluştur (backend'de)
# (Harmful content ile standalone/proxy endpoint'ini çağır)

# 2. Regulator feed'i kontrol et
curl -X GET "http://localhost:8000/api/monitor/regulator-feed?limit=100" \
  -H "Authorization: Bearer REGULATOR_TOKEN_BURAYA"

# Beklenen: High-risk event feed'de görünmeli
```

---

## 4. Role-Based Access Testleri

### 4.1 Standalone Public Endpoint

**Test Senaryosu:**
- Auth olmadan `/api/standalone` → ✅ 200 OK
- Auth olmadan `/api/proxy` → ❌ 401 Unauthorized

**Manuel Test:**

```bash
# ✅ Standalone (public)
curl -X POST http://localhost:8000/api/standalone \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello"}'

# Beklenen: 200 OK

# ❌ Proxy (auth required)
curl -X POST http://localhost:8000/api/proxy \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'

# Beklenen: 401 Unauthorized
```

### 4.2 Corporate Token ile Admin Endpoint

**Test Senaryosu:**
- Corporate token ile `/api/proxy` → ❌ 403 Forbidden

**Manuel Test:**

```bash
curl -X POST http://localhost:8000/api/proxy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer CORPORATE_TOKEN_BURAYA" \
  -d '{"message": "Hello"}'

# Beklenen: 403 Forbidden
```

### 4.3 Admin Token ile Tüm Endpoint'ler

**Test Senaryosu:**
- Admin token ile tüm endpoint'lere erişim → ✅ Başarılı

**Manuel Test:**

```bash
# Proxy
curl -X POST http://localhost:8000/api/proxy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN_BURAYA" \
  -d '{"message": "Hello"}'
# Beklenen: 200 OK veya 429 (rate limit)

# Corporate Feed
curl -X GET "http://localhost:8000/api/monitor/corporate-feed?limit=50" \
  -H "Authorization: Bearer ADMIN_TOKEN_BURAYA"
# Beklenen: 200 OK

# Regulator Feed
curl -X GET "http://localhost:8000/api/monitor/regulator-feed?limit=100" \
  -H "Authorization: Bearer ADMIN_TOKEN_BURAYA"
# Beklenen: 200 OK
```

---

## 5. Rate Limit Testleri

### 5.1 Standalone Rate Limit (40 req/60s)

**Test Senaryosu:**
- 40 request → ✅ OK
- 41. request → ❌ 429 Rate Limit

**Manuel Test:**

```bash
# 40 request gönder
for i in {1..40}; do
  curl -X POST http://localhost:8000/api/standalone \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"Test $i\"}"
  echo "Request $i"
done

# 41. request
curl -X POST http://localhost:8000/api/standalone \
  -H "Content-Type: application/json" \
  -d '{"text": "Test 41"}'

# Beklenen: 429 Too Many Requests
# Response: {"ok": false, "error": "rate_limit", "message": "Rate limit exceeded: 40 requests per 60 seconds"}
```

### 5.2 Proxy Rate Limit (15 req/60s)

**Test Senaryosu:**
- 15 request → ✅ OK
- 16. request → ❌ 429 Rate Limit

**Manuel Test:**

```bash
# 15 request gönder
for i in {1..15}; do
  curl -X POST http://localhost:8000/api/proxy \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ADMIN_TOKEN_BURAYA" \
    -d "{\"message\": \"Test $i\"}"
  echo "Request $i"
done

# 16. request
curl -X POST http://localhost:8000/api/proxy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN_BURAYA" \
  -d '{"message": "Test 16"}'

# Beklenen: 429 Too Many Requests
```

---

## 6. CORS Domain Whitelist Testi

### 6.1 Whitelisted Origin Test

**Test Senaryosu:**
- Origin: `standalone.ezacore.ai` → ✅ Allowed
- Origin: `corporate.ezacore.ai` → ✅ Allowed
- Origin: `localhost:3000` → ✅ Allowed

**Manuel Test:**

```bash
# Whitelisted origin
curl -X OPTIONS http://localhost:8000/api/standalone \
  -H "Origin: https://standalone.ezacore.ai" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Beklenen: 
# Access-Control-Allow-Origin: https://standalone.ezacore.ai
# Status: 200 OK
```

### 6.2 Blocked Origin Test

**Test Senaryosu:**
- Origin: `attacker.com` → ❌ Blocked

**Manuel Test:**

```bash
# Blocked origin
curl -X OPTIONS http://localhost:8000/api/standalone \
  -H "Origin: https://attacker.com" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Beklenen: 
# Access-Control-Allow-Origin header yok veya farklı
# Status: 200 OK (ama CORS blocked)
```

---

## 7. Frontend Protected Route Testleri

### 7.1 Login Sayfası Testi

**Test Senaryosu:**
1. `/login` sayfasına git
2. JWT token yapıştır
3. Role seç (admin, corporate, regulator)
4. Login'e tıkla
5. Role'e göre yönlendiril

**Manuel Test:**

1. Browser'da `http://localhost:3000/login` aç
2. Token'ı yapıştır
3. Role seç
4. Login'e tıkla
5. Beklenen: Role'e göre yönlendirme
   - Admin → `/proxy` veya `/corporate`
   - Corporate → `/corporate`
   - Regulator → `/regulator`

### 7.2 Standalone Public Access

**Test Senaryosu:**
- `/standalone` sayfası → Auth olmadan erişilebilmeli

**Manuel Test:**

1. Browser'da `http://localhost:3000/standalone` aç
2. Auth olmadan erişilebilmeli
3. Login'e redirect olmamalı

### 7.3 Protected Routes

**Test Senaryosu:**
- `/proxy` → Auth yoksa `/login`'e redirect
- `/corporate` → Auth yoksa `/login`'e redirect
- `/regulator` → Auth yoksa `/login`'e redirect

**Manuel Test:**

1. Browser'da auth olmadan `/proxy` aç
2. Beklenen: `/login`'e redirect

2. Browser'da auth olmadan `/corporate` aç
3. Beklenen: `/login`'e redirect

4. Browser'da auth olmadan `/regulator` aç
5. Beklenen: `/login`'e redirect

### 7.4 Role-Based Access Denial

**Test Senaryosu:**
- Corporate token ile `/proxy` → Access Denied
- Regulator token ile `/corporate` → Access Denied

**Manuel Test:**

1. Corporate token ile login yap
2. `/proxy` sayfasına git
3. Beklenen: "Access Denied" mesajı

4. Regulator token ile login yap
5. `/corporate` sayfasına git
6. Beklenen: "Access Denied" mesajı

---

## 8. JWT → WebSocket → API Akış Testi

### 8.1 Tam Akış Testi

**Test Senaryosu:**
1. JWT token oluştur (corporate)
2. WebSocket'e bağlan (`/ws/corporate?token=...`)
3. Aynı token ile API çağrısı yap (`/api/monitor/corporate-feed`)
4. WebSocket üzerinden event al

**Manuel Test:**

```bash
# 1. Corporate token oluştur (backend'de)
# 2. WebSocket bağlantısı (yukarıdaki WebSocket test script'i)
# 3. API çağrısı
curl -X GET "http://localhost:8000/api/monitor/corporate-feed?limit=50" \
  -H "Authorization: Bearer CORPORATE_TOKEN_BURAYA"

# 4. Backend'de yeni event oluştur (standalone/proxy endpoint'ini çağır)
# 5. WebSocket üzerinden event'in geldiğini kontrol et
```

---

## Role-Based Access Matrix

| Endpoint | Public | Corporate | Regulator | Admin |
|----------|--------|-----------|-----------|-------|
| `/api/standalone` | ✅ | ✅ | ✅ | ✅ |
| `/api/proxy` | ❌ | ❌ | ❌ | ✅ |
| `/api/proxy-lite` | ❌ | ✅ | ❌ | ✅ |
| `/api/monitor/live-feed` | ❌ | ❌ | ❌ | ✅ |
| `/api/monitor/corporate-feed` | ❌ | ✅ | ❌ | ✅ |
| `/api/monitor/regulator-feed` | ❌ | ❌ | ✅ | ✅ |
| `/ws/live` | ❌ | ❌ | ❌ | ✅ |
| `/ws/corporate` | ❌ | ✅ | ❌ | ✅ |
| `/ws/regulator` | ❌ | ❌ | ✅ | ✅ |

---

## Test Sonuç Raporu

### Otomatik Testler

```bash
# Backend tests
cd eza-v5/backend
pytest tests_validation/test_predeployment.py -v

# Frontend tests (eğer vitest kuruluysa)
cd eza-v5/frontend
npm test tests/predeployment/ui-access.test.ts
```

### Test Sonuçları

| Test Kategorisi | Durum | Notlar |
|----------------|-------|--------|
| WebSocket Corporate Feed | ⬜ | |
| WebSocket Regulator Feed | ⬜ | |
| WebSocket Live Feed | ⬜ | |
| Regulator Feed Filters | ⬜ | |
| Role-Based Access | ⬜ | |
| Standalone Public | ⬜ | |
| Rate Limiting | ⬜ | |
| CORS Whitelist | ⬜ | |
| Frontend Protected Routes | ⬜ | |
| JWT → WS → API Flow | ⬜ | |

### Coverage

- [ ] Backend API endpoints: ___%
- [ ] WebSocket endpoints: ___%
- [ ] Frontend routes: ___%
- [ ] Security features: ___%

---

## Aşama 7 Hazırlık Durumu

### ✅ Hazır Kriterleri

- [ ] Tüm WebSocket endpoint'leri doğru çalışıyor
- [ ] Role-based access kontrolü çalışıyor
- [ ] Rate limiting aktif ve çalışıyor
- [ ] CORS whitelist doğru yapılandırılmış
- [ ] Frontend protected routes çalışıyor
- [ ] Standalone public endpoint çalışıyor
- [ ] Regulator feed filtreleri çalışıyor
- [ ] JWT → WS → API akışı çalışıyor

### ⚠️ Dikkat Edilmesi Gerekenler

- [ ] Redis bağlantısı kontrol edildi (rate limiting için)
- [ ] Environment variables doğru ayarlandı
- [ ] CORS whitelist production domain'leri içeriyor
- [ ] JWT secret production'da güvenli

---

## Sonuç

**Aşama 7 için Hazır mı?** ⬜ Evet / ⬜ Hayır

**Notlar:**
```
[Buraya test sonuçları ve notlar yazılacak]
```

---

**Test Tarihi:** _______________  
**Test Edilen:** _______________  
**Onaylayan:** _______________

