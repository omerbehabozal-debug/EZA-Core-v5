# EZA Governance — Manuel E2E Test Senaryoları

Bu doküman Safe Mode + Universal Event + Governance katmanını **uçtan uca** manuel doğrulamak içindir.  
Kod değiştirmez; yalnızca operasyonel adımlar, `curl` örnekleri, beklenen yanıtlar ve PostgreSQL kontrol sorgularını içerir.

---

## Ön koşullar

### Ortam

| Değişken | Dev test önerisi | Production |
|----------|------------------|------------|
| `ENV` | `dev` | `prod` veya `production` |
| `EZA_EVENT_LOGGING_ENABLED` | Senaryoya göre `true` / `false` | `false` (varsayılan) |
| `BEHAVIORAL_CALIBRATION_ENABLED` | İsteğe bağlı | `false` (varsayılan) |
| `TEST_MODE` | `true` (snapshot testi için) | `false` (runtime zorlar) |
| `DATABASE_URL` | PostgreSQL async URL | Aynı |

### Sunucu

```powershell
cd C:\Users\MONSTER\EZA-Core-v4.0\eza-v5
python backend/run.py
```

Base URL: `http://127.0.0.1:8000`

### Migration

```powershell
cd C:\Users\MONSTER\EZA-Core-v4.0\eza-v5\backend
alembic upgrade head
```

Beklenen tablolar: `behavioral_logs`, `behavioral_baselines`, `behavioral_feedback`, `eza_events`.

### Test değişkenleri (shell)

```bash
export BASE_URL="http://127.0.0.1:8000"
export ADMIN_EMAIL="admin@example.com"
export ADMIN_PASSWORD="your-password"
export USER_EMAIL="user@example.com"
export USER_PASSWORD="your-password"
export ORG_ID="00000000-0000-0000-0000-000000000001"
export USER_ID="00000000-0000-0000-0000-000000000002"
export SESSION_ID="e2e-session-001"
```

### Admin JWT al

```bash
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
```

Yanıttan `access_token`, `user_id` kaydedin:

```bash
export ADMIN_TOKEN="<access_token>"
```

> Admin kullanıcısı `role=admin` olmalı ve `x-org-id` ile gönderilen org’a üye olmalıdır.

### Kullanıcı JWT al (feedback senaryosu)

```bash
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASSWORD\"}"
```

```bash
export USER_TOKEN="<access_token>"
```

`USER_ID` login yanıtındaki `user_id` ile eşleşmeli (feedback sahipliği için).

---

## Senaryo 1 — Standalone event logging

**Amaç:** `EZA_EVENT_LOGGING_ENABLED=true` iken `run_full_pipeline` + `event_context` sonrası `eza_events` satırı oluşur.

> **Not:** HTTP `POST /api/standalone` şu an `event_context` geçirmez. Bu senaryo **Python ile doğrudan pipeline** çağrısı gerektirir (bilinçli tasarım — public endpoint’e kimlik bağlanmaz).

### Adımlar

1. `.env` veya ortam:

   ```env
   EZA_EVENT_LOGGING_ENABLED=true
   ENV=dev
   TEST_MODE=false
   ```

2. Sunucuyu yeniden başlatın.

3. Proje kökünden script:

```powershell
cd C:\Users\MONSTER\EZA-Core-v4.0\eza-v5
$env:EZA_EVENT_LOGGING_ENABLED="true"
$env:USER_ID="00000000-0000-0000-0000-000000000002"
$env:ORG_ID="00000000-0000-0000-0000-000000000001"
$env:SESSION_ID="e2e-session-001"
python -c @"
import asyncio, os
from backend.api.pipeline_runner import run_full_pipeline
from backend.core.utils.dependencies import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as db:
        result = await run_full_pipeline(
            user_input='E2E governance test: what is ethical AI?',
            mode='standalone',
            db_session=db,
            safe_only=False,
            event_context={
                'user_id': os.environ['USER_ID'],
                'org_id': os.environ['ORG_ID'],
                'session_id': os.environ['SESSION_ID'],
            },
        )
        print('pipeline ok=', result.get('ok'))
        print('eza_score=', result.get('eza_score'))

asyncio.run(main())
"@
```

`USER_ID` / `ORG_ID` değerlerini login ve org üyeliği ile eşleşen gerçek UUID’lerle değiştirin.

### Beklenen sonuç

- `pipeline ok= True`
- Pipeline yanıtı değişmez (skorlar / `data` normal döner).
- Hook hata verse bile pipeline tamamlanır.

### DB kontrolü

