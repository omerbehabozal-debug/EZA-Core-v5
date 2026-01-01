# PUBLIC_SNAPSHOT_KEY - Kullanım Kılavuzu

## 🔑 PUBLIC_SNAPSHOT_KEY Nedir?

`PUBLIC_SNAPSHOT_KEY`, test sonuçları snapshot'larını yayınlamak ve okumak için kullanılan güvenlik anahtarıdır.

**Amaç:**
- Snapshot yayınlama işlemini korumak
- Snapshot okuma işlemini korumak
- Yetkisiz erişimi engellemek
- Dışarıdan tarayıcı/curl/postman erişimini engellemek

## 🔐 Key Nasıl Oluşturulur?

### Yöntem 1: Python Script ile (Önerilen)

```bash
cd eza-v5/backend
python scripts/generate_snapshot_key.py
```

Bu script güvenli bir random key üretir.

### Yöntem 2: Manuel Oluşturma

Güvenli bir key oluşturmak için:

```bash
# Linux/Mac
openssl rand -base64 32

# Python
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Online (güvenli değil, sadece test için)
# https://randomkeygen.com/
```

### Yöntem 3: Basit Key (Sadece Test İçin)

Test amaçlı basit bir key:
```
test-snapshot-key-2024
```

**⚠️ Production'da mutlaka güçlü bir key kullanın!**

## 📝 Key Nasıl Ayarlanır?

### 1. Environment Variable Olarak

#### Linux/Mac
```bash
export PUBLIC_SNAPSHOT_KEY="your-generated-key-here"
```

#### Windows (PowerShell)
```powershell
$env:PUBLIC_SNAPSHOT_KEY="your-generated-key-here"
```

#### Windows (CMD)
```cmd
set PUBLIC_SNAPSHOT_KEY=your-generated-key-here
```

### 2. .env Dosyasına Ekleme

`eza-v5/backend/.env` dosyasına ekleyin:

```env
PUBLIC_SNAPSHOT_KEY=your-generated-key-here
```

### 3. Railway/Production Ortamında

Railway Dashboard'da:
1. Project → Variables
2. Add Variable
3. Key: `PUBLIC_SNAPSHOT_KEY`
4. Value: `your-generated-key-here`
5. Save

### 4. Vercel/Frontend Ortamında

Vercel Dashboard'da (eza.global için):
1. Project → Settings → Environment Variables
2. Add Variable
3. Key: `NEXT_PUBLIC_SNAPSHOT_KEY` (frontend için)
4. Value: `your-generated-key-here` (backend ile aynı)
5. Save

## 🔍 Key'i Nerede Kullanırım?

### Backend (Publish)
```bash
# Cron job script
export PUBLIC_SNAPSHOT_KEY="your-key"
python backend/scripts/publish_test_snapshot_cron.py
```

### Backend (API Endpoint)
Key otomatik olarak `config.py`'den okunur:
```python
from backend.config import get_settings
settings = get_settings()
key = settings.PUBLIC_SNAPSHOT_KEY
```

### Frontend (eza.global)
```typescript
// .env.local veya Vercel environment variables
NEXT_PUBLIC_SNAPSHOT_KEY=your-key

// API call
const response = await fetch(
  'https://api.ezacore.ai/api/public/test-safety-benchmarks?period=daily',
  {
    headers: {
      'x-eza-publish-key': process.env.NEXT_PUBLIC_SNAPSHOT_KEY
    }
  }
);
```

## ✅ Key Doğrulama

Key'in doğru ayarlandığını kontrol etmek için:

```bash
# Backend'de
python -c "from backend.config import get_settings; s = get_settings(); print('Key set:', bool(s.PUBLIC_SNAPSHOT_KEY))"

# API test
curl -X POST "http://localhost:8000/api/public/publish?period=daily" \
  -H "x-eza-publish-key: your-key"
```

## 🔒 Güvenlik Notları

1. **Key'i asla commit etmeyin:**
   - `.env` dosyasını `.gitignore`'a ekleyin
   - Key'i GitHub'a pushlamayın

2. **Her ortam için farklı key:**
   - Development: `dev-snapshot-key-2024`
   - Staging: `staging-snapshot-key-2024`
   - Production: Güçlü random key

3. **Key'i düzenli değiştirin:**
   - Aylık veya gerektiğinde
   - Değiştirdiğinizde tüm ortamlarda güncelleyin

4. **Key uzunluğu:**
   - Minimum: 16 karakter
   - Önerilen: 32+ karakter
   - Güvenli: 64+ karakter

## 📋 Checklist

- [ ] Key oluşturuldu
- [ ] Backend `.env` dosyasına eklendi
- [ ] Railway/Production environment variable olarak ayarlandı
- [ ] Frontend (Vercel) environment variable olarak ayarlandı
- [ ] Cron job script key'i kullanıyor
- [ ] Frontend API call'larında key gönderiliyor
- [ ] Key test edildi (publish ve read)

## 🚨 Sorun Giderme

### "PUBLIC_SNAPSHOT_KEY not configured"
**Çözüm:** Environment variable'ı ayarlayın

### "Missing x-eza-publish-key header"
**Çözüm:** API call'da header ekleyin

### "Invalid x-eza-publish-key"
**Çözüm:** Key'in doğru olduğundan emin olun (backend ve frontend aynı key kullanmalı)

## 📝 Örnek Key Formatı

```
# Güvenli key örneği (32 karakter)
ezak_snapshot_2024_secure_key_abc123

# Daha güvenli (64 karakter)
ezak_snapshot_2024_very_secure_random_key_abcdefghijklmnopqrstuvwxyz123456
```

## 🎯 Hızlı Başlangıç

1. **Key oluştur:**
   ```bash
   python scripts/generate_snapshot_key.py
   ```

2. **Backend .env'e ekle:**
   ```env
   PUBLIC_SNAPSHOT_KEY=generated-key-here
   ```

3. **Railway'a ekle:**
   - Dashboard → Variables → Add
   - Key: `PUBLIC_SNAPSHOT_KEY`
   - Value: `generated-key-here`

4. **Vercel'e ekle (frontend):**
   - Dashboard → Settings → Environment Variables
   - Key: `NEXT_PUBLIC_SNAPSHOT_KEY`
   - Value: `generated-key-here` (backend ile aynı)

5. **Test et:**
   ```bash
   curl -X POST "https://api.ezacore.ai/api/public/publish?period=daily" \
     -H "x-eza-publish-key: generated-key-here"
   ```

