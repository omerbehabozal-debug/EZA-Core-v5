# Production'da Snapshot Publish Etme

## 🔍 Sorun

Production'da (Railway) snapshot henüz publish edilmemiş. Localhost'ta publish edildi ama production'da yok.

## ✅ Çözüm

### Yöntem 1: API Endpoint ile (Önerilen)

Production'da snapshot'ı publish etmek için:

```bash
curl -X POST "https://api.ezacore.ai/api/public/publish?period=daily" \
  -H "x-eza-publish-key: zveZEyjiW2aqBdlKpdeJbWnmaKv"
```

**PowerShell'de:**
```powershell
$headers = @{
    "x-eza-publish-key" = "zveZEyjiW2aqBdlKpdeJbWnmaKv"
}
Invoke-WebRequest -Uri "https://api.ezacore.ai/api/public/publish?period=daily" -Method POST -Headers $headers
```

### Yöntem 2: Railway Console'dan

Railway Dashboard → Deployments → Latest Deployment → View Logs → Run Script

```bash
python backend/scripts/publish_initial_snapshot.py
```

### Yöntem 3: Railway CLI ile

```bash
railway run python backend/scripts/publish_initial_snapshot.py
```

## 📋 Adımlar

1. **Railway'de Key Kontrolü:**
   - Railway Dashboard → Variables
   - `PUBLIC_SNAPSHOT_KEY=zveZEyjiW2aqBdlKpdeJbWnmaKv` var mı?

2. **Backend Deploy Kontrolü:**
   - Railway Dashboard → Deployments
   - Son deploy başarılı mı?

3. **Snapshot Publish:**
   - Yukarıdaki curl komutunu çalıştırın

4. **Test:**
   ```bash
   curl "https://api.ezacore.ai/api/public/test-safety-benchmarks?period=daily"
   ```

## ✅ Beklenen Sonuç

Publish başarılı olursa:
```json
{
  "status": "published",
  "snapshot_id": "...",
  "period": "daily",
  "generated_at": "...",
  "test_suites_count": 8,
  "latest_runs_count": 3
}
```

Sonra GET endpoint'i 200 OK döner.

## 🔄 Günlük Otomatik Publish

Railway'de cron job ayarlayın:
- **Schedule:** Daily at 00:00 UTC
- **Command:** `python backend/scripts/publish_test_snapshot_cron.py`

Veya GitHub Actions workflow oluşturun.