```sql
SELECT id, source_mode, entity_type, event_type, user_id, org_id, session_id,
       risk_score, confidence_score, reliability_score, case_snapshot, timestamp
FROM eza_events
WHERE org_id = '00000000-0000-0000-0000-000000000001'
  AND session_id = 'e2e-session-001'
ORDER BY timestamp DESC
LIMIT 5;
```

**Beklenen:**

| Alan | Değer |
|------|--------|
| `source_mode` | `standalone` |
| `entity_type` | `user` |
| `event_type` | `message` |
| `user_id` | test USER_ID |
| `org_id` | test ORG_ID |
| `case_snapshot` | `NULL` (TEST_MODE=false) |

`id` değerini kaydedin → Senaryo 3 için `EVENT_ID`.

---

## Senaryo 2 — Admin event görüntüleme + org izolasyonu

**Amaç:** Admin yalnızca kendi org event’lerini görür; cross-org → 403.

### 2a — Liste (kendi org)

```bash
curl -s "$BASE_URL/api/admin/events?days=30&limit=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "x-org-id: $ORG_ID"
```

**Beklenen (200):**

```json
{
  "org_id": "<ORG_ID>",
  "count": 1,
  "events": [
    {
      "id": "<uuid>",
      "source_mode": "standalone",
      "entity_type": "user",
      "event_type": "message",
      "user_id": "...",
      "org_id": "...",
      "risk_label": "low|medium|high",
      "risk_score": 0,
      "confidence_score": 0,
      "reliability_score": null
    }
  ]
}
```

Ham `query`, `message`, `assistant_answer` alanları **olmamalı**.

### 2b — Cross-org (negatif)

Başka bir org UUID ile:

```bash
curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/admin/events" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "x-org-id: 00000000-0000-0000-0000-000000000099"
```

**Beklenen:** `403` — `"Cross-org access denied"`

### 2c — x-org-id eksik

```bash
curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/admin/events" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Beklenen:** `400` — `"x-org-id header required"`

### DB kontrolü

```sql
SELECT COUNT(*) AS cnt FROM eza_events WHERE org_id = :org_id;
```

Liste `count` ile tutarlı olmalı.

---

## Senaryo 3 — Feedback + feedback_history

**Amaç:** Event sahibi kullanıcı `event_id` ile feedback gönderir; admin detayda `feedback_history` görür.

### Ön hazırlık

`EVENT_ID` = Senaryo 1’deki `eza_events.id`

### 3a — Feedback gönder (event sahibi)

```bash
curl -s -X POST "$BASE_URL/api/safemode/feedback" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-org-id: $ORG_ID" \
  -d "{
    \"event_id\": \"$EVENT_ID\",
    \"feedback_type\": \"CORRECT\",
    \"metric_name\": \"eza_score\",
    \"notes\": \"E2E manual test\"
  }"
```

**Beklenen (200):**

```json
{
  "ok": true,
  "feedback_id": "<uuid>",
  "event_id": "<EVENT_ID>"
}
```

### 3b — Yabancı kullanıcı (negatif)

Farklı kullanıcı token’ı ile aynı `event_id`:

**Beklenen:** `403` — `foreign_event`

### 3c — Event detay + feedback_history

```bash
curl -s "$BASE_URL/api/admin/events/$EVENT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "x-org-id: $ORG_ID"
```

**Beklenen (200):** `feedback_history` dizisinde az önceki kayıt:

```json
{
  "id": "...",
  "feedback_type": "CORRECT",
  "metric_name": "eza_score",
  "event_id": "<EVENT_ID>",
  "user_id": "<USER_ID>"
}
```

`score_vector`, `metadata` içinde ham metin anahtarı (`message`, `content`, `query`) **olmamalı**.

### DB kontrolü

```sql
SELECT id, user_id, org_id, event_id, feedback_type, metric_name, notes
FROM behavioral_feedback
WHERE event_id = '<EVENT_ID>'::uuid
ORDER BY timestamp DESC;
```

---

## Senaryo 4 — Governance overview

**Amaç:** Özet metrikler org kapsamında döner.

```bash
curl -s "$BASE_URL/api/admin/governance/overview" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "x-org-id: $ORG_ID"
```

**Beklenen (200):**

```json
{
  "org_id": "...",
  "tables_ready": true,
  "event_counts": {
    "last_24h": 1,
    "last_7d": 1,
    "last_30d": 1
  },
  "source_mode_distribution": { "standalone": 1 },
  "risk_label_distribution": { "low": 1 },
  "average_confidence": 70.0,
  "average_reliability": null,
  "feedback_count": 1,
  "false_positive_count": 0,
  "false_negative_count": 0
}
```

`tables_ready: false` ise migration veya boş DB — crash olmamalı, sayılar 0 olabilir.

### DB çapraz kontrol

```sql
-- Event sayısı (30 gün)
SELECT COUNT(*) FROM eza_events
WHERE org_id = :org_id AND timestamp >= NOW() - INTERVAL '30 days';

