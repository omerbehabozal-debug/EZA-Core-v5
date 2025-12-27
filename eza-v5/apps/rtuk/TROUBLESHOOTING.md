# RTÜK Panel Troubleshooting Guide

## Site Açılmıyor - Hızlı Kontrol Listesi

### 1. Vercel Deployments Kontrolü

**Vercel Dashboard → Proje → Deployments**

- [ ] Son deploy'un durumu "Ready" mi?
- [ ] Build başarılı mı? (yeşil tik)
- [ ] Hata var mı? (kırmızı X) → Logları kontrol et

### 2. Environment Variables Kontrolü

**Vercel Dashboard → Proje → Settings → Environment Variables**

**MUTLAKA AYARLANMALI:**
```
NEXT_PUBLIC_API_URL=https://eza-core-v5-production.up.railway.app
```

**Kontrol:**
- [ ] `NEXT_PUBLIC_API_URL` tanımlı mı?
- [ ] Production, Preview, Development için ayarlı mı?
- [ ] Değer doğru mu? (HTTPS kullanılmalı)

**ÖNEMLİ:** Environment variable değişikliğinden sonra **yeni bir deploy** gerekir!

### 3. Browser Console Kontrolü

**Chrome DevTools → Console sekmesi**

Hangi hatalar görünüyor?
- `Failed to fetch` → API URL yanlış veya CORS sorunu
- `Cannot read property` → JavaScript runtime hatası
- `404 Not Found` → Route sorunu

### 4. Network Tab Kontrolü

**Chrome DevTools → Network sekmesi**

- [ ] Sayfa yükleniyor mu? (200 OK)
- [ ] API çağrıları yapılıyor mu?
- [ ] CORS hatası var mı? (CORS policy error)

### 5. SSL/HTTPS Kontrolü

- [ ] **HTTPS** kullanılıyor mu? (`https://eza-regulator-rtuk.vercel.app`)
- [ ] HTTP kullanılmamalı (`http://...`)
- [ ] SSL sertifikası geçerli mi? (tarayıcıda kilit ikonu)

## Yaygın Sorunlar ve Çözümleri

### Sorun 1: "Bu site güvenli bağlantı sağlayamıyor" (ERR_SSL_PROTOCOL_ERROR)

**Çözüm:**
1. **HTTPS kullanın:** `https://eza-regulator-rtuk.vercel.app`
2. **2-5 dakika bekleyin:** İlk deploy'da SSL sertifikası oluşturulması zaman alır
3. **Vercel Dashboard → Settings → Domains:** SSL durumunu kontrol edin

### Sorun 2: Sayfa açılıyor ama boş/beyaz görünüyor

**Olası Nedenler:**
- JavaScript hatası (Console'da kontrol edin)
- Environment variable eksik (`NEXT_PUBLIC_API_URL`)
- Build hatası

**Çözüm:**
1. Browser Console'u açın (F12)
2. Hataları kontrol edin
3. Environment variables'ı kontrol edin
4. Yeni bir deploy yapın

### Sorun 3: "Failed to fetch" veya CORS hatası

**Olası Nedenler:**
- `NEXT_PUBLIC_API_URL` yanlış veya eksik
- Backend CORS ayarları eksik

**Çözüm:**
1. `NEXT_PUBLIC_API_URL` environment variable'ını kontrol edin
2. Backend'de CORS ayarlarını kontrol edin (`.vercel.app` domain'leri izinli olmalı)
3. Backend'in çalıştığından emin olun

### Sorun 4: Login sayfası açılıyor ama giriş yapamıyorum

**Olası Nedenler:**
- Backend API'ye ulaşılamıyor
- Kullanıcı rolü yanlış
- Token kaydedilemiyor

**Çözüm:**
1. Browser Console → Network tab → Login isteğini kontrol edin
2. Backend loglarını kontrol edin
3. Kullanıcı rolünü kontrol edin (`REGULATOR_RTUK` veya `REGULATOR_MEDIA_AUDITOR`)

## Debug Adımları

### Adım 1: Environment Variable Kontrolü

Vercel Dashboard'da:
1. Proje → Settings → Environment Variables
2. `NEXT_PUBLIC_API_URL` var mı?
3. Değeri: `https://eza-core-v5-production.up.railway.app` (veya backend URL'iniz)
4. **Production, Preview, Development** için ayarlı mı?

### Adım 2: Yeni Deploy Yapın

Environment variable değişikliğinden sonra:
1. Vercel Dashboard → Deployments
2. "Redeploy" butonuna tıklayın
3. Deploy'un tamamlanmasını bekleyin (2-3 dakika)

### Adım 3: Browser Console Kontrolü

1. Siteyi açın
2. F12 → Console sekmesi
3. Hataları not edin
4. Network sekmesinde istekleri kontrol edin

### Adım 4: Backend Kontrolü

Backend'in çalıştığından emin olun:
- Railway Dashboard'da servis durumu
- Backend loglarını kontrol edin
- API endpoint'lerini test edin: `https://eza-core-v5-production.up.railway.app/docs`

## Hızlı Test

### Test 1: Login Sayfası Açılıyor mu?

URL: `https://eza-regulator-rtuk.vercel.app/login`

- [ ] Sayfa yükleniyor mu?
- [ ] Login formu görünüyor mu?
- [ ] Console'da hata var mı?

### Test 2: API Bağlantısı Çalışıyor mu?

Browser Console'da:
```javascript
fetch('https://eza-core-v5-production.up.railway.app/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'test', password: 'test' })
}).then(r => console.log('API çalışıyor:', r.status))
```

- [ ] CORS hatası var mı?
- [ ] 401 (Unauthorized) alıyorsanız → Normal (yanlış credentials)
- [ ] Network error → Backend'e ulaşılamıyor

## Destek

Eğer hala sorun varsa:
1. Vercel Dashboard → Deployments → Son deploy'un loglarını kontrol edin
2. Browser Console'daki hataları not edin
3. Network tab'daki başarısız istekleri kontrol edin

