# Hızlı Kontrol - Test Regulator User

## 1. Database Bağlantısı Kontrolü

`.env` dosyasında `DATABASE_URL` olmalı:
```env
DATABASE_URL=postgresql://user:password@host:port/database
```

## 2. Kullanıcı Oluşturma

```powershell
cd eza-v5\backend
python scripts\create_test_regulator_user.py
```

**ÖNEMLİ:** Script çıktısında gösterilen şifreyi kaydedin!

## 3. Kullanıcı Doğrulama

```powershell
cd eza-v5\backend
python scripts\validate_test_regulator_user.py
```

## 4. Login Test

1. `https://regulator.ezacore.ai/login` adresine gidin
2. Email: `regulator-test@ezacore.ai`
3. Password: Script'ten aldığınız şifre

## 5. Sorun Giderme

### "Geçersiz kimlik bilgileri" Hatası

**Kontrol 1:** Kullanıcı var mı?
```powershell
python scripts\validate_test_regulator_user.py
```

**Kontrol 2:** Backend loglarını kontrol edin:
- `[Login] Step 1: Attempting login...`
- `[Login] Step 3: User found...`
- `[Auth] Password verification result: ...`

**Kontrol 3:** Şifre doğru mu?
- Script'ten kopyaladığınız şifreyi tekrar kontrol edin
- Özel karakterler (`, `, `'`, vb.) doğru kopyalandı mı?

**Kontrol 4:** Backend çalışıyor mu?
- Backend container/logs'u kontrol edin
- `/api/production/auth/login` endpoint'i erişilebilir mi?

## 6. Manuel Şifre Sıfırlama (Gerekirse)

Eğer şifreyi unuttuysanız, script'i tekrar çalıştırın:
```powershell
python scripts\create_test_regulator_user.py
```

Script mevcut kullanıcıyı bulursa, yeni bir şifre oluşturur ve gösterir.

