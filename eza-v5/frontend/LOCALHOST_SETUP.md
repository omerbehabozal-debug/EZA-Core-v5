# Localhost Frontend Setup - Test Results API

## ✅ Yapılan Değişiklikler

### 1. Environment Variable Eklendi
**Dosya:** `eza-v5/frontend/.env.local`

```env
NEXT_PUBLIC_SNAPSHOT_KEY=zveZEyjiW2aqBdlKpdeJbWnmaKv
```

### 2. API Endpoint Güncellendi
**Dosya:** `eza-v5/frontend/app/docs/test-suite/page.tsx`

- ✅ Eski endpoint: `/api/test-results/comprehensive`
- ✅ Yeni endpoint: `/api/public/test-safety-benchmarks?period=daily`
- ✅ `x-eza-publish-key` header eklendi
- ✅ Error handling iyileştirildi (403, 404)

## 🚀 Kullanım

### 1. Frontend'i Yeniden Başlatın

Next.js environment variable'ları sadece başlangıçta yüklenir:

```bash
cd eza-v5/frontend
npm run dev
```

### 2. Test Edin

1. Browser'da `http://localhost:3000/docs/test-suite` sayfasını açın
2. API çağrısı yapılacak ve test sonuçları gösterilecek

## 🔧 Sorun Giderme

### "NEXT_PUBLIC_SNAPSHOT_KEY is not configured"
**Çözüm:** `.env.local` dosyasının `eza-v5/frontend/` klasöründe olduğundan emin olun ve frontend'i yeniden başlatın.

### "Access denied. Check NEXT_PUBLIC_SNAPSHOT_KEY configuration."
**Çözüm:** 
- Key'in doğru olduğundan emin olun: `zveZEyjiW2aqBdlKpdeJbWnmaKv`
- Backend'de de aynı key set edilmiş olmalı
- Frontend'i yeniden başlatın

### "No snapshot available. Please publish a snapshot first."
**Çözüm:** İlk snapshot'ı publish edin:

```bash
curl -X POST "https://api.ezacore.ai/api/public/publish?period=daily" \
  -H "x-eza-publish-key: zveZEyjiW2aqBdlKpdeJbWnmaKv"
```

## 📋 Checklist

- [x] `.env.local` dosyası oluşturuldu
- [x] `NEXT_PUBLIC_SNAPSHOT_KEY` set edildi
- [x] API endpoint güncellendi
- [x] Header eklendi
- [ ] Frontend yeniden başlatıldı
- [ ] İlk snapshot publish edildi
- [ ] Test edildi (200 OK)

## 🎯 Key Bilgileri

- **Key:** `zveZEyjiW2aqBdlKpdeJbWnmaKv`
- **Length:** 27 characters
- **Backend:** Railway'de `PUBLIC_SNAPSHOT_KEY` olarak set edilmeli
- **Frontend:** Localhost'ta `.env.local` dosyasında `NEXT_PUBLIC_SNAPSHOT_KEY` olarak set edildi