-- Feedback sayısı
SELECT COUNT(*) FROM behavioral_feedback
WHERE org_id = :org_id AND timestamp >= NOW() - INTERVAL '30 days';

-- Risk dağılımı
SELECT risk_label, COUNT(*) FROM eza_events
WHERE org_id = :org_id AND timestamp >= NOW() - INTERVAL '30 days'
GROUP BY risk_label;
```

---

## Senaryo 5 — Weekly calibration report

**Amaç:** FALSE_POSITIVE ve TOO_STRICT feedback sonrası öneri üretimi; `do_not_auto_apply=true`.

### 5a — Test feedback verisi ekle

İki ayrı feedback (aynı veya farklı event’lere bağlı):

```bash
# FALSE_POSITIVE
curl -s -X POST "$BASE_URL/api/safemode/feedback" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-org-id: $ORG_ID" \
  -d '{"event_id":"'"$EVENT_ID"'","feedback_type":"FALSE_POSITIVE","metric_name":"eza_score"}'

# TOO_STRICT (analysis_id ile de olabilir; event_id zorunlu değil ama org_id header önerilir)
curl -s -X POST "$BASE_URL/api/safemode/feedback" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-org-id: $ORG_ID" \
  -d '{"event_id":"'"$EVENT_ID"'","feedback_type":"TOO_STRICT","metric_name":"input_risk"}'
```

> Yüksek oranlı öneri için aynı org’da **toplam ≥5–10 feedback** ve FP oranı ≥%20 hedeflenir. Gerekirse birkaç FP daha ekleyin.

### 5b — Haftalık rapor

```bash
curl -s "$BASE_URL/api/admin/governance/weekly-calibration-report?weeks=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "x-org-id: $ORG_ID"
```

**Beklenen (200):**

```json
{
  "period": { "weeks": 1, "start": "...", "end": "..." },
  "total_events": 1,
  "total_feedback": 3,
  "confidence": "low|medium|high",
  "feedback_quality": {
    "false_positive_rate": 0.33,
    "too_strict_rate": 0.5
  },
  "calibration_suggestions": [
    { "type": "threshold_review", "status": "preliminary|actionable", "message": "..." },
    { "type": "too_strict_warning", "status": "...", "message": "..." }
  ],
  "do_not_auto_apply": true,
  "disclaimer": "Bu rapor otomatik karar değişikliği yapmaz. Sadece admin kalibrasyonu için öneri üretir."
}
```

**Zorunlu kontroller:**

- `do_not_auto_apply` === `true`
- `disclaimer` metni dolu
- Öneri `type` değerleri yalnızca: `threshold_review`, `confidence_review`, `category_mapping_review`, `too_strict_warning`, `too_soft_warning`
- Hiçbir alanda ham kullanıcı mesajı yok

### DB kontrolü

```sql
SELECT feedback_type, COUNT(*)
FROM behavioral_feedback
WHERE org_id = :org_id AND timestamp >= NOW() - INTERVAL '7 days'
GROUP BY feedback_type;
```

---

## Senaryo 6 — Production privacy (case_snapshot)

**Amaç:** `ENV=production` + `TEST_MODE=true` olsa bile snapshot **NULL** kalmalı.

### 6a — Runtime doğrulama (Python)

Sunucuyu şu env ile başlatın:

```env
ENV=production
EZA_ENV=production
TEST_MODE=true
```

```powershell
python -c "
from backend.config import get_settings
from backend.core.events.event_normalizer import _resolve_case_snapshot
s = get_settings()
print('ENV=', s.ENV, 'TEST_MODE=', s.TEST_MODE)
snap = _resolve_case_snapshot({'vector': {'input_risk': 0.2}, 'message': 'secret user text'})
print('snapshot is None:', snap is None)
"
```

**Beklenen:** `snapshot is None: True`  
(`get_settings()` production’da `TEST_MODE`’u false’a çeker.)

### 6b — Event logging + DB

`EZA_EVENT_LOGGING_ENABLED=true` ile Senaryo 1 script’ini **production env** altında çalıştırın.

```sql
SELECT id, case_snapshot FROM eza_events
ORDER BY timestamp DESC LIMIT 1;
```

**Beklenen:** `case_snapshot` IS NULL

### 6c — Governance status

```bash
curl -s "$BASE_URL/api/admin/system/governance-status" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Beklenen:**

