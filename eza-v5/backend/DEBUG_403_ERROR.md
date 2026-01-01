# 403 Error Debug Guide

## 🔍 Sorun Giderme Adımları

### 1. Frontend Key Kontrolü

eza.global projesinde `.env.local` dosyasını kontrol edin:

```env
NEXT_PUBLIC_SNAPSHOT_KEY=zveZEyjiW2aqBdlKpdeJbWnmaKv
```

**Önemli:** Key'in sonunda boşluk veya yeni satır olmamalı!

### 2. Frontend'i Yeniden Başlatın

Next.js environment variable'ları sadece başlangıçta yüklenir:

```bash
# eza.global projesinde
npm run dev
# veya
yarn dev
```

**Kritik:** `.env.local` dosyasını oluşturduktan sonra mutlaka yeniden başlatın!

### 3. Backend Key Kontrolü

Railway'de `PUBLIC_SNAPSHOT_KEY` değerini kontrol edin:
- Railway Dashboard → Variables → `PUBLIC_SNAPSHOT_KEY`
- Değer: `zveZEyjiW2aqBdlKpdeJbWnmaKv` olmalı

### 4. Key'lerin Aynı Olduğunu Doğrulayın

**Backend (Railway):**
```
PUBLIC_SNAPSHOT_KEY=zveZEyjiW2aqBdlKpdeJbWnmaKv
```

**Frontend (eza.global/.env.local):**
```
NEXT_PUBLIC_SNAPSHOT_KEY=zveZEyjiW2aqBdlKpdeJbWnmaKv
```

**İkisi de aynı key olmalı!**

### 5. Browser Console'da Kontrol Edin

Browser DevTools → Console'da:

```javascript
console.log(process.env.NEXT_PUBLIC_SNAPSHOT_KEY);
```

Eğer `undefined` görüyorsanız:
- Frontend'i yeniden başlatın
- `.env.local` dosyasının doğru yerde olduğundan emin olun

### 6. Network Tab'de Header'ı Kontrol Edin

Browser DevTools → Network → Request Headers:
- `x-eza-publish-key` header'ı var mı?
- Value doğru mu? (`zveZEyjiW2aqBdlKpdeJbWnmaKv`)

### 7. İlk Snapshot'ı Publish Edin

Eğer 404 hatası alıyorsanız, ilk snapshot'ı publish edin:

```bash
curl -X POST "https://api.ezacore.ai/api/public/publish?period=daily" \
  -H "x-eza-publish-key: zveZEyjiW2aqBdlKpdeJbWnmaKv"
```

## 🚨 Yaygın Hatalar

### Hata 1: "NEXT_PUBLIC_SNAPSHOT_KEY is not configured"
**Çözüm:** `.env.local` dosyasını oluşturun ve frontend'i yeniden başlatın.

### Hata 2: "Access denied. Check NEXT_PUBLIC_SNAPSHOT_KEY configuration."
**Çözüm:** 
- Key'lerin aynı olduğundan emin olun
- Frontend'i yeniden başlatın
- Railway'de backend key'in doğru olduğunu kontrol edin

### Hata 3: "No snapshot available"
**Çözüm:** İlk snapshot'ı publish edin (yukarıdaki curl komutu).

## ✅ Checklist

- [ ] `.env.local` dosyası oluşturuldu
- [ ] `NEXT_PUBLIC_SNAPSHOT_KEY` doğru key ile set edildi
- [ ] Frontend yeniden başlatıldı
- [ ] Railway'de `PUBLIC_SNAPSHOT_KEY` set edildi
- [ ] Key'ler aynı (backend ve frontend)
- [ ] İlk snapshot publish edildi
- [ ] Browser console'da key görünüyor
- [ ] Network tab'de header gönderiliyor

