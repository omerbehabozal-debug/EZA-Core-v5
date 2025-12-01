# F12 Console Hatalarını Kontrol Etme Rehberi

## Adımlar

### 1. Browser Console'u Açın
- **F12** tuşuna basın
- Veya sağ tık → "Inspect" / "Öğeyi İncele"
- **Console** sekmesine tıklayın

### 2. Kontrol Edilecek Hatalar

#### A. Kırmızı Hatalar (Errors)
- `Failed to fetch` → Backend bağlantı hatası
- `404 Not Found` → Endpoint bulunamadı
- `CORS policy` → CORS hatası
- `Module not found` → Import hatası
- `Cannot read property` → Null/undefined hatası

#### B. Sarı Uyarılar (Warnings)
- `Streaming failed, using normal endpoint` → Normal, fallback çalışıyor
- `Deprecated API` → Eski API kullanımı

#### C. Network Sekmesi
- **Network** sekmesine gidin
- Mesaj gönderin
- `/api/standalone/stream` isteğini bulun
- Status code'u kontrol edin:
  - **200** → Başarılı
  - **404** → Endpoint bulunamadı
  - **500** → Backend hatası
  - **CORS error** → CORS sorunu

### 3. Beklenen Console Çıktıları

**Normal çalışma:**
```
Streaming failed, using normal endpoint: [hata detayı]
```
Bu normaldir - streaming çalışmazsa normal endpoint kullanılır.

**Hata durumu:**
```
Streaming Error: [hata mesajı]
Backend bağlantı hatası...
```

### 4. Network İsteklerini Kontrol Etme

1. **Network** sekmesine gidin
2. **Filter** kısmına `standalone` yazın
3. Mesaj gönderin
4. İstekleri kontrol edin:
   - `/api/standalone/stream` → Streaming endpoint
   - `/api/standalone` → Normal endpoint (fallback)

### 5. Yaygın Hatalar ve Çözümleri

#### Hata: "Failed to fetch"
**Neden:** Backend çalışmıyor veya yanlış URL
**Çözüm:** 
- Backend'in çalıştığını kontrol edin
- `.env.local` dosyasında `NEXT_PUBLIC_EZA_API_URL` doğru mu?

#### Hata: "404 Not Found" (streaming endpoint)
**Neden:** Streaming endpoint backend'de yok
**Çözüm:** 
- Normal endpoint'e fallback yapılıyor (otomatik)
- Sistem çalışmaya devam eder

#### Hata: "CORS policy"
**Neden:** Backend CORS ayarları yanlış
**Çözüm:**
- Backend'de `allowed_origins` listesine frontend URL'ini ekleyin