```json
{
  "privacy": {
    "test_mode": false,
    "case_snapshot_allowed": false,
    "production_snapshot_blocked": true
  }
}
```

---

## Senaryo 7 — Feature flag (event logging on/off)

**Amaç:** Flag kapalıyken yeni event yazılmaz; açıkken yazılır.

### 7a — Flag KAPALI

```env
EZA_EVENT_LOGGING_ENABLED=false
```

1. Mevcut sayıyı kaydedin:

```sql
SELECT COUNT(*) AS before_cnt FROM eza_events WHERE org_id = :org_id;
```

2. Senaryo 1 Python script’ini çalıştırın (`session_id=e2e-flag-off`).

3. Tekrar sayın:

```sql
SELECT COUNT(*) AS after_cnt FROM eza_events WHERE org_id = :org_id;
```

**Beklenen:** `before_cnt` = `after_cnt`

### 7b — Flag AÇIK

```env
EZA_EVENT_LOGGING_ENABLED=true
```

Sunucuyu yeniden başlatın. Script’i `session_id=e2e-flag-on` ile çalıştırın.

```sql
SELECT id, session_id FROM eza_events
WHERE session_id = 'e2e-flag-on';
```

**Beklenen:** 1 satır

### Governance status çapraz kontrol

```bash
curl -s "$BASE_URL/api/admin/system/governance-status" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

```json
"event_logging": {
  "enabled": true,
  "tables_ready": true,
  "hook_loaded": true
}
```

---

## Ek endpoint referansı

| Endpoint | Auth | Header |
|----------|------|--------|
| `GET /api/admin/system/governance-status` | admin | — |
| `GET /api/admin/governance/overview` | admin | `x-org-id` |
| `GET /api/admin/governance/engine-reliability` | admin | `x-org-id` |
| `GET /api/admin/governance/calibration-summary` | admin | `x-org-id` |
| `GET /api/admin/governance/weekly-calibration-report` | admin | `x-org-id` |
| `GET /api/admin/events` | admin | `x-org-id` |
| `GET /api/admin/events/{id}` | admin | `x-org-id` |
| `POST /api/safemode/feedback` | JWT user | `x-org-id` (önerilir) |

---

## Test fixture önerileri (isteğe bağlı)

Otomasyon için `backend/tests/fixtures/governance_e2e.json` benzeri bir dosya:

```json
{
  "org_id": "00000000-0000-0000-0000-000000000001",
  "admin_user_id": "...",
  "regular_user_id": "...",
  "session_id": "e2e-session-001",
  "sample_event": {
    "source_mode": "standalone",
    "entity_type": "user",
    "event_type": "message"
  },
  "feedback_samples": [
    { "feedback_type": "CORRECT", "metric_name": "eza_score" },
    { "feedback_type": "FALSE_POSITIVE", "metric_name": "eza_score" },
    { "feedback_type": "TOO_STRICT", "metric_name": "input_risk" }
  ]
}
```

Pytest entegrasyonu için:

- `tests_core/test_governance_e2e_integration.py` — `@pytest.mark.integration` + gerçek PostgreSQL
- Ortam: `EZA_EVENT_LOGGING_ENABLED=true`, `DATABASE_URL` test DB
- Her test sonrası `DELETE FROM eza_events WHERE session_id LIKE 'e2e-%'`

---

## Checklist (release öncesi)

- [ ] `alembic upgrade head` production’da uygulandı
- [ ] `GET /api/admin/system/governance-status` → `migration.*` true
- [ ] `EZA_EVENT_LOGGING_ENABLED` production’da bilinçli seçim (varsayılan false)
- [ ] Production’da `case_snapshot` her zaman NULL (SQL spot check)
- [ ] Cross-org admin isteği 403
- [ ] Weekly rapor `do_not_auto_apply: true`
- [ ] Pipeline skorları feedback öncesi/sonrası aynı (karar motoru değişmedi)

---

## Bilinen sınırlamalar

1. **`POST /api/standalone`** HTTP üzerinden `event_context` almaz; event logging E2E için Python `run_full_pipeline` kullanın veya ileride API genişletmesi gerekir.
2. **Admin role:** `require_admin()` yalnızca `role=admin` kabul eder (`org_admin` değil).
3. **Anonymous standalone:** `event_context` verilmezse hook `user_id=anonymous` ve otomatik `session_id` üretir.
