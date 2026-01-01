# 403 Forbidden Fix Guide

## 🔍 Sorun Analizi

403 hatası alınıyor çünkü:
1. **OrganizationGuardMiddleware** `/api/public` path'ini engelliyordu
2. Header case sensitivity sorunu olabilir

## ✅ Yapılan Düzeltmeler

### 1. OrganizationGuardMiddleware Exclusion
**Dosya:** `eza-v5/backend/middleware/organization_guard.py`

`/api/public` path'i `EXCLUDED_PATHS` listesine eklendi:

```python
EXCLUDED_PATHS = [
    ...
    "/api/public",  # Public test results endpoints (key-protected, no org required)
    "/api/test-results",  # Test results endpoints (public, no org required)
    ...
]
```

### 2. Header Case Sensitivity Fix
**Dosya:** `eza-v5/backend/routers/public_test_results.py`

Header kontrolü daha esnek hale getirildi:
- Multiple header name variations destekleniyor
- Case-insensitive header search
- Debug logging eklendi

## 🔧 Test Etme

### 1. Backend'de Key Kontrolü

```bash
# Backend'de key'in set edildiğini kontrol et
python -c "from backend.config import get_settings; s = get_settings(); print('Key exists:', bool(s.PUBLIC_SNAPSHOT_KEY)); print('Key length:', len(s.PUBLIC_SNAPSHOT_KEY) if s.PUBLIC_SNAPSHOT_KEY else 0)"
```

### 2. API Test (curl)

```bash
# Key ile test et
curl -X GET "https://api.ezacore.ai/api/public/test-safety-benchmarks?period=daily" \
  -H "x-eza-publish-key: YOUR_KEY_HERE" \
  -v
```

### 3. Frontend Test

Frontend'de header'ın doğru gönderildiğini kontrol et:

```typescript
const response = await fetch(
  'https://api.ezacore.ai/api/public/test-safety-benchmarks?period=daily',
  {
    headers: {
      'x-eza-publish-key': process.env.NEXT_PUBLIC_SNAPSHOT_KEY
    }
  }
);
```

## 📋 Checklist

- [ ] Backend'de `PUBLIC_SNAPSHOT_KEY` set edilmiş
- [ ] Railway'de environment variable doğru
- [ ] Frontend'de `NEXT_PUBLIC_SNAPSHOT_KEY` set edilmiş
- [ ] Vercel'de environment variable doğru
- [ ] Header `x-eza-publish-key` olarak gönderiliyor
- [ ] Key'ler backend ve frontend'de aynı
- [ ] `/api/public` path'i middleware'den exclude edilmiş

## 🚨 Hala 403 Alıyorsanız

1. **Backend loglarını kontrol et:**
   - "Missing x-eza-publish-key header" → Header gönderilmiyor
   - "Invalid x-eza-publish-key" → Key yanlış
   - "PUBLIC_SNAPSHOT_KEY not configured" → Backend'de key set edilmemiş

2. **Key'leri karşılaştır:**
   ```bash
   # Backend key
   echo $PUBLIC_SNAPSHOT_KEY
   
   # Frontend key (Vercel dashboard'dan kontrol et)
   # NEXT_PUBLIC_SNAPSHOT_KEY
   ```

3. **Header'ı kontrol et:**
   - Browser DevTools → Network → Request Headers
   - `x-eza-publish-key` header'ının gönderildiğini doğrula

## ✅ Başarı Kriterleri

- ✅ 200 OK response
- ✅ JSON data dönüyor
- ✅ Cache headers mevcut
- ✅ 403 hatası yok

